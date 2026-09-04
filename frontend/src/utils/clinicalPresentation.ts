import type {
  ClinicalNote,
  TreatmentGoalStatus,
  TreatmentPlan,
} from '../repositories/ClinicalRecordRepository';
import { APP_LOCALE } from '../config/localization';

export const NOTE_STATUS_LABELS: Readonly<Record<ClinicalNote['status'], string>> = {
  DRAFT: 'Borrador',
  SIGNED: 'Firmada',
  AMENDED: 'Enmendada',
};

export const PLAN_STATUS_LABELS: Readonly<Record<TreatmentPlan['status'], string>> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export const GOAL_STATUS_LABELS: Readonly<Record<TreatmentGoalStatus, string>> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  ACHIEVED: 'Alcanzado',
  CANCELLED: 'Cancelado',
};

export function formatClinicalDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';

  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getNextGoalStatus(status: TreatmentGoalStatus): TreatmentGoalStatus | null {
  if (status === 'PENDING') return 'IN_PROGRESS';
  if (status === 'IN_PROGRESS') return 'ACHIEVED';
  return null;
}
