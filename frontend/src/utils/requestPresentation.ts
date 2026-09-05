import { APP_LOCALE } from '../config/localization';
import type { ActiveRequest } from '../models/ActiveRequest';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function getRequestDisplayTitle(request: ActiveRequest): string {
  return request.primaryNeed?.trim() || 'Acompañamiento general';
}

export function formatRequestAge(
  createdAt: Date | string | number,
  now: Date = new Date()
): string {
  const createdDate = new Date(createdAt);
  const elapsed = now.getTime() - createdDate.getTime();

  if (!Number.isFinite(elapsed) || elapsed < MINUTE_MS) return 'Ahora';
  if (elapsed < HOUR_MS) return `Hace ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `Hace ${Math.floor(elapsed / HOUR_MS)} h`;

  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
  }).format(createdDate);
}

export function formatRequestedMoment(request: ActiveRequest): string {
  if (!request.scheduledFor) return 'Atención lo antes posible';

  const scheduledDate = new Date(request.scheduledFor);
  if (Number.isNaN(scheduledDate.getTime())) return 'Horario por confirmar';

  return new Intl.DateTimeFormat(APP_LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(scheduledDate);
}
