import {
  formatClinicalDate,
  getNextGoalStatus,
  GOAL_STATUS_LABELS,
  NOTE_STATUS_LABELS,
  PLAN_STATUS_LABELS,
} from '../clinicalPresentation';

describe('clinicalPresentation', () => {
  it('mantiene etiquetas clínicas completas y comprensibles', () => {
    expect(NOTE_STATUS_LABELS).toEqual({
      DRAFT: 'Borrador',
      SIGNED: 'Firmada',
      AMENDED: 'Enmendada',
    });
    expect(PLAN_STATUS_LABELS.CANCELLED).toBe('Cancelado');
    expect(GOAL_STATUS_LABELS.IN_PROGRESS).toBe('En progreso');
  });

  it('solo permite el avance lineal de objetivos abiertos', () => {
    expect(getNextGoalStatus('PENDING')).toBe('IN_PROGRESS');
    expect(getNextGoalStatus('IN_PROGRESS')).toBe('ACHIEVED');
    expect(getNextGoalStatus('ACHIEVED')).toBeNull();
    expect(getNextGoalStatus('CANCELLED')).toBeNull();
  });

  it('degrada con seguridad cuando recibe una fecha inválida', () => {
    expect(formatClinicalDate('fecha-invalida')).toBe('Fecha no disponible');
  });
});
