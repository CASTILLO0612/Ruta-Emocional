export const MODALITIES = ['CHAT', 'CALL', 'IN_PERSON'] as const;
export type ProfessionalModality = typeof MODALITIES[number];

export const VERIFICATION_DECISIONS = ['APPROVED', 'REJECTED'] as const;
export type ProfessionalVerificationDecision = typeof VERIFICATION_DECISIONS[number];

export const LOCAL_QA_EVIDENCE_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;
export type LocalQaEvidenceContentType = typeof LOCAL_QA_EVIDENCE_CONTENT_TYPES[number];

export type EvidenceUploadPolicy =
  | { readonly mode: 'DISABLED' }
  | {
      readonly mode: 'LOCAL_QA';
      readonly maximumBytes: number;
      readonly acceptedContentTypes: readonly LocalQaEvidenceContentType[];
    };

export interface MoneyView {
  readonly amount: string;
  readonly currency: string;
}

export interface SpecialtyView {
  readonly code: string;
  readonly name: string;
}

export interface ProfessionalModalityView {
  readonly code: ProfessionalModality;
  readonly pricePerHour: MoneyView;
}

export interface PublicProfessionalView {
  readonly id: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly bio: string | null;
  readonly specialties: readonly SpecialtyView[];
  readonly primarySpecialty: SpecialtyView | null;
  readonly modalities: readonly ProfessionalModalityView[];
  readonly rating: {
    readonly average: string | null;
    readonly count: number;
  };
  readonly availability: {
    readonly hasWeeklySchedule: boolean;
  };
  readonly credential: {
    readonly authority: string;
    readonly status: 'VERIFIED';
  };
  readonly approximateDistanceKm?: string;
}

export interface DirectoryFilters {
  readonly specialty?: string;
  readonly modality?: ProfessionalModality;
  readonly minPrice?: string;
  readonly maxPrice?: string;
  readonly availableFrom?: Date;
  readonly availableUntil?: Date;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly radiusKm?: number;
  readonly cursor?: string;
  readonly limit: number;
}

export interface DirectoryPage {
  readonly items: readonly PublicProfessionalView[];
  readonly nextCursor: string | null;
}

export interface WeeklyAvailabilityInput {
  readonly weekday: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly effectiveFrom?: string;
  readonly effectiveUntil?: string;
  readonly isActive: boolean;
}

export interface ProfessionalProfileView {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoUrl: string | null;
  readonly bio: string | null;
  readonly verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  readonly specialties: readonly (SpecialtyView & { readonly isPrimary: boolean })[];
  readonly modalities: readonly (ProfessionalModalityView & { readonly isEnabled: boolean })[];
  readonly licenses: readonly {
    readonly id: string;
    readonly authority: string;
    readonly number: string;
    readonly status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    readonly evidenceSubmitted: boolean;
    readonly latestPublicDecisionReason: string | null;
  }[];
  readonly availability: {
    readonly timezone: string | null;
    readonly weeklyRules: readonly WeeklyAvailabilityInput[];
    readonly exceptions: readonly {
      readonly id: string;
      readonly startsAt: string;
      readonly endsAt: string;
      readonly type: 'AVAILABLE' | 'UNAVAILABLE';
      readonly reason: string | null;
    }[];
  };
}

export interface VerificationQueueItem {
  readonly submissionId: string;
  readonly psychologistProfileId: string;
  readonly psychologistName: string;
  readonly license: {
    readonly id: string;
    readonly authority: string;
    readonly number: string;
  };
  readonly evidenceObjectKey: string;
  readonly submittedAt: string;
}

export interface VerificationQueuePage {
  readonly items: readonly VerificationQueueItem[];
  readonly nextCursor: string | null;
}
