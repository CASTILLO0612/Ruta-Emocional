export type OfferStatus = 'pending' | 'accepted' | 'rejected';

export interface Offer {
  id: string;
  requestId: string;
  psychologistId: string;
  psychologistName: string;
  psychologistPhotoURL?: string;
  psychologistRating: number;
  psychologistSpecialty: string;

  amount: number;
  status: OfferStatus;

  createdAt: Date;
}
