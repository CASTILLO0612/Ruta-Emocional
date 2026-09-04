/**
 * prioritizeHomeSections — Jerarquía dinámica y honesta del Inicio del paciente.
 *
 * Principio rector:
 * - Ningún bloque vacío ocupa espacio en pantalla.
 * - Una sola acción primaria visible («Buscar acompañamiento»).
 * - Máximo 2 profesionales en el preview del directorio.
 * - MENTA solo aparece si existe una fuente real y verificada en el estado.
 */
import type { ActiveRequest } from '../models/ActiveRequest';
import type { Offer } from '../models/Offer';
import type { Psychologist } from '../models/Psychologist';

export interface HomeAppointment {
  readonly id: string;
  readonly professionalName: string;
  readonly professionalPhotoURL?: string;
  readonly scheduledFor: Date;
  readonly modality: string;
}

export interface HomeStateInputs {
  readonly userName?: string;
  readonly activeRequest?: ActiveRequest | null;
  readonly incomingOffers?: readonly Offer[];
  readonly nextAppointment?: HomeAppointment | null;
  readonly featuredPsychologists?: readonly Psychologist[];
}

export type HomeSection =
  | { readonly id: 'greeting'; readonly type: 'GREETING'; readonly userName: string }
  | {
      readonly id: 'pending_decision';
      readonly type: 'PENDING_DECISION';
      readonly offerCount: number;
      readonly topOffer?: Offer;
      readonly request: ActiveRequest;
    }
  | {
      readonly id: 'next_appointment';
      readonly type: 'NEXT_APPOINTMENT';
      readonly appointment: HomeAppointment;
    }
  | { readonly id: 'primary_action'; readonly type: 'PRIMARY_ACTION' }
  | {
      readonly id: 'menta_suggestion';
      readonly type: 'MENTA_SUGGESTION';
      readonly text: string;
      readonly targetRoute: 'Search' | 'Radar' | 'Appointments' | 'MentaAgent';
    }
  | {
      readonly id: 'directory_preview';
      readonly type: 'DIRECTORY_PREVIEW';
      readonly professionals: readonly Psychologist[];
    };

export function prioritizeHomeSections(inputs: HomeStateInputs): HomeSection[] {
  const sections: HomeSection[] = [];

  // 1. Saludo contextual
  sections.push({
    id: 'greeting',
    type: 'GREETING',
    userName: inputs.userName?.trim() || 'Paciente',
  });

  // 2. Decisión pendiente (oferta no expirada esperando respuesta)
  const pendingOffers = inputs.incomingOffers?.filter((o) => o.status === 'pending') ?? [];
  const hasActionableOffer =
    inputs.activeRequest &&
    (inputs.activeRequest.status === 'bidding' || inputs.activeRequest.status === 'pending') &&
    pendingOffers.length > 0;

  if (hasActionableOffer && inputs.activeRequest) {
    sections.push({
      id: 'pending_decision',
      type: 'PENDING_DECISION',
      offerCount: pendingOffers.length,
      topOffer: pendingOffers[0],
      request: inputs.activeRequest,
    });
  }

  // 3. Próxima cita real confirmada
  if (inputs.nextAppointment) {
    sections.push({
      id: 'next_appointment',
      type: 'NEXT_APPOINTMENT',
      appointment: inputs.nextAppointment,
    });
  }

  // 4. La decisión pendiente ya es la acción dominante. Evita dos CTA primarios simultáneos.
  if (!hasActionableOffer) {
    sections.push({
      id: 'primary_action',
      type: 'PRIMARY_ACTION',
    });
  }

  // 5. Sugerencia contextual MENTA (Honesta, sin respuestas clínicas simuladas)
  if (hasActionableOffer) {
    sections.push({
      id: 'menta_suggestion',
      type: 'MENTA_SUGGESTION',
      text: 'Tienes una oferta pendiente. Puedes revisarla o consultarle a MENTA qué aspectos considerar.',
      targetRoute: 'Radar',
    });
  } else if (inputs.nextAppointment) {
    sections.push({
      id: 'menta_suggestion',
      type: 'MENTA_SUGGESTION',
      text: 'MENTA puede ayudarte a preparar tu próxima consulta.',
      targetRoute: 'MentaAgent',
    });
  }

  // 6. Preview breve del directorio; la búsqueda contiene el listado completo.
  const previewPsychologists = inputs.featuredPsychologists?.slice(0, 2) ?? [];
  if (previewPsychologists.length > 0) {
    sections.push({
      id: 'directory_preview',
      type: 'DIRECTORY_PREVIEW',
      professionals: previewPsychologists,
    });
  }

  return sections;
}
