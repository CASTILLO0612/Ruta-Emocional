import { Request, Response } from 'express';
import { ActiveRequest } from '../models/ActiveRequest';

export async function createRequest(req: Request, res: Response): Promise<void> {
  try {
    const { patientId, patientName, patientPhotoURL, modality, primaryNeed, description, proposedBudget, coordinates } = req.body;

    const hasValidCoords =
      coordinates &&
      typeof coordinates.latitude === 'number' &&
      typeof coordinates.longitude === 'number';

    const newReq = await ActiveRequest.create({
      patient: patientId,
      patientName,
      patientPhotoURL,
      modality,
      primaryNeed,
      description,
      proposedBudget,
      status: 'pending',
      ...(hasValidCoords && {
        location: {
          type: 'Point',
          coordinates: [coordinates.longitude, coordinates.latitude],
        },
      }),
    });

    res.status(201).json(newReq);
  } catch (error: any) {
    res.status(500).json({ message: `Error creando solicitud: ${error.message}` });
  }
}

export async function getActiveRequests(req: Request, res: Response): Promise<void> {
  try {
    const requests = await ActiveRequest.find({
      status: { $in: ['pending', 'bidding'] },
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ message: `Error al obtener solicitudes: ${error.message}` });
  }
}

export async function updateRequestStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, acceptedOfferId, acceptedPsychologistId, finalPrice } = req.body;

    const updated = await ActiveRequest.findByIdAndUpdate(
      id,
      {
        status,
        ...(acceptedOfferId && { acceptedOffer: acceptedOfferId }),
        ...(acceptedPsychologistId && { acceptedPsychologist: acceptedPsychologistId }),
        ...(finalPrice && { finalPrice }),
      },
      { new: true }
    );

    if (!updated) {
      res.status(404).json({ message: 'Solicitud no encontrada' });
      return;
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: `Error actualizando solicitud: ${error.message}` });
  }
}
