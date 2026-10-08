import { AppConfig } from './config/env';
import { PrismaClient } from './generated/prisma/client';
import { IdentityService } from './modules/identity/application/identityService';
import { PrismaIdentityRepository } from './modules/identity/infrastructure/persistence/prismaIdentityRepository';
import { JwtAccessTokenService } from './modules/identity/infrastructure/security/jwtAccessTokenService';
import { OpaqueRefreshTokenService } from './modules/identity/infrastructure/security/opaqueRefreshTokenService';
import { OpaquePasswordResetTokenService } from './modules/identity/infrastructure/security/opaquePasswordResetTokenService';
import { ResendPasswordResetDelivery } from './modules/identity/infrastructure/delivery/resendPasswordResetDelivery';
import { ScryptPasswordHasher } from './modules/identity/infrastructure/security/scryptPasswordHasher';
import { GoogleIdentityTokenVerifier } from './modules/identity/infrastructure/security/googleIdentityTokenVerifier';
import { LocalProfilePhotoStorage } from './modules/identity/infrastructure/storage/localProfilePhotoStorage';
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
import { MentaService } from './modules/menta/application/mentaService';
import type { MentaAgentProvider } from './modules/menta/application/ports';
import { PrismaMentaConversationRepository } from './modules/menta/infrastructure/persistence/prismaMentaConversationRepository';
import { PrismaMentaContextGateway } from './modules/menta/infrastructure/persistence/prismaMentaContextGateway';
import { GeminiInteractionsMentaProvider } from './modules/menta/infrastructure/providers/geminiInteractionsMentaProvider';
import { UnavailableMentaAgentProvider } from './modules/menta/infrastructure/providers/unavailableMentaAgentProvider';
import { OllamaMentaAgentProvider } from './modules/menta/infrastructure/providers/ollamaMentaAgentProvider';
import { NotificationService } from './modules/notification/application/notificationService';
import { PrismaPushDeviceRepository } from './modules/notification/infrastructure/persistence/prismaPushDeviceRepository';
import { S3Client } from '@aws-sdk/client-s3';
import { S3QuarantineObjectStore } from './shared/infrastructure/storage/s3QuarantineObjectStore';
import { S3ProfilePhotoStorage } from './modules/identity/infrastructure/storage/s3ProfilePhotoStorage';
import { S3PrivateEvidenceStorage } from './modules/professional-directory/infrastructure/storage/s3PrivateEvidenceStorage';
import { CallService } from './modules/call/application/callService';
import { PrismaCallSessionRepository } from './modules/call/infrastructure/persistence/prismaCallSessionRepository';
import { LiveKitCallAccessTokenIssuer } from './modules/call/infrastructure/providers/liveKitCallAccessTokenIssuer';

export interface ApplicationServices {
  readonly identity: IdentityService;
  readonly professionalDirectory: ProfessionalDirectoryService;
  readonly serviceRequests: ServiceRequestService;
  readonly messaging: MessagingService;
  readonly appointments: AppointmentService;
  readonly clinicalRecords: ClinicalRecordService;
  readonly triage: TriageService;
  readonly menta: MentaService;
  readonly notifications: NotificationService;
  readonly calls: CallService;
}

export function buildApplicationServices(config: AppConfig, prisma: PrismaClient): ApplicationServices {
  const identityRepository = new PrismaIdentityRepository(prisma);
  const s3Objects = config.media.storageProvider === 'S3'
    ? new S3QuarantineObjectStore(
        new S3Client({
          region: config.media.s3Region!,
          ...(config.media.s3Endpoint ? { endpoint: config.media.s3Endpoint } : {}),
          forcePathStyle: config.media.s3ForcePathStyle,
        }),
        config.media.s3Bucket!
      )
    : null;
  const profilePhotoStorage = s3Objects
    ? new S3ProfilePhotoStorage(prisma, s3Objects)
    : new LocalProfilePhotoStorage(config.media.profilePhotoDirectory);
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
  const evidenceStorage = s3Objects
    ? new S3PrivateEvidenceStorage(prisma, s3Objects)
    : config.localQa.enabled && config.localQa.evidenceDirectory
      ? new LocalPrivateEvidenceStorage(config.localQa.evidenceDirectory)
      : undefined;
  const passwordResetDelivery = config.passwordRecovery.provider === 'RESEND'
    ? new ResendPasswordResetDelivery({
        apiKey: config.passwordRecovery.resendApiKey!,
        sender: config.passwordRecovery.sender!,
        resetUrl: config.passwordRecovery.resetUrl!,
        timeoutMs: config.passwordRecovery.providerTimeoutMs,
      })
    : null;
  const clinicalContentCipher = new AesGcmClinicalContentCipher(
    config.clinical.contentEncryptionKeys,
    config.clinical.activeContentEncryptionKeyVersion
  );
  const federatedIdentityVerifier = config.federatedAuthentication.googleEnabled
    && config.federatedAuthentication.googleClientId
    ? new GoogleIdentityTokenVerifier({
        clientId: config.federatedAuthentication.googleClientId,
        timeoutMs: config.federatedAuthentication.verificationTimeoutMs,
      })
    : null;
  const mentaProvider: MentaAgentProvider = config.menta.provider === 'GEMINI'
    ? new GeminiInteractionsMentaProvider({
        apiKey: config.menta.geminiApiKey!,
        model: config.menta.model,
        timeoutMs: config.menta.providerTimeoutMs,
        maximumToolRounds: config.menta.maximumToolRounds,
      })
    : config.menta.provider === 'OLLAMA'
      ? new OllamaMentaAgentProvider({
          baseUrl: config.menta.ollamaBaseUrl!,
          model: config.menta.model,
          timeoutMs: config.menta.providerTimeoutMs,
          maximumToolRounds: config.menta.maximumToolRounds,
          keepAlive: config.menta.ollamaKeepAlive,
          maximumHistoryCharacters: config.menta.ollamaMaximumHistoryCharacters,
          maximumOutputTokens: config.menta.maximumOutputTokens,
          toolCallingEnabled: config.menta.ollamaToolCallingEnabled,
        })
      : new UnavailableMentaAgentProvider();
  const callTokenIssuer = config.calls.enabled
    ? new LiveKitCallAccessTokenIssuer(
        config.calls.liveKitUrl!,
        config.calls.liveKitApiKey!,
        config.calls.liveKitApiSecret!
      )
    : null;

  return {
    identity: new IdentityService(
      identityRepository,
      passwordHasher,
      accessTokens,
      new OpaqueRefreshTokenService(),
      new OpaquePasswordResetTokenService(),
      passwordResetDelivery,
      new SystemClock(),
      config.jwt.refreshTtlDays,
      config.passwordRecovery,
      federatedIdentityVerifier,
      profilePhotoStorage
    ),
    professionalDirectory: new ProfessionalDirectoryService(
      new PrismaProfessionalDirectoryRepository(prisma),
      {
        enabled: Boolean(evidenceStorage),
        maximumBytes: config.media.evidenceMaximumBytes,
      },
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
    menta: new MentaService(
      new PrismaMentaConversationRepository(prisma, clinicalContentCipher),
      new PrismaMentaContextGateway(prisma, clinicalContentCipher),
      mentaProvider,
      config.menta,
      config.triage
    ),
    notifications: new NotificationService(new PrismaPushDeviceRepository(prisma)),
    calls: new CallService(new PrismaCallSessionRepository(prisma), callTokenIssuer, config.calls),
  };
}
