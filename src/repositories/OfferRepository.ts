import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase.config';
import { Offer, OfferStatus } from '../models/Offer';
import { updateRequestStatus } from './RequestRepository';

export interface SubmitOfferPayload {
  requestId: string;
  psychologistId: string;
  psychologistName: string;
  psychologistPhotoURL?: string;
  psychologistRating: number;
  psychologistSpecialty: string;
  amount: number;
}

export async function submitOffer(payload: SubmitOfferPayload): Promise<string> {
  try {
    const offersRef = collection(
      db,
      'active_requests',
      payload.requestId,
      'offers'
    );
    const docRef = await addDoc(offersRef, {
      ...payload,
      status: 'pending' as OfferStatus,
      createdAt: serverTimestamp(),
    });

    await updateRequestStatus(payload.requestId, 'bidding');

    return docRef.id;
  } catch (error) {
    throw new Error(`Error submitting offer: ${error}`);
  }
}

export async function acceptOffer(
  requestId: string,
  offerId: string,
  psychologistId: string,
  finalPrice: number
): Promise<void> {
  try {
    const offerRef = doc(db, 'active_requests', requestId, 'offers', offerId);
    await updateDoc(offerRef, { status: 'accepted' });

    await updateRequestStatus(requestId, 'accepted', {
      acceptedOfferId: offerId,
      acceptedPsychologistId: psychologistId,
      finalPrice,
    });
  } catch (error) {
    throw new Error(`Error accepting offer: ${error}`);
  }
}

export function listenToOffers(
  requestId: string,
  callback: (offers: Offer[]) => void
): Unsubscribe {
  const offersRef = collection(db, 'active_requests', requestId, 'offers');

  return onSnapshot(offersRef, (snapshot) => {
    const offers = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate(),
    })) as Offer[];
    offers.sort((a, b) => a.amount - b.amount);
    callback(offers);
  });
}
