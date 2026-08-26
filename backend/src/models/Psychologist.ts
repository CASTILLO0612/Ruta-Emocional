import { Schema, model, Document, Types } from 'mongoose';

export type Modality = 'chat' | 'call' | 'in-person';

export interface IPsychologist extends Document {
  user: Types.ObjectId;
  displayName: string;
  email: string;
  photoURL?: string;
  specialty: string;
  licenseNumber: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationDocumentURL?: string;
  rating: number;
  totalReviews: number;
  pricePerHour: number;
  modalities: Modality[];
  isAvailable: boolean;
  isVerified: boolean;
  bio?: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude] GeoJSON format
  };
  createdAt: Date;
  updatedAt: Date;
}

const PsychologistSchema = new Schema<IPsychologist>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true },
    photoURL: { type: String },
    specialty: { type: String, required: true, default: 'Psicología General' },
    licenseNumber: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          // Formato MINSA: MINSA-XXXX o alfanumérico de 4+ caracteres
          return /^(MINSA-)?[A-Za-z0-9]{3,}$/.test(v);
        },
        message: 'Número de colegiatura MINSA inválido. Formato esperado: MINSA-XXX o alfanumérico',
      },
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verificationDocumentURL: { type: String },
    rating: { type: Number, default: 5.0 },
    totalReviews: { type: Number, default: 0 },
    pricePerHour: { type: Number, required: true, default: 0 },
    modalities: [{ type: String, enum: ['chat', 'call', 'in-person'] }],
    isAvailable: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    bio: { type: String },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
        default: [0, 0],
      },
    },
  },
  { timestamps: true }
);

// Índice Geoespacial 2dsphere para soporte de psicólogos cercanos ($near / $nearSphere)
PsychologistSchema.index({ location: '2dsphere' });

export const Psychologist = model<IPsychologist>('Psychologist', PsychologistSchema);
