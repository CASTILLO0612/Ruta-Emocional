import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '../models/User';
import { onAuthChange } from '../services/AuthService';
import { getUserById } from '../repositories/UserRepository';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  userProfile: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: 'patient' | 'psychologist' | null;

  setFirebaseUser: (user: FirebaseUser | null) => void;
  setUserProfile: (profile: User | null) => void;
  initializeAuth: () => () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  userProfile: null,
  isLoading: true,
  isAuthenticated: false,
  role: null,

  setFirebaseUser: (user) =>
    set({ firebaseUser: user, isAuthenticated: !!user }),

  setUserProfile: (profile) =>
    set({ userProfile: profile, role: profile?.role ?? null }),

  initializeAuth: () => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        set({ firebaseUser, isAuthenticated: true });
        try {
          const profile = await getUserById(firebaseUser.uid);
          set({ userProfile: profile, role: profile?.role ?? null, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      } else {
        set({
          firebaseUser: null,
          userProfile: null,
          isAuthenticated: false,
          role: null,
          isLoading: false,
        });
      }
    });
    return unsubscribe;
  },

  clearAuth: () =>
    set({
      firebaseUser: null,
      userProfile: null,
      isAuthenticated: false,
      role: null,
    }),
}));
