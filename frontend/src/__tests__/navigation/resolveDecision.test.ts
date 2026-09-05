import { resolveAcceptedOfferDecision } from '../../navigation/resolveAcceptedOfferDecision';

describe('resolveAcceptedOfferDecision', () => {
  it('resuelve SHOW_CONFIRMATION para cualquier modalidad programada a futuro', () => {
    const futureDate = new Date(Date.now() + 86400000);
    expect(
      resolveAcceptedOfferDecision({
        modality: 'chat',
        scheduledFor: futureDate,
        conversationId: 'conv-1',
      })
    ).toEqual({ type: 'SHOW_CONFIRMATION' });

    expect(
      resolveAcceptedOfferDecision({
        modality: 'call',
        scheduledFor: futureDate.toISOString(),
        conversationId: 'conv-2',
      })
    ).toEqual({ type: 'SHOW_CONFIRMATION' });
  });

  it('resuelve SHOW_CONFIRMATION para modalidad in-person incluso si es inmediata', () => {
    expect(
      resolveAcceptedOfferDecision({
        modality: 'in-person',
        conversationId: 'conv-3',
      })
    ).toEqual({ type: 'SHOW_CONFIRMATION' });
  });

  it('resuelve IMMEDIATE_CHAT para chat inmediato', () => {
    expect(
      resolveAcceptedOfferDecision({
        modality: 'chat',
        conversationId: 'conv-4',
      })
    ).toEqual({ type: 'IMMEDIATE_CHAT', conversationId: 'conv-4' });
  });

  it('resuelve SHOW_CONFIRMATION para llamada inmediata sin una sala RTC real', () => {
    expect(
      resolveAcceptedOfferDecision({
        modality: 'call',
        conversationId: 'conv-5',
      })
    ).toEqual({ type: 'SHOW_CONFIRMATION' });
  });
});
