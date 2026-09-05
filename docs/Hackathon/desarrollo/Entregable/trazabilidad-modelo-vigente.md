# Trazabilidad del DER conceptual al esquema vigente

## 1. Propósito

Esta matriz demuestra que el DER conceptual no es una reproducción automática
de Prisma y, al mismo tiempo, que ningún modelo lógico vigente queda sin
clasificación. El corte contiene **58 modelos Prisma**. Estos se trazan hacia
los **43 tipos de entidad**, las asociaciones conceptuales o el bloque técnico
de plataforma del DER.

La ausencia de igualdad entre ambos totales es intencional: una relación N:N se
convierte en una tabla asociativa al pasar al nivel lógico; otras asociaciones
1:1 o 1:N requieren una estructura propia para preservar procedencia; y algunos
catálogos técnicos materializan un protocolo sin convertirse en entidades
centrales del problema.

## 2. Matriz completa

| Modelo Prisma | Representación conceptual | Clasificación |
|---|---|---|
| `User` | Usuario | entidad |
| `Role` | Rol | entidad/catálogo |
| `UserRole` | Usuario tiene asignado Rol | asociación N:N materializada |
| `AuthSession` | Sesión | entidad |
| `PasswordResetToken` | Recuperación de acceso | entidad |
| `PatientProfile` | Paciente ISA Usuario | subtipo |
| `PsychologistProfile` | Psicólogo ISA Usuario | subtipo |
| `ProfessionalLicense` | Licencia profesional | entidad |
| `Specialty` | Especialidad | entidad/catálogo |
| `PsychologistSpecialty` | Psicólogo ejerce en Especialidad | asociación N:N materializada |
| `PsychologistModality` | Psicólogo ofrece Modalidad de atención | asociación N:N materializada |
| `CareModality` | Modalidad de atención | entidad/catálogo |
| `ProfessionalVerificationSubmission` | Solicitud de verificación | entidad |
| `ProfessionalVerificationDecision` | Decisión de verificación | entidad |
| `ServiceRequest` | Solicitud de atención | entidad |
| `Offer` | Oferta | entidad |
| `CareRelationship` | Relación asistencial | entidad |
| `CareRelationshipSource` | Oferta/Evaluación origina Relación asistencial | procedencia materializada |
| `AvailabilityRule` | Regla de disponibilidad | entidad |
| `AvailabilityException` | Excepción de disponibilidad | entidad |
| `Appointment` | Cita | entidad |
| `AppointmentEvent` | Evento de cita | entidad |
| `ClinicalRecord` | Expediente clínico | entidad |
| `ClinicalEncounter` | Encuentro clínico | entidad |
| `ClinicalEncounterAppointment` | Cita se materializa como Encuentro clínico | asociación opcional 1:1 materializada |
| `ClinicalNote` | Nota clínica | entidad |
| `ClinicalNoteVersion` | Versión de nota | entidad |
| `ClinicalNoteEvent` | Evento de nota | entidad |
| `DiagnosisCatalog` | Concepto diagnóstico | entidad/catálogo |
| `ClinicalDiagnosis` | Diagnóstico clínico | entidad |
| `ClinicalDiagnosisSource` | Relación/Encuentro contextualiza Diagnóstico | procedencia materializada |
| `TreatmentPlan` | Plan de tratamiento | entidad |
| `TreatmentGoal` | Objetivo terapéutico | entidad |
| `ConsentDocument` | Documento de consentimiento | entidad versionada |
| `PatientConsent` | Decisión de consentimiento | entidad histórica |
| `Conversation` | Conversación | entidad |
| `ConversationParticipant` | Usuario participa en Conversación | asociación N:N materializada |
| `Message` | Mensaje | entidad |
| `MentaConversation` | Conversación MENTA | entidad |
| `MentaTurn` | Turno MENTA | entidad |
| `MentaToolInvocation` | Invocación MENTA | entidad |
| `Payment` | Pago | entidad; módulo no habilitado |
| `PaymentEvent` | Evento de pago | entidad; módulo no habilitado |
| `TriageNeed` | necesidad de la Evaluación de triaje | catálogo lógico del protocolo |
| `TriageNeedModality` | prioridad de modalidad por necesidad | asociación de catálogo |
| `TriageQuestion` | pregunta del protocolo versionado | catálogo lógico del protocolo |
| `TriageAnswerOption` | opción cerrada del protocolo | catálogo lógico del protocolo |
| `TriageRule` | Regla de triaje | entidad/catálogo versionado |
| `TriageAssessment` | Evaluación de triaje | entidad |
| `TriageConsentWithdrawal` | Decisión retira autorización de Evaluación | asociación histórica materializada |
| `TriageErasureRequest` | Solicitud de eliminación | entidad |
| `TriageAssessmentModality` | Evaluación recomienda Modalidad | asociación N:N materializada |
| `TriageAssessmentRuleResult` | Evaluación aplica Regla de triaje | asociación N:N materializada |
| `RequestTriageAssessment` | Evaluación informa Solicitud de atención | asociación opcional 1:N materializada |
| `Review` | Reseña | entidad |
| `AuditEvent` | Evento de auditoría | entidad técnica separada |
| `OutboxEvent` | Evento de salida | entidad técnica separada |
| `IdempotencyRecord` | Registro de idempotencia | entidad técnica separada |

## 3. Controles de coherencia

1. Los 58 modelos del esquema aparecen una sola vez en la matriz.
2. Las 7 relaciones N:N del DER permanecen como relaciones conceptuales; sus
   tablas asociativas solo se nombran aquí para explicar la transformación.
3. Las estructuras de procedencia no se presentan como entidades del mundo
   real cuando solo materializan una asociación.
4. El bloque técnico de auditoría, outbox e idempotencia permanece separado del
   dominio clínico y comercial.
5. Los catálogos internos del protocolo de triaje no se confunden con nuevas
   fuentes de verdad para solicitud, modalidad o relación asistencial.

Esta matriz se revisa junto con
[`modelo-entidad-relacion-conceptual.md`](modelo-entidad-relacion-conceptual.md),
[`normalization-3nf.md`](../../../database/normalization-3nf.md) y el esquema
[`schema.prisma`](../../../../backend/prisma/schema.prisma).
