import type {
  MentaAgentReply,
  MentaScope,
  MentaToolCode,
  MentaToolExecution,
} from './mentaTypes';

interface DeterministicIntent {
  readonly toolCode: MentaToolCode;
  readonly argumentsValue: Readonly<Record<string, unknown>>;
}

interface AppointmentProjection {
  readonly startsAt: string;
  readonly timezone: string;
  readonly modality: string;
  readonly status: string;
  readonly with: string;
}

interface RequestProjection {
  readonly primaryNeed: string | null;
  readonly status: string;
  readonly proposedBudget: string;
  readonly currency: string;
  readonly offers: readonly OfferProjection[];
}

interface OfferProjection {
  readonly psychologist: string;
  readonly amount: string;
  readonly status: string;
}

interface ProfessionalProjection {
  readonly displayName: string;
  readonly primarySpecialty: string | null;
  readonly modalities: readonly ProfessionalModalityProjection[];
  readonly rating: number | null;
  readonly hasWeeklyAvailability: boolean;
}

interface ProfessionalModalityProjection {
  readonly code: string;
  readonly pricePerHour: string;
  readonly currency: string;
}

interface PatientProjection {
  readonly displayName: string;
  readonly relationshipStatus: string;
  readonly latestAppointment: {
    readonly startsAt: string;
    readonly timezone: string;
    readonly status: string;
  } | null;
}

const STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente',
  BIDDING: 'Recibiendo propuestas',
  ACCEPTED: 'Aceptada',
  IN_SESSION: 'En atención',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
  SCHEDULED: 'Programada',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En curso',
  NO_SHOW: 'No realizada',
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
};

const MODALITY_LABELS: Readonly<Record<string, string>> = {
  CHAT: 'Chat',
  CALL: 'Llamada',
  IN_PERSON: 'Presencial',
};

function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typedArray<T>(value: unknown, predicate: (item: unknown) => item is T): readonly T[] {
  return Array.isArray(value) ? value.filter(predicate) : [];
}

function isAppointment(value: unknown): value is AppointmentProjection {
  return isRecord(value)
    && typeof value.startsAt === 'string'
    && typeof value.timezone === 'string'
    && typeof value.modality === 'string'
    && typeof value.status === 'string'
    && typeof value.with === 'string';
}

function isRequest(value: unknown): value is RequestProjection {
  return isRecord(value)
    && (typeof value.primaryNeed === 'string' || value.primaryNeed === null)
    && typeof value.status === 'string'
    && typeof value.proposedBudget === 'string'
    && typeof value.currency === 'string'
    && Array.isArray(value.offers)
    && typedArray(value.offers, isOffer).length === value.offers.length;
}

function isOffer(value: unknown): value is OfferProjection {
  return isRecord(value)
    && typeof value.psychologist === 'string'
    && typeof value.amount === 'string'
    && typeof value.status === 'string';
}

function isProfessional(value: unknown): value is ProfessionalProjection {
  return isRecord(value)
    && typeof value.displayName === 'string'
    && (typeof value.primarySpecialty === 'string' || value.primarySpecialty === null)
    && Array.isArray(value.modalities)
    && typedArray(value.modalities, isProfessionalModality).length === value.modalities.length
    && (typeof value.rating === 'number' || value.rating === null)
    && typeof value.hasWeeklyAvailability === 'boolean';
}

function isProfessionalModality(value: unknown): value is ProfessionalModalityProjection {
  return isRecord(value)
    && typeof value.code === 'string'
    && typeof value.pricePerHour === 'string'
    && typeof value.currency === 'string';
}

function isPatient(value: unknown): value is PatientProjection {
  return isRecord(value)
    && typeof value.displayName === 'string'
    && typeof value.relationshipStatus === 'string'
    && (
      value.latestAppointment === null
      || (
        isRecord(value.latestAppointment)
        && typeof value.latestAppointment.startsAt === 'string'
        && typeof value.latestAppointment.timezone === 'string'
        && typeof value.latestAppointment.status === 'string'
      )
    );
}

function modalityFromMessage(message: string): string | undefined {
  if (/\bpresencial\b/.test(message)) return 'IN_PERSON';
  if (/\b(?:llamada|telefono|telefonica)\b/.test(message)) return 'CALL';
  if (/\b(?:chat|mensaje|linea)\b/.test(message)) return 'CHAT';
  return undefined;
}

