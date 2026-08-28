import {
  DirectoryFilters,
  DirectoryPage,
  LocalQaEvidenceContentType,
  ProfessionalModality,
  ProfessionalProfileView,
  ProfessionalVerificationDecision,
  PublicProfessionalView,
  SpecialtyView,
  VerificationQueuePage,
  WeeklyAvailabilityInput,
} from '../domain/professionalDirectoryTypes';

export interface LocalQaEvidenceFile {
  readonly userId: string;
  readonly licenseId: string;
  readonly originalFileName: string;
  readonly contentType: LocalQaEvidenceContentType;
  readonly bytes: Uint8Array;
}

export interface PrivateEvidenceStorage {
  store(file: LocalQaEvidenceFile): Promise<{ readonly objectKey: string }>;
  remove(objectKey: string): Promise<void>;
}

export interface RequestAuditContext {
  readonly actorUserId: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
}

export interface ProfessionalDirectoryRepository {
  listSpecialties(): Promise<readonly SpecialtyView[]>;
  createSpecialty(input: { code: string; name: string }, audit: RequestAuditContext): Promise<SpecialtyView>;
  setSpecialtyStatus(code: string, isActive: boolean, audit: RequestAuditContext): Promise<SpecialtyView>;
  listPublic(filters: DirectoryFilters): Promise<DirectoryPage>;
  findPublicById(profileId: string): Promise<PublicProfessionalView | null>;
  findOwnProfile(userId: string): Promise<ProfessionalProfileView | null>;
  updateOwnBio(userId: string, bio: string | null, audit: RequestAuditContext): Promise<ProfessionalProfileView>;
  replaceOwnSpecialties(
    userId: string,
    specialtyCodes: readonly string[],
    primarySpecialtyCode: string,
    audit: RequestAuditContext
  ): Promise<ProfessionalProfileView>;
  upsertOwnModality(
    userId: string,
    modality: ProfessionalModality,
    amount: string,
    currency: string,
    isEnabled: boolean,
    audit: RequestAuditContext
  ): Promise<ProfessionalProfileView>;
  replaceOwnAvailability(
    userId: string,
    timezone: string,
    rules: readonly WeeklyAvailabilityInput[],
    audit: RequestAuditContext
  ): Promise<ProfessionalProfileView>;
  addOwnAvailabilityException(
    userId: string,
    input: { startsAt: Date; endsAt: Date; type: 'AVAILABLE' | 'UNAVAILABLE'; reason?: string },
    audit: RequestAuditContext
  ): Promise<ProfessionalProfileView>;
  submitVerificationEvidence(
    userId: string,
    licenseId: string,
    evidenceObjectKey: string,
    audit: RequestAuditContext
  ): Promise<ProfessionalProfileView>;
  listPendingVerifications(cursor: string | undefined, limit: number): Promise<VerificationQueuePage>;
  decideVerification(
    submissionId: string,
    decision: ProfessionalVerificationDecision,
    publicReason: string | undefined,
    internalReason: string | undefined,
    audit: RequestAuditContext
  ): Promise<void>;
}
