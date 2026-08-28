import { AppError } from '../../../shared/domain/appError';
import { AuthenticatedActor } from '../../identity/application/identityService';
import { ProfessionalDirectoryRepository, RequestAuditContext } from './ports';
import {
  DirectoryFilters,
  ProfessionalModality,
  ProfessionalVerificationDecision,
  WeeklyAvailabilityInput,
} from '../domain/professionalDirectoryTypes';

export class ProfessionalDirectoryService {
  constructor(private readonly repository: ProfessionalDirectoryRepository) {}

  listSpecialties() {
    return this.repository.listSpecialties();
  }

  createSpecialty(actor: AuthenticatedActor, code: string, name: string, audit: RequestAuditContext) {
    this.assertCapability(actor, 'psychologist_verification:manage');
    return this.repository.createSpecialty({ code, name }, audit);
  }

  setSpecialtyStatus(
    actor: AuthenticatedActor,
    code: string,
    isActive: boolean,
    audit: RequestAuditContext
  ) {
    this.assertCapability(actor, 'psychologist_verification:manage');
    return this.repository.setSpecialtyStatus(code, isActive, audit);
  }

  listPublic(filters: DirectoryFilters) {
    return this.repository.listPublic(filters);
  }

  async findPublicById(profileId: string) {
    const profile = await this.repository.findPublicById(profileId);
    if (!profile) throw AppError.notFound('PSYCHOLOGIST_NOT_FOUND');
    return profile;
  }

  async findOwnProfile(actor: AuthenticatedActor) {
    this.assertCapability(actor, 'psychologist_onboarding:update:self');
    const profile = await this.repository.findOwnProfile(actor.user.id);
    if (!profile) throw AppError.notFound('PSYCHOLOGIST_PROFILE_NOT_FOUND');
    return profile;
  }

  updateOwnBio(actor: AuthenticatedActor, bio: string | null, audit: RequestAuditContext) {
    this.assertCapability(actor, 'psychologist_onboarding:update:self');
    return this.repository.updateOwnBio(actor.user.id, bio, audit);
  }

  replaceOwnSpecialties(
    actor: AuthenticatedActor,
    codes: readonly string[],
    primaryCode: string,
    audit: RequestAuditContext
  ) {
    this.assertCapability(actor, 'psychologist_onboarding:update:self');
    return this.repository.replaceOwnSpecialties(actor.user.id, codes, primaryCode, audit);
  }

  upsertOwnModality(
    actor: AuthenticatedActor,
    modality: ProfessionalModality,
    amount: string,
    currency: string,
    isEnabled: boolean,
    audit: RequestAuditContext
  ) {
    this.assertCapability(actor, 'psychologist_onboarding:update:self');
    return this.repository.upsertOwnModality(actor.user.id, modality, amount, currency, isEnabled, audit);
  }

  replaceOwnAvailability(
    actor: AuthenticatedActor,
    timezone: string,
    rules: readonly WeeklyAvailabilityInput[],
    audit: RequestAuditContext
  ) {
    this.assertCapability(actor, 'psychologist_onboarding:update:self');
    return this.repository.replaceOwnAvailability(actor.user.id, timezone, rules, audit);
  }

  addOwnAvailabilityException(
    actor: AuthenticatedActor,
    input: { startsAt: Date; endsAt: Date; type: 'AVAILABLE' | 'UNAVAILABLE'; reason?: string },
    audit: RequestAuditContext
  ) {
    this.assertCapability(actor, 'psychologist_onboarding:update:self');
    return this.repository.addOwnAvailabilityException(actor.user.id, input, audit);
  }

  submitVerificationEvidence(
    actor: AuthenticatedActor,
    licenseId: string,
    evidenceObjectKey: string,
    audit: RequestAuditContext
  ) {
    this.assertCapability(actor, 'psychologist_onboarding:update:self');
    return this.repository.submitVerificationEvidence(actor.user.id, licenseId, evidenceObjectKey, audit);
  }

  listPendingVerifications(actor: AuthenticatedActor, cursor: string | undefined, limit: number) {
    this.assertCapability(actor, 'psychologist_verification:manage');
    return this.repository.listPendingVerifications(cursor, limit);
  }

  decideVerification(
    actor: AuthenticatedActor,
    submissionId: string,
    decision: ProfessionalVerificationDecision,
    publicReason: string | undefined,
    internalReason: string | undefined,
    audit: RequestAuditContext
  ) {
    this.assertCapability(actor, 'psychologist_verification:manage');
    return this.repository.decideVerification(
      submissionId,
      decision,
      publicReason,
      internalReason,
      audit
    );
  }

  private assertCapability(actor: AuthenticatedActor, capability: string): void {
    if (!actor.user.capabilities.includes(capability)) {
      throw AppError.forbidden('CAPABILITY_REQUIRED');
    }
  }
}
