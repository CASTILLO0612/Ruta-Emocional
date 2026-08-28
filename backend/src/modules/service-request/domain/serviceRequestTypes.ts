export const SERVICE_MODALITIES = ['CHAT', 'CALL', 'IN_PERSON'] as const;
export type ServiceModality = typeof SERVICE_MODALITIES[number];

export const SERVICE_REQUEST_STATUSES = [
  'PENDING',
  'BIDDING',
  'ACCEPTED',
  'IN_SESSION',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type ServiceRequestStatus = typeof SERVICE_REQUEST_STATUSES[number];

export const OFFER_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const;
export type ServiceOfferStatus = typeof OFFER_STATUSES[number];

export interface MoneyView {
  readonly amount: string;
  readonly currency: string;
}

export interface RequestLocationInput {
  readonly latitude: number;
  readonly longitude: number;
}

export interface CreateServiceRequestInput {
  readonly modality: ServiceModality;
  readonly primaryNeed?: string;
  readonly description?: string;
  readonly proposedBudget: MoneyView;
  readonly scheduledFor?: Date;
  readonly location?: RequestLocationInput;
}

export interface PersistedServiceRequestInput extends CreateServiceRequestInput {
  readonly expiresAt: Date;
  readonly locationExpiresAt?: Date;
}

export interface AcceptedOfferSummary {
  readonly id: string;
  readonly psychologistProfileId: string;
  readonly price: MoneyView;
}

export interface ServiceRequestView {
  readonly id: string;
  readonly modality: ServiceModality;
  readonly primaryNeed: string | null;
  readonly description: string | null;
  readonly proposedBudget: MoneyView;
  readonly status: ServiceRequestStatus;
  readonly scheduledFor: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly acceptedOffer: AcceptedOfferSummary | null;
}

export interface EligibleServiceRequestView {
  readonly id: string;
  readonly modality: ServiceModality;
  readonly primaryNeed: string | null;
  readonly description: string | null;
  readonly proposedBudget: MoneyView;
  readonly status: 'PENDING' | 'BIDDING';
  readonly scheduledFor: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
}

export interface ProfessionalOfferSummary {
  readonly profileId: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly primarySpecialty: string | null;
  readonly rating: number;
  readonly totalReviews: number;
}

export interface ServiceOfferView {
  readonly id: string;
  readonly requestId: string;
  readonly professional: ProfessionalOfferSummary;
  readonly price: MoneyView;
  readonly message: string | null;
  readonly status: ServiceOfferStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ServiceRequestPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface AcceptanceResult {
  readonly request: ServiceRequestView;
  readonly acceptedOffer: ServiceOfferView;
  readonly careRelationshipId: string;
  readonly replayed: boolean;
}

export interface RequestCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export interface RequestPageQuery {
  readonly cursor?: RequestCursor;
  readonly limit: number;
  readonly status?: ServiceRequestStatus;
}

export interface ServiceRequestPolicyView {
  readonly minimumAmount: string;
  readonly maximumAmount: string;
  readonly supportedCurrencies: readonly string[];
  readonly immediateTtlMinutes: number;
  readonly scheduledLeadMinutes: number;
  readonly maximumScheduleDays: number;
  readonly maximumDescriptionLength: number;
  readonly maximumPrimaryNeedLength: number;
  readonly maximumOfferMessageLength: number;
}

export function encodeRequestCursor(cursor: RequestCursor): string {
  return Buffer.from(JSON.stringify({
    createdAt: cursor.createdAt.toISOString(),
    id: cursor.id,
  }), 'utf8').toString('base64url');
}
