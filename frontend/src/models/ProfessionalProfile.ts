import { DirectoryModality } from './Psychologist';

export interface SpecialtyCatalogItem {
  readonly code: string;
  readonly name: string;
}

export interface ProfessionalProfile {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly bio: string | null;
  readonly verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  readonly specialties: readonly (SpecialtyCatalogItem & { readonly isPrimary: boolean })[];
  readonly modalities: readonly {
    readonly code: DirectoryModality;
    readonly isEnabled: boolean;
    readonly pricePerHour: { readonly amount: string; readonly currency: string };
  }[];
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
    readonly weeklyRules: readonly WeeklyAvailabilityRule[];
  };
}

export interface WeeklyAvailabilityRule {
  readonly weekday: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly isActive: boolean;
}

export interface ProfessionalCatalogs {
  readonly modalities: readonly DirectoryModality[];
  readonly currencies: readonly string[];
}
