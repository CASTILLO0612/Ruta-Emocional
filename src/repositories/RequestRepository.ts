import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase.config';
import { ActiveRequest, RequestStatus } from '../models/ActiveRequest';
import { Modality } from '../models/Psychologist';

const COLLECTION = 'active_requests';

export interface CreateRequestPayload {
  patientId: string;
  patientName: string;
  patientPhotoURL?: string;
  modality: Modality;
  proposedBudget: number;
  primaryNeed?: string;
  description?: string;
  coordinates?: { latitude: number; longitude: number };
}

export async function createRequest(
  payload: CreateRequestPayload
): Promise<string> {
  try {
    const data: any = {
      status: 'pending' as RequestStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    Object.keys(payload).forEach((key) => {
      const value = (payload as any)[key];
      if (value !== undefined) {
        data[key] = value;
      }
    });

    const docRef = await addDoc(collection(db, COLLECTION), data);
    return docRef.id;
  } catch (error) {
    throw new Error(`Error creating request: ${error}`);
  }
}

export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  extra?: Partial<ActiveRequest>
): Promise<void> {
  try {
    const ref = doc(db, COLLECTION, requestId);
    await updateDoc(ref, { status, ...extra, updatedAt: serverTimestamp() });
  } catch (error) {
    throw new Error(`Error updating request: ${error}`);
  }
}

export function listenToPendingRequests(
  callback: (requests: ActiveRequest[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where('status', 'in', ['pending', 'bidding']),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate(),
      updatedAt: d.data().updatedAt?.toDate(),
    })) as ActiveRequest[];
    callback(requests);
  });
}

export function listenToRequest(
  requestId: string,
  callback: (request: ActiveRequest | null) => void
): Unsubscribe {
  const ref = doc(db, COLLECTION, requestId);
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    const data = {
      id: snapshot.id,
      ...snapshot.data(),
      createdAt: snapshot.data().createdAt?.toDate(),
      updatedAt: snapshot.data().updatedAt?.toDate(),
    } as ActiveRequest;
    callback(data);
  });
}
