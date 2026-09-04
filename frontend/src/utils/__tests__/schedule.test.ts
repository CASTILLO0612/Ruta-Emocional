import {
  normalizeDateInput,
  normalizeTimeInput,
  parseLocalSchedule,
  validateScheduledDate,
} from '../schedule';

describe('schedule utilities', () => {
  it('normaliza entradas numéricas sin inventar una fecha', () => {
    expect(normalizeDateInput('15092026')).toBe('15/09/2026');
    expect(normalizeTimeInput('1430')).toBe('14:30');
  });

  it('construye una fecha local únicamente con componentes válidos', () => {
    const result = parseLocalSchedule('15/09/2026', '14:30');
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(8);
    expect(result?.getDate()).toBe(15);
    expect(result?.getHours()).toBe(14);
    expect(result?.getMinutes()).toBe(30);
    expect(parseLocalSchedule('31/02/2026', '14:30')).toBeNull();
    expect(parseLocalSchedule('15/09/2026', '25:00')).toBeNull();
  });

  it('aplica la anticipación y el horizonte recibidos desde el backend', () => {
    const now = new Date(2026, 8, 10, 10, 0, 0, 0);
    const policy = { leadMinutes: 60, maximumScheduleDays: 10 };

    expect(validateScheduledDate(new Date(2026, 8, 10, 10, 30), policy, now).isValid)
      .toBe(false);
    expect(validateScheduledDate(new Date(2026, 8, 10, 12, 0), policy, now).isValid)
      .toBe(true);
    expect(validateScheduledDate(new Date(2026, 8, 21, 12, 0), policy, now).isValid)
      .toBe(false);
  });
});
