export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeConfigurationError';
  }
}

let cachedApiOrigin: string | null = null;

export function getApiOrigin(): string {
  if (cachedApiOrigin) return cachedApiOrigin;

  const configuredValue = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!configuredValue) {
    throw new RuntimeConfigurationError(
      'EXPO_PUBLIC_API_URL es obligatoria. Configura el origen del backend en el archivo .env.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredValue);
  } catch {
    throw new RuntimeConfigurationError('EXPO_PUBLIC_API_URL debe ser una URL válida.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new RuntimeConfigurationError('EXPO_PUBLIC_API_URL debe usar HTTP o HTTPS.');
  }
  if (!__DEV__ && parsed.protocol !== 'https:') {
    throw new RuntimeConfigurationError('EXPO_PUBLIC_API_URL debe usar HTTPS fuera de desarrollo.');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new RuntimeConfigurationError(
      'EXPO_PUBLIC_API_URL no debe contener credenciales, parámetros ni fragmentos.'
    );
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new RuntimeConfigurationError(
      'EXPO_PUBLIC_API_URL debe contener únicamente el origen, sin rutas como /api.'
    );
  }

  cachedApiOrigin = parsed.origin;
  return cachedApiOrigin;
}

export function getLegacyApiBaseUrl(): string {
  return `${getApiOrigin()}/api`;
}

export function getVersionOneApiBaseUrl(): string {
  return `${getApiOrigin()}/api/v1`;
}
