import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  displayName: string;
  email: string;
  passwordHash: string;
  photoURL?: string;
  phone?: string;
  role: 'patient' | 'psychologist';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    displayName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    photoURL: { type: String },
    phone: { type: String },
    role: { type: String, enum: ['patient', 'psychologist'], default: 'patient' },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
