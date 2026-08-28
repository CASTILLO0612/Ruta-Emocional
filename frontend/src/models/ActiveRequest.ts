import { Modality } from './Psychologist';

export type RequestStatus =
  | 'pending'
  | 'bidding'
  | 'accepted'
  | 'in-session'
  | 'completed'
  | 'cancelled'
  | 'expired';

export interface ActiveRequest {
  id: string;
  modality: Modality;
  primaryNeed?: string;
  description?: string;
  proposedBudget: number;
  currencyCode: string;

  status: RequestStatus;

  acceptedOfferId?: string;
  acceptedPsychologistId?: string;
  scheduledFor?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt?: Date;
}