export function resolveDeterministicIntent(
  scope: MentaScope,
  message: string
): DeterministicIntent | null {
  const value = normalized(message);
  if (/\b(cita|citas|agenda|horario|proxima sesion)\b/.test(value)) {
    return { toolCode: 'get_my_agenda', argumentsValue: {} };
  }
  if (scope === 'PATIENT' && /\b(solicitud|solicitudes|oferta|ofertas|propuesta|propuestas)\b/.test(value)) {
    return { toolCode: 'get_my_requests', argumentsValue: {} };
  }
  if (scope === 'PATIENT' && /\b(psicolog|psicologa|psicologo|profesional|especialista)\w*\b/.test(value)) {
    const modality = modalityFromMessage(value);
    return {
      toolCode: 'find_psychologists',
      argumentsValue: {
        ...(modality ? { modality } : {}),
        specialty_query: message.slice(0, 120),
      },
    };
  }
  if (scope === 'PSYCHOLOGIST' && /\b(paciente|pacientes)\b/.test(value)) {
    return { toolCode: 'list_my_patients', argumentsValue: {} };
  }
  return null;
}

function formatDateTime(value: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('es-NI', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat('es-NI', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
}

function formatAgenda(data: unknown): string {
  const appointments = isRecord(data)
    ? typedArray(data.appointments, isAppointment)
    : [];
  if (appointments.length === 0) return 'No tienes citas próximas registradas.';
  return [
    appointments.length === 1 ? '## Próxima cita' : '## Próximas citas',
    ...appointments.map((appointment) => [
      `- **${formatDateTime(appointment.startsAt, appointment.timezone)}** con ${appointment.with}`,
      `  ${MODALITY_LABELS[appointment.modality] ?? appointment.modality} · ${STATUS_LABELS[appointment.status] ?? appointment.status}`,
    ].join('\n')),
  ].join('\n');
}

function formatRequests(data: unknown): string {
  const requests = typedArray(data, isRequest);
  if (requests.length === 0) return 'No tienes solicitudes de atención registradas.';
  return [
    '## Tus solicitudes',
    ...requests.slice(0, 5).map((request) => {
      const need = request.primaryNeed ?? 'Acompañamiento';
      const pendingOffers = request.offers.filter(({ status }) => status === 'PENDING').length;
      return `- **${need}** · ${STATUS_LABELS[request.status] ?? request.status}\n  ${request.currency} ${request.proposedBudget} · ${pendingOffers} propuesta${pendingOffers === 1 ? '' : 's'} pendiente${pendingOffers === 1 ? '' : 's'}`;
    }),
  ].join('\n');
}

function formatProfessionals(data: unknown): string {
  const professionals = typedArray(data, isProfessional);
  if (professionals.length === 0) {
    return 'No encontré profesionales que coincidan con esos criterios. Puedes ampliar tu búsqueda desde Buscar.';
  }
  return [
    '## Profesionales disponibles',
    ...professionals.slice(0, 5).map((professional) => {
      const lowest = professional.modalities[0];
      const price = lowest ? ` · Desde ${lowest.currency} ${lowest.pricePerHour}` : '';
      const rating = professional.rating === null ? '' : ` · ${professional.rating.toFixed(1)}/5`;
      const availability = professional.hasWeeklyAvailability ? ' · Con disponibilidad' : '';
      return `- **${professional.displayName}**\n  ${professional.primarySpecialty ?? 'Psicología'}${price}${rating}${availability}`;
    }),
    '',
    'Puedes revisar sus perfiles y elegir según especialidad, modalidad, disponibilidad y tarifa.',
  ].join('\n');
}

function formatPatients(data: unknown): string {
  const patients = typedArray(data, isPatient);
  if (patients.length === 0) return 'No tienes pacientes con una relación asistencial vigente.';
  return [
    patients.length === 1 ? '## Paciente activo' : '## Pacientes activos',
    ...patients.map((patient) => {
      const appointment = patient.latestAppointment
        ? ` · Última cita: ${formatDateTime(patient.latestAppointment.startsAt, patient.latestAppointment.timezone)}`
        : '';
      return `- **${patient.displayName}** · ${STATUS_LABELS[patient.relationshipStatus] ?? patient.relationshipStatus}${appointment}`;
    }),
  ].join('\n');
}

export function formatDeterministicReply(
  toolCode: MentaToolCode,
  execution: MentaToolExecution
): MentaAgentReply | null {
  const text = toolCode === 'get_my_agenda'
    ? formatAgenda(execution.data)
    : toolCode === 'get_my_requests'
      ? formatRequests(execution.data)
      : toolCode === 'find_psychologists'
        ? formatProfessionals(execution.data)
        : toolCode === 'list_my_patients'
          ? formatPatients(execution.data)
          : null;
  return text
    ? { text, outcome: 'NOT_USED', modelName: null, toolsUsed: [toolCode] }
    : null;
}
