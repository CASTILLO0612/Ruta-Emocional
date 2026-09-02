import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'ruta-emocional.refresh-token.v1';
const KEYCHAIN_SERVICE = 'ruta-emocional.authentication';

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: KEYCHAIN_SERVICE,
};

let webMemoryRefreshToken: string | null = null;

function usesNativeSecureStorage(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

export async function readRefreshToken(): Promise<string | null> {
  if (!usesNativeSecureStorage()) return webMemoryRefreshToken;

  const available = await SecureStore.isAvailableAsync();
  if (!available) throw new Error('El almacenamiento seguro no está disponible en este dispositivo.');
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions);
}

export async function writeRefreshToken(refreshToken: string): Promise<void> {
  if (!usesNativeSecureStorage()) {
    webMemoryRefreshToken = refreshToken;
    return;
  }

  const available = await SecureStore.isAvailableAsync();
  if (!available) throw new Error('El almacenamiento seguro no está disponible en este dispositivo.');
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, secureStoreOptions);
}

export async function deleteRefreshToken(): Promise<void> {
  webMemoryRefreshToken = null;
  if (!usesNativeSecureStorage()) return;

  const available = await SecureStore.isAvailableAsync();
  if (!available) throw new Error('El almacenamiento seguro no está disponible en este dispositivo.');
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions);
}
