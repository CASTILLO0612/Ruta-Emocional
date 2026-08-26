import { Platform } from 'react-native';

let memoryStorage: Record<string, string> = {};

export const storageHelper = {
  getItem: (key: string): string | null => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return memoryStorage[key] || null;
    } catch {
      return memoryStorage[key] || null;
    }
  },

  setItem: (key: string, value: string): void => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      memoryStorage[key] = value;
    } catch {
      memoryStorage[key] = value;
    }
  },

  removeItem: (key: string): void => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      delete memoryStorage[key];
    } catch {
      delete memoryStorage[key];
    }
  },
};
