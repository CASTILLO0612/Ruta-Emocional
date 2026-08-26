import { Schema, model, Document, Types } from 'mongoose';

export type OfferStatus = 'pending' | 'accepted' | 'rejected';

export interface IOffer extends Document {
  request: Types.ObjectId;
  psychologist: Types.ObjectId;
  psychologistName: string;
  psychologistPhotoURL?: string;
  psychologistRating: number;
  psychologistSpecialty: string;
  amount: number;
  status: OfferStatus;
  createdAt: Date;
  updatedAt: Date;
}

const OfferSchema = new Schema<IOffer>(
  {
    request: { type: Schema.Types.ObjectId, ref: 'ActiveRequest', required: true },
    psychologist: { type: Schema.Types.ObjectId, ref: 'Psychologist', required: true },
    psychologistName: { type: String, required: true },
    psychologistPhotoURL: { type: String },
    psychologistRating: { type: Number, default: 5.0 },
    psychologistSpecialty: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

export const Offer = model<IOffer>('Offer', OfferSchema);
