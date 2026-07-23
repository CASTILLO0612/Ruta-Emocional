export interface Psychologist {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  specialty: string;
  licenseNumber: string;
  rating: number;
  totalReviews: number;
  pricePerHour: number;
  modalities: Modality[];
  isAvailable: boolean;
  isVerified: boolean;
  bio?: string;
  coordinates?: GeoPoint;
  createdAt: Date;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type Modality = 'chat' | 'call' | 'in-person';
