export interface SchedulePolicy {
  readonly leadMinutes: number;
  readonly maximumScheduleDays: number;
}

export type ScheduleValidationResult =
  | { readonly isValid: true }
  | { readonly isValid: false; readonly message: string };

export function normalizeDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join('/');
}

export function normalizeTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return [digits.slice(0, 2), digits.slice(2, 4)].filter(Boolean).join(':');
}

export function parseLocalSchedule(dateInput: string, timeInput: string): Date | null {
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateInput);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeInput);
  if (!dateMatch || !timeMatch) return null;

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours > 23 || minutes > 59) return null;

  const result = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    result.getFullYear() !== year
    || result.getMonth() !== month - 1
    || result.getDate() !== day
  ) {
    return null;
  }
  return result;
}

export function validateScheduledDate(
  value: Date,
  policy: SchedulePolicy,
  now: Date = new Date()
): ScheduleValidationResult {
  if (Number.isNaN(value.getTime())) {
    return { isValid: false, message: 'Ingresa una fecha y hora válidas.' };
  }

  const earliest = now.getTime() + policy.leadMinutes * 60_000;
  if (value.getTime() < earliest) {
    return {
      isValid: false,
      message: `El horario debe tener al menos ${policy.leadMinutes} minutos de anticipación.`,
    };
  }

  const latest = now.getTime() + policy.maximumScheduleDays * 86_400_000;
  if (value.getTime() > latest) {
    return {
      isValid: false,
      message: `Puedes programar con un máximo de ${policy.maximumScheduleDays} días de anticipación.`,
    };
  }

  return { isValid: true };
}
