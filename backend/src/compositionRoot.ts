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
import { AppointmentService } from './modules/appointment/application/appointmentService';
import { PrismaAppointmentRepository } from './modules/appointment/infrastructure/persistence/prismaAppointmentRepository';
import { ClinicalRecordService } from './modules/clinical-record/application/clinicalRecordService';
import { PrismaClinicalRecordRepository } from './modules/clinical-record/infrastructure/persistence/prismaClinicalRecordRepository';
import { AesGcmClinicalContentCipher } from './modules/clinical-record/infrastructure/security/aesGcmClinicalContentCipher';
import { TriageService } from './modules/triage/application/triageService';
import { DeterministicTriageEngine } from './modules/triage/domain/deterministicTriageEngine';
import { PrismaTriageRepository } from './modules/triage/infrastructure/persistence/prismaTriageRepository';
import { UnavailableTriageOrientationProvider } from './modules/triage/infrastructure/providers/unavailableTriageOrientationProvider';

export interface ApplicationServices {
  readonly identity: IdentityService;
  readonly professionalDirectory: ProfessionalDirectoryService;
  readonly serviceRequests: ServiceRequestService;
  readonly messaging: MessagingService;
  readonly appointments: AppointmentService;
  readonly clinicalRecords: ClinicalRecordService;
  readonly triage: TriageService;
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
  const clinicalContentCipher = new AesGcmClinicalContentCipher(
    config.clinical.contentEncryptionKeys,
    config.clinical.activeContentEncryptionKeyVersion
  );

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
    appointments: new AppointmentService(
      new PrismaAppointmentRepository(prisma, {
        maximumRetries: config.appointments.serializableMaxRetries,
        baseDelayMs: config.appointments.serializableRetryBaseDelayMs,
      }),
      new SystemClock(),
      config.appointments
    ),
    clinicalRecords: new ClinicalRecordService(
      new PrismaClinicalRecordRepository(
        prisma,
        clinicalContentCipher,
        {
          maximumRetries: config.clinical.serializableMaxRetries,
          baseDelayMs: config.clinical.serializableRetryBaseDelayMs,
          projectionLimit: config.clinical.maximumPageSize,
        }
      ),
      new SystemClock(),
      config.clinical
    ),
    triage: new TriageService(
      new PrismaTriageRepository(prisma),
      new DeterministicTriageEngine(),
      new UnavailableTriageOrientationProvider(),
      new SystemClock(),
      config.triage
    ),
  };
}
