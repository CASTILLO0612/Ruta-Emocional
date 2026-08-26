import { AppConfig } from './config/env';
import { PrismaClient } from './generated/prisma/client';
import { IdentityService } from './modules/identity/application/identityService';
import { PrismaIdentityRepository } from './modules/identity/infrastructure/persistence/prismaIdentityRepository';
import { JwtAccessTokenService } from './modules/identity/infrastructure/security/jwtAccessTokenService';
import { OpaqueRefreshTokenService } from './modules/identity/infrastructure/security/opaqueRefreshTokenService';
import { ScryptPasswordHasher } from './modules/identity/infrastructure/security/scryptPasswordHasher';
import { SystemClock } from './shared/application/clock';

export interface ApplicationServices {
  readonly identity: IdentityService;
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

  return {
    identity: new IdentityService(
      identityRepository,
      passwordHasher,
      accessTokens,
      new OpaqueRefreshTokenService(),
      new SystemClock(),
      config.jwt.refreshTtlDays
    ),
  };
}
