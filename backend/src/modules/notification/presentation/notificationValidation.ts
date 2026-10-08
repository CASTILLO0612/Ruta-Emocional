import { AppError } from '../../../shared/domain/appError';
import type { RegisterPushDeviceInput } from '../domain/notificationTypes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPO_PUSH_TOKEN_PATTERN = /^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{8,200}\]$/;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw AppError.badRequest('INVALID_NOTIFICATION_DEVICE', 'Revisa los datos del dispositivo.');
  }
  return value as Record<string, unknown>;
}

export function parsePushDevice(value: unknown): RegisterPushDeviceInput {
  const input = record(value);
  if (typeof input.installationId !== 'string' || !UUID_PATTERN.test(input.installationId)) {
    throw AppError.badRequest('INVALID_INSTALLATION_ID', 'No pudimos identificar este dispositivo.');
  }
  if (typeof input.expoPushToken !== 'string' || !EXPO_PUSH_TOKEN_PATTERN.test(input.expoPushToken)) {
    throw AppError.badRequest('INVALID_PUSH_TOKEN', 'No pudimos registrar las notificaciones.');
  }
  if (input.platform !== 'ANDROID' && input.platform !== 'IOS') {
    throw AppError.badRequest('INVALID_PUSH_PLATFORM', 'La plataforma no es compatible.');
  }
  return {
    installationId: input.installationId.toLowerCase(),
    expoPushToken: input.expoPushToken,
    platform: input.platform,
  };
}

export function parseInstallationId(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw AppError.badRequest('INVALID_INSTALLATION_ID', 'No pudimos identificar este dispositivo.');
  }
  return value.toLowerCase();
}
