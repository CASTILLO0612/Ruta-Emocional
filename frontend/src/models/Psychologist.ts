export type Modality = 'chat' | 'call' | 'in-person';
export type DirectoryModality = 'CHAT' | 'CALL' | 'IN_PERSON';

export interface Psychologist {
  readonly id: string;
  readonly displayName: string;
  readonly photoURL?: string;
  readonly specialty: string;
  readonly specialties: readonly { readonly code: string; readonly name: string }[];
  readonly rating: number;
  readonly totalReviews: number;
  readonly pricePerHour: string;
  readonly currencyCode: string;
  readonly modalities: readonly Modality[];
  readonly isAvailable: boolean;
  readonly bio?: string;
  readonly credentialAuthority: string;
  readonly approximateDistanceKm?: string;
}

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}
