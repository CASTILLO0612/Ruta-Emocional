import type { Modality } from '../models/Psychologist';

export interface AcceptedOfferDecisionInput {
  readonly modality: Modality;
  readonly scheduledFor?: string | Date;
  readonly conversationId: string;
}

export type AcceptedOfferNextAction =
  | { readonly type: 'IMMEDIATE_CHAT'; readonly conversationId: string }
  | { readonly type: 'SHOW_CONFIRMATION' };

export function resolveAcceptedOfferDecision(
  input: AcceptedOfferDecisionInput
): AcceptedOfferNextAction {
  if (input.scheduledFor) {
    const scheduledTime =
      typeof input.scheduledFor === 'string'
        ? new Date(input.scheduledFor).getTime()
        : input.scheduledFor.getTime();

    if (!isNaN(scheduledTime) && scheduledTime - Date.now() > 15 * 60 * 1000) {
      return { type: 'SHOW_CONFIRMATION' };
    }
  }

  if (input.modality === 'in-person') {
    return { type: 'SHOW_CONFIRMATION' };
  }

  if (input.modality === 'chat') {
    return { type: 'IMMEDIATE_CHAT', conversationId: input.conversationId };
  }

  return { type: 'SHOW_CONFIRMATION' };
}
