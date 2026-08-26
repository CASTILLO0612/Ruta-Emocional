import { apiRequest, setAuthToken } from './apiClient';

export type UserRole = 'patient' | 'psychologist';

export interface AuthResponse {
  user: {
    id: string;
    displayName: string;
    email: string;
    role: UserRole;
  };
  token: string;
}

export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
  licenseNumber?: string
): Promise<AuthResponse['user']> {
  try {
    const res = await apiRequest<AuthResponse>('/auth/register', 'POST', {
      email,
      password,
      displayName,
      role,
      licenseNumber,
    });
    setAuthToken(res.token);
    return res.user;
  } catch (error) {
    throw new Error(`Registro fallido: ${error}`);
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse['user']> {
  try {
    const res = await apiRequest<AuthResponse>('/auth/login', 'POST', {
      email,
      password,
    });
    setAuthToken(res.token);
    return res.user;
  } catch (error) {
    throw new Error(`Inicio de sesión fallido: ${error}`);
  }
}

export async function signOutUser(): Promise<void> {
  setAuthToken(null);
}
