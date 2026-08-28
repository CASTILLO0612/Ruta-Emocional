export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface Offer {
  id: string;
  requestId: string;
  psychologistId: string;
  psychologistName: string;
  psychologistPhotoURL?: string;
  psychologistRating: number;
  psychologistSpecialty?: string;

  amount: number;
  currencyCode: string;
  message?: string;
  status: OfferStatus;

  createdAt: Date;
}
