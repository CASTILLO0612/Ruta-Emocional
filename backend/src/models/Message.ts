import { Schema, model, Document, Types } from 'mongoose';

export type MessageType = 'text' | 'image' | 'audio' | 'system';

export interface IMessage extends Document {
  request: Types.ObjectId;
  sender: Types.ObjectId;
  senderName: string;
  senderRole: 'patient' | 'psychologist';
  text: string;
  type: MessageType;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    request: { type: Schema.Types.ObjectId, ref: 'ActiveRequest', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ['patient', 'psychologist'], required: true },
    text: { type: String, required: true },
    type: { type: String, enum: ['text', 'image', 'audio', 'system'], default: 'text' },
  },
  { timestamps: true }
);

export const Message = model<IMessage>('Message', MessageSchema);
