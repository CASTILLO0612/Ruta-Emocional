import {
  collection,
  getDocs,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase.config';
import { Psychologist } from '../models/Psychologist';

const COLLECTION = 'psychologists';

export async function getAvailablePsychologists(): Promise<Psychologist[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('isAvailable', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate(),
    })) as Psychologist[];
  } catch (error) {
    throw new Error(`Error fetching psychologists: ${error}`);
  }
}

export async function upsertPsychologist(
  psychologist: Psychologist
): Promise<void> {
  try {
    const ref = doc(db, COLLECTION, psychologist.id);
    await setDoc(ref, psychologist, { merge: true });
  } catch (error) {
    throw new Error(`Error upserting psychologist: ${error}`);
  }
}

export function listenToPsychologistAvailability(
  psychologistId: string,
  callback: (psychologist: Psychologist | null) => void
): Unsubscribe {
  const ref = doc(db, COLLECTION, psychologistId);
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback({ id: snapshot.id, ...snapshot.data() } as Psychologist);
  });
}
