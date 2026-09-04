/**
 * resolveAcceptedOfferDecision — Resolver puro de decisión post-aceptación.
 *
 * Principio rector:
 * - in-person o programada -> SHOW_CONFIRMATION (resumen de cita y fecha/lugar).
 * - chat inmediato -> IMMEDIATE_CHAT (iniciar conversación en Consultation).
 * - call inmediata -> SHOW_CONFIRMATION hasta disponer de una sala RTC real.
 */
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
  // Si tiene fecha programada en el futuro (más de 15 minutos en adelante), siempre es confirmación
  if (input.scheduledFor) {
    const scheduledTime =
      typeof input.scheduledFor === 'string'
        ? new Date(input.scheduledFor).getTime()
        : input.scheduledFor.getTime();

    if (!isNaN(scheduledTime) && scheduledTime - Date.now() > 15 * 60 * 1000) {
      return { type: 'SHOW_CONFIRMATION' };
    }
  }

  // Si es atención presencial, requiere confirmación de cita
  if (input.modality === 'in-person') {
    return { type: 'SHOW_CONFIRMATION' };
  }

  // Chat inmediato
  if (input.modality === 'chat') {
    return { type: 'IMMEDIATE_CHAT', conversationId: input.conversationId };
  }

  return { type: 'SHOW_CONFIRMATION' };
}
