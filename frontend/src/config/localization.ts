/**
 * Configuración de presentación regional de Ruta Emocional.
 *
 * El dominio continúa intercambiando códigos ISO de moneda y fechas ISO.
 * Esta constante solo gobierna cómo se presentan esos valores al usuario.
 */
export const APP_LOCALE = 'es-NI';

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
