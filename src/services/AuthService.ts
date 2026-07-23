import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../../firebase.config';
import { upsertUser } from '../repositories/UserRepository';

export type UserRole = 'patient' | 'psychologist';

export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  role: UserRole
): Promise<FirebaseUser> {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });

    await upsertUser({
      id: credential.user.uid,
      displayName,
      email,
      role,
    });

    return credential.user;
  } catch (error) {
    throw new Error(`Registration failed: ${error}`);
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<FirebaseUser> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    throw new Error(`Login failed: ${error}`);
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error(`Sign out failed: ${error}`);
  }
}

export function onAuthChange(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}
