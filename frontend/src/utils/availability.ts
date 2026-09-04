import { DEFAULT_AVAILABILITY_INTERVAL, MINUTES_PER_DAY } from '../config/availability';
import type { WeeklyAvailabilityRule } from '../models/ProfessionalProfile';

export const WEEKDAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

export interface AvailabilityValidation {
  readonly isValid: boolean;
  readonly errorsByWeekday: Readonly<Record<number, string>>;
}

export function normalizeClockTime(value: string): string | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function clockMinutes(value: string): number | null {
  const normalized = normalizeClockTime(value);
  if (!normalized) return null;
  const [hour, minute] = normalized.split(':').map(Number);
  return hour * 60 + minute;
}

export function sortAvailabilityRules<T extends WeeklyAvailabilityRule>(
  rules: readonly T[]
): readonly T[] {
  return [...rules].sort((left, right) => (
    left.weekday - right.weekday || left.startTime.localeCompare(right.startTime)
  ));
}

export function groupAvailabilityRules(
  rules: readonly WeeklyAvailabilityRule[]
): ReadonlyMap<number, readonly WeeklyAvailabilityRule[]> {
  const grouped = new Map<number, WeeklyAvailabilityRule[]>();
  for (const rule of sortAvailabilityRules(rules.filter(({ isActive }) => isActive))) {
    const dayRules = grouped.get(rule.weekday) ?? [];
    dayRules.push(rule);
    grouped.set(rule.weekday, dayRules);
  }
  return grouped;
}

export function validateAvailabilityRules(
  rules: readonly WeeklyAvailabilityRule[]
): AvailabilityValidation {
  const errorsByWeekday: Record<number, string> = {};
  const grouped = groupAvailabilityRules(rules);

  for (const [weekday, dayRules] of grouped) {
    const ranges = dayRules.map((rule) => ({
      start: clockMinutes(rule.startTime),
      end: clockMinutes(rule.endTime),
    }));

    if (ranges.some(({ start, end }) => start === null || end === null || start >= end)) {
      errorsByWeekday[weekday] = 'Revisa que cada intervalo tenga una hora de inicio y fin válida.';
      continue;
    }

    const ordered = ranges
      .map(({ start, end }) => ({ start: start!, end: end! }))
      .sort((left, right) => left.start - right.start);
    if (ordered.some((range, index) => index > 0 && range.start < ordered[index - 1].end)) {
      errorsByWeekday[weekday] = 'Los intervalos de este día no pueden superponerse.';
    }
  }

  return {
    isValid: Object.keys(errorsByWeekday).length === 0,
    errorsByWeekday,
  };
}

function toClock(minutes: number): string {
  const normalized = Math.max(0, Math.min(minutes, MINUTES_PER_DAY - 1));
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function createAvailabilityRule(
  weekday: number,
  existingRules: readonly WeeklyAvailabilityRule[] = []
): WeeklyAvailabilityRule {
  const latestEnd = existingRules
    .map(({ endTime }) => clockMinutes(endTime))
    .filter((value): value is number => value !== null)
    .sort((left, right) => right - left)[0];

  if (latestEnd !== undefined && latestEnd < MINUTES_PER_DAY - 1) {
    return {
      weekday,
      startTime: toClock(latestEnd),
      endTime: toClock(Math.min(latestEnd + 60, MINUTES_PER_DAY - 1)),
      isActive: true,
    };
  }

  return {
    weekday,
    ...DEFAULT_AVAILABILITY_INTERVAL,
    isActive: true,
  };
}

export function canAppendAvailabilityInterval(
  existingRules: readonly WeeklyAvailabilityRule[]
): boolean {
  if (existingRules.length === 0) return true;
  const ends = existingRules.map(({ endTime }) => clockMinutes(endTime));
  return ends.every((value): value is number => value !== null)
    && Math.max(...ends) < MINUTES_PER_DAY - 1;
}

export function formatAvailabilityInterval(rule: WeeklyAvailabilityRule): string {
  return `${rule.startTime.slice(0, 5)}–${rule.endTime.slice(0, 5)}`;
}
