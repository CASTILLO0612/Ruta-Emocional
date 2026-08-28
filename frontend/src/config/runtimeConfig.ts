export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeConfigurationError';
  }
}

let cachedApiOrigin: string | null = null;
let cachedDirectoryMapConfig: DirectoryMapConfig | null = null;
let cachedRequestPollingConfig: RequestPollingConfig | null = null;

export interface DirectoryMapConfig {
  readonly radiusKm: number;
  readonly latitudeDelta: number;
  readonly longitudeDelta: number;
}

export interface RequestPollingConfig {
  readonly intervalMs: number;
}

function requiredPositiveNumber(rawValue: string | undefined, name: string): number {
  const raw = rawValue?.trim();
  const value = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || value <= 0) {
    throw new RuntimeConfigurationError(`${name} debe ser un número positivo.`);
  }
  return value;
}

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

export function getDirectoryMapConfig(): DirectoryMapConfig {
  if (cachedDirectoryMapConfig) return cachedDirectoryMapConfig;
  cachedDirectoryMapConfig = Object.freeze({
    radiusKm: requiredPositiveNumber(
      process.env.EXPO_PUBLIC_DIRECTORY_RADIUS_KM,
      'EXPO_PUBLIC_DIRECTORY_RADIUS_KM'
    ),
    latitudeDelta: requiredPositiveNumber(
      process.env.EXPO_PUBLIC_MAP_LATITUDE_DELTA,
      'EXPO_PUBLIC_MAP_LATITUDE_DELTA'
    ),
    longitudeDelta: requiredPositiveNumber(
      process.env.EXPO_PUBLIC_MAP_LONGITUDE_DELTA,
      'EXPO_PUBLIC_MAP_LONGITUDE_DELTA'
    ),
  });
  return cachedDirectoryMapConfig;
}

export function getRequestPollingConfig(): RequestPollingConfig {
  if (cachedRequestPollingConfig) return cachedRequestPollingConfig;
  const intervalMs = requiredPositiveNumber(
    process.env.EXPO_PUBLIC_REQUEST_POLL_INTERVAL_MS,
    'EXPO_PUBLIC_REQUEST_POLL_INTERVAL_MS'
  );
  if (!Number.isInteger(intervalMs) || intervalMs < 1000 || intervalMs > 60000) {
    throw new RuntimeConfigurationError(
      'EXPO_PUBLIC_REQUEST_POLL_INTERVAL_MS debe ser un entero entre 1000 y 60000.'
    );
  }
  cachedRequestPollingConfig = Object.freeze({ intervalMs });
  return cachedRequestPollingConfig;
}
