import { create } from 'zustand';
import {
  CurrentUser,
  getCurrentUser,
  RegisterUserInput,
  UserRole,
  registerUser as registerUserRequest,
  restoreSession,
  setSessionInvalidHandler,
  signIn as signInRequest,
  signOutAllSessions,
  signOutUser,
} from '../services/AuthService';
import { ApiError } from '../services/apiClient';
import { presentUserError } from '../utils/userFacingError';
import { useRequestStore } from './useRequestStore';

export interface UserProfile extends CurrentUser {
  readonly role: UserRole;
  readonly photoURL?: string;
  readonly phone?: string;
  readonly specialty?: string;
  readonly bio?: string;
}

interface AuthState {
  readonly userProfile: UserProfile | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly role: UserRole | null;
  readonly initializationError: string | null;
  initializeSession: () => Promise<void>;
  authenticate: (email: string, password: string) => Promise<void>;
  registerAccount: (input: RegisterUserInput) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
  setUserProfile: (profile: UserProfile) => void;
  hasCapability: (capability: string) => boolean;
}

let initializationInFlight: Promise<void> | null = null;

const anonymousState = {
  userProfile: null,
  isAuthenticated: false,
  role: null,
} as const;

function toUserProfile(user: CurrentUser, previous?: UserProfile | null): UserProfile {
  const role = user.roles.includes('psychologist')
    ? 'psychologist'
    : user.roles.includes('patient')
      ? 'patient'
      : null;
  if (!role) {
    throw new ApiError({
      status: 403,
      code: 'UNSUPPORTED_APP_ROLE',
      message: 'Esta cuenta no tiene un rol compatible con la aplicación móvil.',
    });
  }

  return {
    ...user,
    role,
    photoURL: user.photoUrl ?? undefined,
    phone: previous?.phone,
    specialty: previous?.specialty,
    bio: previous?.bio,
  };
}

async function adoptAuthenticatedUser(user: CurrentUser): Promise<UserProfile> {
  try {
    return toUserProfile(user);
  } catch (error) {
    try {
      await signOutUser();
    } catch {
    }
    throw error;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...anonymousState,
  isLoading: true,
  initializationError: null,

  initializeSession: async () => {
    if (initializationInFlight) return initializationInFlight;

    initializationInFlight = (async () => {
      set({ isLoading: true, initializationError: null });
      try {
        const user = await restoreSession();
        if (!user) {
          await useRequestStore.getState().clearSession();
          set({ ...anonymousState, isLoading: false });
          return;
        }
        const profile = toUserProfile(user);
        useRequestStore.getState().bindSession(profile.id);
        set({
          userProfile: profile,
          isAuthenticated: true,
          role: profile.role,
          isLoading: false,
          initializationError: null,
        });
      } catch (error) {
        const unsupportedRole = error instanceof ApiError && error.code === 'UNSUPPORTED_APP_ROLE';
        if (unsupportedRole) {
          try {
            await signOutUser();
          } catch {
          }
        }
        set({
          ...anonymousState,
          isLoading: false,
          initializationError: presentUserError(error, 'No pudimos restaurar la sesión.'),
        });
      }
    })();

    try {
      await initializationInFlight;
    } finally {
      initializationInFlight = null;
    }
  },

  authenticate: async (email, password) => {
    const user = await signInRequest(email, password);
    const profile = await adoptAuthenticatedUser(user);
    useRequestStore.getState().bindSession(profile.id);
    set({
      userProfile: profile,
      isAuthenticated: true,
      role: profile.role,
      initializationError: null,
    });
  },

  registerAccount: async (input) => {
    const user = await registerUserRequest(input);
    const profile = await adoptAuthenticatedUser(user);
    useRequestStore.getState().bindSession(profile.id);
    set({
      userProfile: profile,
      isAuthenticated: true,
      role: profile.role,
      initializationError: null,
    });
  },

  refreshProfile: async () => {
    const user = await getCurrentUser();
    const profile = toUserProfile(user, get().userProfile);
    useRequestStore.getState().bindSession(profile.id);
    set({
      userProfile: profile,
      isAuthenticated: true,
      role: profile.role,
      initializationError: null,
    });
  },

  signOut: async () => {
    const userId = get().userProfile?.id;
    const clearRequestSession = useRequestStore.getState().clearSession(userId);
    try {
      await signOutUser();
    } finally {
      await clearRequestSession;
      set({ ...anonymousState, isLoading: false, initializationError: null });
    }
  },

  signOutAll: async () => {
    const userId = get().userProfile?.id;
    const clearRequestSession = useRequestStore.getState().clearSession(userId);
    try {
      await signOutAllSessions();
    } finally {
      await clearRequestSession;
      set({ ...anonymousState, isLoading: false, initializationError: null });
    }
  },

  setUserProfile: (profile) => {
    useRequestStore.getState().bindSession(profile.id);
    set({
      userProfile: profile,
      isAuthenticated: true,
      role: profile.role,
    });
  },

  hasCapability: (capability) => get().userProfile?.capabilities.includes(capability) ?? false,
}));

setSessionInvalidHandler(() => {
  const userId = useAuthStore.getState().userProfile?.id;
  void useRequestStore.getState().clearSession(userId);
  useAuthStore.setState({
    ...anonymousState,
    isLoading: false,
    initializationError: null,
  });
});
