import { Schema, model, Document, Types } from 'mongoose';
import { Modality } from './Psychologist';

export type RequestStatus =
  | 'pending'
  | 'bidding'
  | 'accepted'
  | 'in-session'
  | 'completed'
  | 'cancelled';

export interface IActiveRequest extends Document {
  patient: Types.ObjectId;
  patientName: string;
  patientPhotoURL?: string;
  modality: Modality;
  primaryNeed?: string;
  description?: string;
  proposedBudget: number;
  finalPrice?: number;
  status: RequestStatus;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  acceptedOffer?: Types.ObjectId;
  acceptedPsychologist?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const ActiveRequestSchema = new Schema<IActiveRequest>(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    patientName: { type: String, required: true },
    patientPhotoURL: { type: String },
    modality: { type: String, enum: ['chat', 'call', 'in-person'], required: true },
    primaryNeed: { type: String },
    description: { type: String },
    proposedBudget: { type: Number, required: true },
    finalPrice: { type: Number },
    status: {
      type: String,
      enum: ['pending', 'bidding', 'accepted', 'in-session', 'completed', 'cancelled'],
      default: 'pending',
    },
    location: {
      type: PointSchema,
      required: false,
    },
    acceptedOffer: { type: Schema.Types.ObjectId, ref: 'Offer' },
    acceptedPsychologist: { type: Schema.Types.ObjectId, ref: 'Psychologist' },
  },
  { timestamps: true }
);

ActiveRequestSchema.index({ location: '2dsphere' }, { sparse: true });

export const ActiveRequest = model<IActiveRequest>('ActiveRequest', ActiveRequestSchema);