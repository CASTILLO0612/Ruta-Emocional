import { Platform } from 'react-native';

const memoryStorage = new Map<string, string>();

function getWebSessionStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const transientStorage = {
  getItem(key: string): string | null {
    try {
      const webValue = getWebSessionStorage()?.getItem(key);
      return webValue ?? memoryStorage.get(key) ?? null;
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      getWebSessionStorage()?.setItem(key, value);
    } catch {
      // La copia en memoria mantiene el estado de la sesión actual.
    }
    memoryStorage.set(key, value);
  },

  removeItem(key: string): void {
    try {
      getWebSessionStorage()?.removeItem(key);
    } catch {
      // La copia en memoria se elimina aunque el navegador bloquee sessionStorage.
    }
    memoryStorage.delete(key);
  },
};
