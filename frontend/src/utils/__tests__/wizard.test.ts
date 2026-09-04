import { validateWizardStep, WizardDraft } from '../validateWizardStep';
import { mapWizardDraftToPayload } from '../mapWizardDraftToPayload';
import { generateBudgetSuggestions } from '../generateBudgetSuggestions';

describe('Wizard Utilities', () => {
  describe('validateWizardStep', () => {
    it('valida paso 1: necesidad principal', () => {
      expect(validateWizardStep(1, { proposedBudgetInput: '' } as WizardDraft)).toBe(false);
      expect(validateWizardStep(1, { primaryNeed: '  ', proposedBudgetInput: '' } as WizardDraft)).toBe(false);
      expect(validateWizardStep(1, { primaryNeed: 'Ansiedad y estrés', proposedBudgetInput: '' } as WizardDraft)).toBe(true);
    });

    it('valida paso 2: modalidad válida', () => {
      expect(validateWizardStep(2, { proposedBudgetInput: '' } as WizardDraft)).toBe(false);
      expect(validateWizardStep(2, { modality: 'chat', proposedBudgetInput: '' } as WizardDraft)).toBe(true);
      expect(validateWizardStep(2, { modality: 'call', proposedBudgetInput: '' } as WizardDraft)).toBe(true);
      expect(validateWizardStep(2, { modality: 'in-person', proposedBudgetInput: '' } as WizardDraft)).toBe(true);
    });

    it('valida paso 3: horario inmediato o programado', () => {
      expect(validateWizardStep(3, { timing: null, proposedBudgetInput: '' } as WizardDraft)).toBe(false);
      expect(validateWizardStep(3, { timing: 'immediate', proposedBudgetInput: '' } as WizardDraft)).toBe(true);

      const futureDate = new Date(Date.now() + 86400000);
      expect(validateWizardStep(3, { timing: 'scheduled', scheduledFor: futureDate, proposedBudgetInput: '' } as WizardDraft)).toBe(true);

      const pastDate = new Date(Date.now() - 86400000);
      expect(validateWizardStep(3, { timing: 'scheduled', scheduledFor: pastDate, proposedBudgetInput: '' } as WizardDraft)).toBe(false);
    });

    it('valida paso 4: presupuesto dentro de límites', () => {
      const limits = { minimumAmount: 400, maximumAmount: 1500 };
      expect(validateWizardStep(4, { proposedBudgetInput: '', timing: null } as WizardDraft, limits)).toBe(false);
      expect(validateWizardStep(4, { proposedBudgetInput: '350', timing: null, currencyCode: 'NIO' } as WizardDraft, limits)).toBe(false);
      expect(validateWizardStep(4, { proposedBudgetInput: '600', timing: null, currencyCode: 'NIO' } as WizardDraft, limits)).toBe(true);
      expect(validateWizardStep(4, { proposedBudgetInput: '2000', timing: null, currencyCode: 'NIO' } as WizardDraft, limits)).toBe(false);
    });

    it('valida paso 5 (revisión): todos los pasos deben ser válidos', () => {
      const limits = { minimumAmount: 400, maximumAmount: 1500 };
      const validDraft: WizardDraft = {
        primaryNeed: 'Ansiedad',
        modality: 'chat',
        timing: 'immediate',
        proposedBudgetInput: '600',
        currencyCode: 'NIO',
      };

      expect(validateWizardStep(5, validDraft, limits)).toBe(true);

      const invalidDraft: WizardDraft = {
        ...validDraft,
        proposedBudgetInput: '200', // menor al mínimo
      };
      expect(validateWizardStep(5, invalidDraft, limits)).toBe(false);
    });
  });

  describe('mapWizardDraftToPayload', () => {
    it('mapea correctamente un borrador inmediato sin scheduledFor', () => {
      const draft: WizardDraft = {
        primaryNeed: 'Duelo familiar',
        description: 'Detalle adicional opcional',
        modality: 'chat',
        timing: 'immediate',
        proposedBudgetInput: '500',
        currencyCode: 'NIO',
      };

      const payload = mapWizardDraftToPayload(draft);
      expect(payload).toEqual({
        modality: 'chat',
        proposedBudget: 500,
        currencyCode: 'NIO',
        primaryNeed: 'Duelo familiar',
        description: 'Detalle adicional opcional',
      });
      expect(payload.scheduledFor).toBeUndefined();
    });

    it('mapea correctamente un borrador programado con fecha', () => {
      const scheduleDate = new Date('2026-09-15T15:00:00Z');
      const draft: WizardDraft = {
        primaryNeed: 'Terapia de pareja',
        modality: 'in-person',
        timing: 'scheduled',
        scheduledFor: scheduleDate,
        proposedBudgetInput: '800',
        currencyCode: 'USD',
      };

      const payload = mapWizardDraftToPayload(draft);
      expect(payload.modality).toBe('in-person');
      expect(payload.proposedBudget).toBe(800);
      expect(payload.currencyCode).toBe('USD');
      expect(payload.scheduledFor).toBe(scheduleDate);
    });

    it('rechaza el borrador si la política no proporcionó una moneda', () => {
      expect(() => mapWizardDraftToPayload({
        primaryNeed: 'Ansiedad',
        modality: 'chat',
        timing: 'immediate',
        proposedBudgetInput: '500',
      })).toThrow('La moneda debe provenir de la configuración');
    });
  });

  describe('generateBudgetSuggestions', () => {
    it('genera chips dentro del rango de la política', () => {
      const suggestions = generateBudgetSuggestions({
        minimumAmount: 400,
        maximumAmount: 1000,
      });

      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      expect(suggestions[0]).toBeGreaterThanOrEqual(400);
      expect(suggestions[suggestions.length - 1]).toBeLessThanOrEqual(1000);
    });
  });
});
