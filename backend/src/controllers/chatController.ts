import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Message } from '../models/Message';
import { ActiveRequest } from '../models/ActiveRequest';
import { User } from '../models/User';
import { Psychologist } from '../models/Psychologist';

export async function getMessagesForRequest(req: Request, res: Response): Promise<void> {
  try {
    const { requestId } = req.params;
    if (!requestId) {
      res.json([]);
      return;
    }

    let query: any = { request: requestId };
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      query = { request: new mongoose.Types.ObjectId('000000000000000000000000') };
    }

    const messages = await Message.find(query).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: `Error obteniendo mensajes: ${error.message}` });
  }
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const { requestId, senderId, senderName, senderRole, text, type } = req.body;

    if (!requestId || !text) {
      res.status(400).json({ message: 'Campos requeridos incompletos' });
      return;
    }

    const targetReqId = mongoose.Types.ObjectId.isValid(requestId)
      ? requestId
      : new mongoose.Types.ObjectId('000000000000000000000000');

    const targetSenderId = mongoose.Types.ObjectId.isValid(senderId)
      ? senderId
      : new mongoose.Types.ObjectId();

    const newMsg = await Message.create({
      request: targetReqId,
      sender: targetSenderId,
      senderName: senderName || 'Usuario',
      senderRole: senderRole || 'patient',
      text: text.trim(),
      type: type || 'text',
    });

    res.status(201).json(newMsg);
  } catch (error: any) {
    res.status(500).json({ message: `Error enviando mensaje: ${error.message}` });
  }
}

export async function getUserConversations(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.json([]);
      return;
    }

    // Consultar solicitudes ordenadas por la más reciente
    const requests = await ActiveRequest.find({
      $or: [{ patient: userId }, { acceptedPsychologist: userId }],
    }).sort({ createdAt: -1 });

    const conversationsMap = new Map<string, any>();

    for (const reqObj of requests) {
      const lastMsg = await Message.findOne({ request: reqObj._id }).sort({ createdAt: -1 });

      let psychName = 'Dra. Diana Castillo';
      let psychPhotoURL = undefined;
      let key = reqObj.acceptedPsychologist ? reqObj.acceptedPsychologist.toString() : reqObj._id.toString();

      if (reqObj.acceptedPsychologist) {
        const psychUser = await User.findById(reqObj.acceptedPsychologist);
        if (psychUser) {
          psychName = psychUser.displayName;
          psychPhotoURL = psychUser.photoURL;
          key = psychUser._id.toString();
        } else {
          const psychDoc = await Psychologist.findById(reqObj.acceptedPsychologist);
          if (psychDoc) {
            psychName = psychDoc.displayName;
            psychPhotoURL = psychDoc.photoURL;
            key = psychDoc._id.toString();
          }
        }
      }

      // Agrupar por interlocutor manteniendo únicamente la conversación más reciente
      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          requestId: reqObj._id,
          requestStatus: reqObj.status,
          modality: reqObj.modality,
          patientName: reqObj.patientName || 'Angel Flores',
          patientPhotoURL: reqObj.patientPhotoURL,
          psychologistName: psychName,
          psychologistPhotoURL: psychPhotoURL,
          lastMessage: lastMsg ? lastMsg.text : 'Conversación iniciada',
          updatedAt: lastMsg ? lastMsg.createdAt : reqObj.createdAt,
        });
      }
    }

    res.json(Array.from(conversationsMap.values()));
  } catch (error: any) {
    res.status(500).json({ message: `Error obteniendo conversaciones: ${error.message}` });
  }
}
