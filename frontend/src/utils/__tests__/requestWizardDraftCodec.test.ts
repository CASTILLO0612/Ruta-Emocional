import {
  decodeRequestWizardDraft,
  encodeRequestWizardDraft,
} from '../requestWizardDraftCodec';

describe('requestWizardDraftCodec', () => {
  it('conserva la fecha y los campos del asistente de solicitud', () => {
    const scheduledFor = new Date('2099-09-20T14:00:00.000Z');
    const encoded = encodeRequestWizardDraft({
      primaryNeed: 'Ansiedad y estrés',
      description: 'Necesito acompañamiento',
      modality: 'in-person',
      timing: 'scheduled',
      scheduledFor,
      proposedBudgetInput: '500',
      currencyCode: 'NIO',
    });

    expect(decodeRequestWizardDraft(encoded)).toEqual({
      primaryNeed: 'Ansiedad y estrés',
      description: 'Necesito acompañamiento',
      modality: 'in-person',
      timing: 'scheduled',
      scheduledFor,
      proposedBudgetInput: '500',
      currencyCode: 'NIO',
    });
  });

  it('descarta contenido alterado o incompatible', () => {
    expect(decodeRequestWizardDraft('{"version":2}')).toBeNull();
    expect(decodeRequestWizardDraft('contenido inválido')).toBeNull();
  });
});
