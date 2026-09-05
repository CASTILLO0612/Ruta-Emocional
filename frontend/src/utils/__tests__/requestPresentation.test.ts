import type { ActiveRequest } from '../../models/ActiveRequest';
import {
  formatRequestAge,
  formatRequestedMoment,
  getRequestDisplayTitle,
} from '../requestPresentation';

const baseRequest: ActiveRequest = {
  id: 'request-1',
  modality: 'chat',
  proposedBudget: 500,
  currencyCode: 'NIO',
  status: 'pending',
  expiresAt: new Date('2026-09-02T18:00:00'),
  createdAt: new Date('2026-09-02T10:00:00'),
};

describe('requestPresentation', () => {
  it('prioriza la necesidad real y usa un fallback neutro', () => {
    expect(getRequestDisplayTitle({ ...baseRequest, primaryNeed: '  Ansiedad  ' }))
      .toBe('Ansiedad');
    expect(getRequestDisplayTitle(baseRequest)).toBe('Acompañamiento general');
  });

  it('presenta la antigüedad sin exponer precisión innecesaria', () => {
    const now = new Date('2026-09-02T12:00:00');
    expect(formatRequestAge(new Date('2026-09-02T11:59:30'), now)).toBe('Ahora');
    expect(formatRequestAge(new Date('2026-09-02T11:45:00'), now)).toBe('Hace 15 min');
    expect(formatRequestAge(new Date('2026-09-02T10:00:00'), now)).toBe('Hace 2 h');
  });

  it('distingue atención inmediata de una fecha solicitada', () => {
    expect(formatRequestedMoment(baseRequest)).toBe('Atención lo antes posible');
    expect(formatRequestedMoment({
      ...baseRequest,
      scheduledFor: new Date('2026-09-03T15:30:00'),
    })).not.toBe('Atención lo antes posible');
  });
});
