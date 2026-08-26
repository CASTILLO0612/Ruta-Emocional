import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Offer } from '../models/Offer';
import { ActiveRequest } from '../models/ActiveRequest';
import { Psychologist } from '../models/Psychologist';

export async function createOffer(req: Request, res: Response): Promise<void> {
  try {
    const { requestId, psychologistId, psychologistName, psychologistPhotoURL, psychologistRating, psychologistSpecialty, amount } = req.body;

    let targetPsychId = psychologistId;
    if (!psychologistId || !mongoose.Types.ObjectId.isValid(psychologistId)) {
      const realPsych = await Psychologist.findOne({ isAvailable: true });
      if (realPsych) {
        targetPsychId = realPsych._id;
      } else {
        targetPsychId = new mongoose.Types.ObjectId();
      }
    }

    const newOffer = await Offer.create({
      request: requestId,
      psychologist: targetPsychId,
      psychologistName: psychologistName || 'Psicólogo Disponible',
      psychologistPhotoURL: psychologistPhotoURL || 'https://i.pravatar.cc/150?img=47',
      psychologistRating: typeof psychologistRating === 'number' ? psychologistRating : 5.0,
      psychologistSpecialty: psychologistSpecialty || 'Psicología General',
      amount: amount || 300,
      status: 'pending',
    });

    // Actualizar el estado de la solicitud a 'bidding'
    await ActiveRequest.findByIdAndUpdate(requestId, { status: 'bidding' });

    res.status(201).json(newOffer);
  } catch (error: any) {
    res.status(500).json({ message: `Error creando oferta: ${error.message}` });
  }
}

export async function getOffersForRequest(req: Request, res: Response): Promise<void> {
  try {
    const { requestId } = req.params;
    const offers = await Offer.find({ request: requestId }).sort({ createdAt: -1 });
    res.json(offers);
  } catch (error: any) {
    res.status(500).json({ message: `Error obteniendo ofertas: ${error.message}` });
  }
}

export async function acceptOffer(req: Request, res: Response): Promise<void> {
  try {
    const { offerId } = req.body;

    const offer = await Offer.findById(offerId);
    if (!offer) {
      res.status(404).json({ message: 'Oferta no encontrada' });
      return;
    }

    offer.status = 'accepted';
    await offer.save();

    // Rechazar las demás ofertas de la misma solicitud
    await Offer.updateMany(
      { request: offer.request, _id: { $ne: offer._id } },
      { status: 'rejected' }
    );

    // Actualizar la solicitud activa
    await ActiveRequest.findByIdAndUpdate(offer.request, {
      status: 'accepted',
      acceptedOffer: offer._id,
      acceptedPsychologist: offer.psychologist,
      finalPrice: offer.amount,
    });

    res.json({ message: 'Oferta aceptada con éxito', offer });
  } catch (error: any) {
    res.status(500).json({ message: `Error aceptando oferta: ${error.message}` });
  }
}
