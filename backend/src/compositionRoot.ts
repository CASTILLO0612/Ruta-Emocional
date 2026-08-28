import { AppConfig } from './config/env';
import { PrismaClient } from './generated/prisma/client';
import { IdentityService } from './modules/identity/application/identityService';
import { PrismaIdentityRepository } from './modules/identity/infrastructure/persistence/prismaIdentityRepository';
import { JwtAccessTokenService } from './modules/identity/infrastructure/security/jwtAccessTokenService';
import { OpaqueRefreshTokenService } from './modules/identity/infrastructure/security/opaqueRefreshTokenService';
import { ScryptPasswordHasher } from './modules/identity/infrastructure/security/scryptPasswordHasher';
import { SystemClock } from './shared/application/clock';
import { ProfessionalDirectoryService } from './modules/professional-directory/application/professionalDirectoryService';
import { PrismaProfessionalDirectoryRepository } from './modules/professional-directory/infrastructure/persistence/prismaProfessionalDirectoryRepository';
import { LocalPrivateEvidenceStorage } from './modules/professional-directory/infrastructure/storage/localPrivateEvidenceStorage';
import { ServiceRequestService } from './modules/service-request/application/serviceRequestService';
import { PrismaServiceRequestRepository } from './modules/service-request/infrastructure/persistence/prismaServiceRequestRepository';
import { MessagingService } from './modules/messaging/application/messagingService';
import { PrismaMessagingRepository } from './modules/messaging/infrastructure/persistence/prismaMessagingRepository';

export interface ApplicationServices {
  readonly identity: IdentityService;
  readonly professionalDirectory: ProfessionalDirectoryService;
  readonly serviceRequests: ServiceRequestService;
  readonly messaging: MessagingService;
}

export function buildApplicationServices(config: AppConfig, prisma: PrismaClient): ApplicationServices {
  const identityRepository = new PrismaIdentityRepository(prisma);
  const passwordHasher = new ScryptPasswordHasher({
    pepper: config.password.pepper,
    n: config.password.scryptN,
    r: config.password.scryptR,
    p: config.password.scryptP,
    keyLength: config.password.keyLength,
  });
  const accessTokens = new JwtAccessTokenService({
    secret: config.jwt.accessSecret,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresInSeconds: config.jwt.accessTtlSeconds,
  });
  const evidenceStorage = config.localQa.enabled && config.localQa.evidenceDirectory
    ? new LocalPrivateEvidenceStorage(config.localQa.evidenceDirectory)
    : undefined;

  return {
    identity: new IdentityService(
      identityRepository,
      passwordHasher,
      accessTokens,
      new OpaqueRefreshTokenService(),
      new SystemClock(),
      config.jwt.refreshTtlDays
    ),
    professionalDirectory: new ProfessionalDirectoryService(
      new PrismaProfessionalDirectoryRepository(prisma),
      config.localQa,
      evidenceStorage
    ),
    serviceRequests: new ServiceRequestService(
      new PrismaServiceRequestRepository(prisma, {
        maximumRetries: config.requestFlow.serializableMaxRetries,
        baseDelayMs: config.requestFlow.serializableRetryBaseDelayMs,
      }),
      new SystemClock(),
      config.requestFlow
    ),
    messaging: new MessagingService(new PrismaMessagingRepository(prisma), config.messaging),
  };
}
