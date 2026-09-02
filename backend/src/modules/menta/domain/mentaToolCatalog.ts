import type { MentaScope, MentaToolDeclaration } from './mentaTypes';

const EMPTY_PARAMETERS = {
  type: 'object',
  properties: {},
} as const;

const GET_MY_AGENDA: MentaToolDeclaration = {
  type: 'function',
  name: 'get_my_agenda',
  description: 'Consulta las próximas citas autorizadas de la persona autenticada.',
  parameters: EMPTY_PARAMETERS,
};

const PATIENT_TOOLS: readonly MentaToolDeclaration[] = [
  GET_MY_AGENDA,
  {
    type: 'function',
    name: 'get_my_requests',
    description: 'Consulta las solicitudes de atención recientes del paciente autenticado y su estado.',
    parameters: EMPTY_PARAMETERS,
  },
  {
    type: 'function',
    name: 'find_psychologists',
    description: 'Busca psicólogos verificados de Ruta Emocional. Úsala para recomendar profesionales reales de la plataforma.',
    parameters: {
      type: 'object',
      properties: {
        modality: {
          type: 'string',
          enum: ['CHAT', 'CALL', 'IN_PERSON'],
          description: 'Modalidad solicitada cuando el usuario la especifica.',
        },
        specialty_query: {
          type: 'string',
          description: 'Necesidad o especialidad expresada por el usuario, sin convertirla en diagnóstico.',
        },
      },
    },
  },
];

const PSYCHOLOGIST_TOOLS: readonly MentaToolDeclaration[] = [
  GET_MY_AGENDA,
  {
    type: 'function',
    name: 'list_my_patients',
    description: 'Lista únicamente pacientes con relación asistencial vigente del psicólogo autenticado.',
    parameters: EMPTY_PARAMETERS,
  },
  {
    type: 'function',
    name: 'get_patient_context',
    description: 'Consulta contexto clínico y operativo minimizado de un paciente autorizado para preparar un borrador que el psicólogo debe revisar.',
    parameters: {
      type: 'object',
      properties: {
        patient_user_id: {
          type: 'string',
          description: 'Identificador exacto obtenido previamente mediante list_my_patients.',
        },
      },
      required: ['patient_user_id'],
    },
  },
];

export function toolsForScope(scope: MentaScope): readonly MentaToolDeclaration[] {
  return scope === 'PATIENT' ? PATIENT_TOOLS : PSYCHOLOGIST_TOOLS;
}
