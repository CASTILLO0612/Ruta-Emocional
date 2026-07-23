import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase.config';
import { User } from '../models/User';

const COLLECTION = 'users';

export async function upsertUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<void> {
  try {
    const ref = doc(db, COLLECTION, user.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await setDoc(ref, { ...user, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      await setDoc(ref, {
        ...user,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    throw new Error(`Error upserting user: ${error}`);
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const ref = doc(db, COLLECTION, userId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    return {
      id: snapshot.id,
      ...snapshot.data(),
      createdAt: snapshot.data().createdAt?.toDate(),
      updatedAt: snapshot.data().updatedAt?.toDate(),
    } as User;
  } catch (error) {
    throw new Error(`Error fetching user: ${error}`);
  }
}
