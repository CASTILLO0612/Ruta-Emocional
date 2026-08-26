import { Platform } from 'react-native';
import { storageHelper } from './storageHelper';

export const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

const TOKEN_KEY = 'ruta_emocional_auth_token';

export function setAuthToken(token: string | null): void {
  if (token) {
    storageHelper.setItem(TOKEN_KEY, token);
  } else {
    storageHelper.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  return storageHelper.getItem(TOKEN_KEY);
}

export async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const userToken = getAuthToken();
  if (userToken) {
    headers['Authorization'] = `Bearer ${userToken}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Error en API (${response.status})`);
    }

    return data as T;
  } catch (error: any) {
    console.error(`[API Error ${method} ${endpoint}]:`, error);
    throw error;
  }
}
