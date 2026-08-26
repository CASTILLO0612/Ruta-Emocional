import { Modality, GeoPoint } from './Psychologist';

export type RequestStatus =
  | 'pending'
  | 'bidding'
  | 'accepted'
  | 'in-session'
  | 'completed'
  | 'cancelled';

export interface ActiveRequest {
  id: string;
  patientId: string;
  patientName: string;
  patientPhotoURL?: string;

  modality: Modality;
  primaryNeed?: string;
  description?: string;
  proposedBudget: number;
  finalPrice?: number;

  status: RequestStatus;

  coordinates?: GeoPoint;

  acceptedOfferId?: string;
  acceptedPsychologistId?: string;

  createdAt: Date;
  updatedAt: Date;
}
