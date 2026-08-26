import { create } from 'zustand';
import { storageHelper } from '../services/storageHelper';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  role: 'patient' | 'psychologist';
  photoURL?: string;
  phone?: string;
  specialty?: string;
  bio?: string;
}

interface AuthState {
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: 'patient' | 'psychologist' | null;

  setUserProfile: (profile: UserProfile | null) => void;
  clearAuth: () => void;
}

const PROFILE_KEY = 'ruta_emocional_user_profile';

function loadInitialProfile(): UserProfile | null {
  try {
    const raw = storageHelper.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const initialProfile = loadInitialProfile();

export const useAuthStore = create<AuthState>((set) => ({
  userProfile: initialProfile,
  isLoading: false,
  isAuthenticated: !!initialProfile,
  role: initialProfile?.role ?? null,

  setUserProfile: (profile) => {
    if (profile) {
      storageHelper.setItem(PROFILE_KEY, JSON.stringify(profile));
    } else {
      storageHelper.removeItem(PROFILE_KEY);
    }
    set({
      userProfile: profile,
      isAuthenticated: !!profile,
      role: profile?.role ?? null,
      isLoading: false,
    });
  },

  clearAuth: () => {
    storageHelper.removeItem(PROFILE_KEY);
    storageHelper.removeItem('ruta_emocional_auth_token');
    set({
      userProfile: null,
      isAuthenticated: false,
      role: null,
      isLoading: false,
    });
  },
}));
