import {
  canAppendAvailabilityInterval,
  createAvailabilityRule,
  groupAvailabilityRules,
  normalizeClockTime,
  validateAvailabilityRules,
} from '../availability';

describe('availability', () => {
  it('normaliza horas válidas y rechaza valores fuera del reloj de 24 horas', () => {
    expect(normalizeClockTime('8:05')).toBe('08:05');
    expect(normalizeClockTime('23:59')).toBe('23:59');
    expect(normalizeClockTime('24:00')).toBeNull();
    expect(normalizeClockTime('8.30')).toBeNull();
  });

  it('detecta intervalos superpuestos por día y permite intervalos contiguos', () => {
    const overlapping = validateAvailabilityRules([
      { weekday: 1, startTime: '08:00', endTime: '12:00', isActive: true },
      { weekday: 1, startTime: '11:30', endTime: '14:00', isActive: true },
    ]);
    expect(overlapping.isValid).toBe(false);
    expect(overlapping.errorsByWeekday[1]).toContain('superponerse');

    expect(validateAvailabilityRules([
      { weekday: 1, startTime: '08:00', endTime: '12:00', isActive: true },
      { weekday: 1, startTime: '12:00', endTime: '16:00', isActive: true },
    ]).isValid).toBe(true);
  });

  it('propone un intervalo posterior y agrupa únicamente reglas activas', () => {
    expect(createAvailabilityRule(2, [
      { weekday: 2, startTime: '08:00', endTime: '12:00', isActive: true },
    ])).toEqual({
      weekday: 2,
      startTime: '12:00',
      endTime: '13:00',
      isActive: true,
    });

    const grouped = groupAvailabilityRules([
      { weekday: 2, startTime: '08:00', endTime: '12:00', isActive: true },
      { weekday: 3, startTime: '08:00', endTime: '12:00', isActive: false },
    ]);
    expect(grouped.size).toBe(1);
    expect(grouped.has(2)).toBe(true);
    expect(canAppendAvailabilityInterval([
      { weekday: 2, startTime: '22:00', endTime: '23:59', isActive: true },
    ])).toBe(false);
  });
});
