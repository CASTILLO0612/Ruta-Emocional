# Normalización del modelo PostgreSQL

## Compromiso

El esquema transaccional de Ruta Emocional debe cumplir al menos tercera forma
normal (3FN). Cada cambio de esquema deberá conservar las siguientes propiedades:

1. **Primera forma normal:** una columna representa un valor atómico y no se
   almacenan listas delimitadas dentro de texto.
2. **Segunda forma normal:** todo atributo no clave depende de la clave completa
   de su tabla.
3. **Tercera forma normal:** ningún atributo no clave depende de otro atributo no
   clave.

Los campos JSON de `audit_events` y `outbox_events` son sobres técnicos de eventos,
no la representación canónica de entidades del negocio. No deben usarse para
evitar modelar relaciones o atributos clínicos.

## Alcance de conformidad

Las dependencias que siguen describen el esquema lógico vigente después de la
Fase 8. La
[`matriz de alineación`](conceptual-logical-alignment.md) distingue las
relaciones ya materializadas de las que pertenecen a fases funcionales aún
deshabilitadas. La conformidad 3FN no se usa para afirmar que pagos, diagnósticos
estén habilitados. MENTA determinista sí forma parte del modelo vigente; su
proveedor externo continúa deshabilitado.

## Dependencias funcionales principales

| Relación | Dependencia funcional |
|---|---|
| `users` | `id -> email, display_name, password_hash, status` |
| `user_roles` | `id -> user_id, role_id, status, assigned_at, ended_at`; una asignación activa por pareja |
| `patient_profiles` | `id -> user_id, birth_date` y `user_id -> id` |
| `psychologist_profiles` | `id -> user_id, verification_status, bio` |
| `professional_licenses` | `id -> psychologist_profile_id, authority, license_number, status` |
| `professional_verification_submissions` | `id -> professional_license_id, evidence_object_key, submitted_at` |
| `professional_verification_decisions` | `id -> submission_id, reviewer_user_id, decision, reasons, decided_at` y `submission_id -> id` |
| `specialties` | `id -> code, name, is_active` |
| `psychologist_specialties` | `(psychologist_profile_id, specialty_id) -> is_primary` |
| `care_modalities` | `code -> name, description, is_active` |
| `psychologist_modalities` | `(psychologist_profile_id, modality) -> price_per_hour, currency_code, is_enabled` |
| `availability_rules` | `id -> psychologist_profile_id, weekday, start_time, end_time, timezone, vigencia, is_active` |
| `availability_exceptions` | `id -> psychologist_profile_id, starts_at, ends_at, type, reason` |
| `service_requests` | `id -> patient_profile_id, modality, proposed_budget, currency_code, status, scheduled_for, expires_at, location, location_expires_at` |
| `offers` | `id -> request_id, psychologist_profile_id, amount, message, status` y `(request_id, psychologist_profile_id) -> id` |
| `care_relationship_sources` | `care_relationship_id -> accepted_offer_id, triage_assessment_id` y `accepted_offer_id -> care_relationship_id` |
| `idempotency_records` | `(actor_user_id, operation, idempotency_key) -> request_hash, resource_id, expires_at` |
| `appointments` | `id -> care_relationship_id, patient_profile_id, psychologist_profile_id, starts_at, ends_at, status` |
| `appointment_events` | `id -> appointment_id, actor_user_id, type, estados, intervalo_anterior, reason, occurred_at` |
| `clinical_records` | `id -> patient_profile_id, opened_at, status` |
| `clinical_encounters` | `id -> clinical_record_id, psychologist_profile_id, care_relationship_id, fechas, reason` |
| `clinical_note_versions` | `(clinical_note_id, version_number) -> content, author_user_id, created_at` |
| `clinical_note_events` | `id -> clinical_note_id, actor_user_id, type, estados, version_number, occurred_at` |
| `treatment_plans` | `id -> clinical_record_id, psychologist_profile_id, care_relationship_id, status, summary, fechas` |
| `treatment_goals` | `id -> treatment_plan_id, description, target_date, status` |
| `consent_documents` | `(code, version) -> scope, title, content, content_hash, vigencia` |
| `patient_consents` | `id -> patient_profile_id, document_id, decision, decided_at, care_relationship_id` |
| `triage_needs` | `code -> name, description, fallback_summary` |
| `triage_need_modalities` | `(need_code, modality) -> priority` |
| `triage_questions` | `code -> prompt, help_text, display_order, vigencia` |
| `triage_answer_options` | `code -> question_code, label, help_text, need_code, modality` |
| `triage_rules` | `(code, version) -> trigger_option_code, risk_level, vigencia, estado` |
| `triage_assessments` | `id -> patient_profile_id, consent_id, primary_need_code, risk_level, orientation_summary, evaluator_version, revisión` |
| `triage_assessment_modalities` | `(triage_assessment_id, modality) -> priority` |
| `triage_assessment_rule_results` | `(triage_assessment_id, triage_rule_id) -> matched, evidence_option_code` |
| `request_triage_assessments` | `(service_request_id, triage_assessment_id) -> linked_at` |
| `conversations` | `id -> care_relationship_id, created_at` y `care_relationship_id -> id` |
| `conversation_participants` | `(conversation_id, user_id) -> id, joined_at, left_at` |
| `messages` | `id -> conversation_participant_id, client_message_id, content, type, sent_at` y `(conversation_participant_id, client_message_id) -> id` |
| `payments` | `id -> offer_id, amount, currency_code, status` |

## Duplicaciones eliminadas respecto a MongoDB

El modelo PostgreSQL no copiará estos datos en solicitudes, ofertas o mensajes:

- Nombre, correo, teléfono o fotografía del paciente.
- Nombre, fotografía, calificación o especialidad del psicólogo.
- Rol declarado por el remitente de un mensaje.
- Psicólogo aceptado duplicado en la solicitud.
- Paciente y psicólogo duplicados dentro del pago cuando ya se conocen a través
  de la oferta y la cita.

Esos valores se obtienen mediante claves foráneas. Si el negocio necesita una
captura histórica inmutable, se modelará explícitamente como snapshot con nombre
y propósito documentados, no como duplicación accidental.

## Relaciones de muchos a muchos

Las relaciones multivaluadas se representan con tablas asociativas:

- `user_roles`
- `psychologist_specialties`
- `psychologist_modalities`
- `conversation_participants`
- `triage_need_modalities`
- `triage_assessment_modalities`
- `triage_assessment_rule_results`
- `request_triage_assessments`

No se almacenarán arrays de roles, especialidades o modalidades dentro de una
fila del núcleo transaccional.

La asociación `Evaluación de triaje-Regla de triaje` ya está materializada y sus
atributos dependen de la pareja completa. Las transformaciones lógicas futuras
añadirán `Plan de tratamiento-Diagnóstico clínico` cuando exista un caso de uso
aprobado. `Relación-Cita` y `Relación-Conversación` ya están materializadas. La
sustitución `Oferta-Pago` por `Cita-Pago` pertenece a Fase 9 y pagos permanece
deshabilitado hasta entonces.

## Decisión de normalización de la Fase 3

La evidencia profesional y su resolución se separan deliberadamente:

- una entrega pertenece a una licencia y conserva una clave opaca de
  almacenamiento privado;
- una decisión pertenece a una sola entrega y conserva revisor, resultado,
  razones y fecha;
- la entrega no repite `psychologist_profile_id`, porque
  `professional_license_id -> psychologist_profile_id`; guardar ambos crearía
  una dependencia transitiva y violaría 3FN;
- una nueva evidencia crea otra entrega; no actualiza la evidencia histórica;
- el promedio y total de reseñas siguen calculándose desde `reviews` y
  `appointments`, sin columnas derivadas en el perfil.

La corrección `20260827002000_normalize_verification_submission` elimina esa
dependencia transitiva del primer diseño antes del cierre de la fase. Las claves
candidatas, claves foráneas e índices resultantes están versionados en las
migraciones de PostgreSQL.

## Decisión de normalización de la Fase 4

Solicitudes y ofertas conservan dependencias directas de sus claves:

- `service_requests` guarda la moneda porque el presupuesto pertenece a la
  solicitud; las ofertas reutilizan esa moneda al proyectar su importe y no la
  duplican;
- una oferta referencia `psychologist_profile_id`; nombre, fotografía,
  especialidad y rating se derivan de relaciones y agregados existentes;
- la solicitud no contiene `accepted_offer_id` ni `accepted_psychologist_id`; la
  única oferta con estado `ACCEPTED` se protege mediante índice parcial y trigger
  diferible;
- `care_relationship_sources` referencia la oferta aceptada exacta. La solicitud
  se deriva de `accepted_offer_id -> offer.request_id` y no se duplica;
- `idempotency_records` es un registro técnico con clave compuesta. `resource_id`
  identifica el resultado sin copiar sus atributos y expira por política;
- la identidad del paciente y del psicólogo nunca se captura como snapshot
  accidental en este flujo.

Las columnas temporales son atómicas y tienen semántica distinta:
`scheduled_for` representa la sesión solicitada, `expires_at` el cierre de
ofertas y `location_expires_at` la eliminación de ubicación precisa. Por ello no
son grupos repetidos ni dependencias transitivas.

## Datos derivados

No se almacenarán como fuente primaria:

- Nombre o rol del autor de un mensaje.
- Calificación media del psicólogo.
- Psicólogo seleccionado de una solicitud.
- Estado de una relación deducido de una oferta sin una transición explícita.
- Disponibilidad calculada a partir de reglas, excepciones y citas.

Las optimizaciones desnormalizadas futuras necesitarán un ADR, una fuente de
verdad definida y un mecanismo comprobable de reconstrucción.

## Decisión de normalización de la Fase 5

- `conversations.care_relationship_id` representa el vínculo longitudinal uno a
  uno; solicitud y citas se derivan desde la relación y no se duplican;
- el participante depende de conversación y usuario; su fila conserva las fechas
  de pertenencia sin duplicar nombre, rol o perfil;
- el mensaje referencia al participante. Conversación, usuario y rol se derivan
  por claves foráneas y no se repiten;
- `client_message_id` depende del intento del participante y forma una clave
  candidata compuesta, por lo que la idempotencia no necesita una columna
  derivada o un documento embebido;
- el último mensaje y la actividad de bandeja son proyecciones calculadas, no
  atributos almacenados en `conversations`;
- el evento outbox conserva solo identificadores de entrega y no se convierte en
  fuente canónica del contenido.

Estas dependencias evitan grupos repetidos, dependencias parciales y
dependencias transitivas; el módulo cumple al menos 3FN.

## Decisión de normalización de la Fase 6

- la cita conserva el intervalo y estado actuales y referencia directamente la
  relación mediante `care_relationship_id` obligatorio;
- `appointment_events` registra hechos de transición y no repite paciente,
  psicólogo, modalidad, nombres ni horario actual;
- el intervalo anterior solo pertenece al hecho `RESCHEDULED` y depende de la
  clave de ese evento;
- disponibilidad calculada no se persiste como slots ni arrays; se deriva de
  reglas, excepciones y citas activas;
- recordatorios son sobres técnicos outbox reconstruibles. Antes de entregar se
  contrastan con la cita canónica, por lo que no se convierten en otra fuente de
  verdad.

El agregado mantiene 1FN, 2FN y 3FN y usa constraints GiST para una invariante
de concurrencia que no requiere desnormalización.

## Decisión de normalización de la Fase 7

- un paciente conserva como máximo un `clinical_record`; el expediente no repite
  nombre, contacto ni datos del profesional;
- cada encuentro referencia el expediente, el psicólogo responsable y la
  relación asistencial que justificó el acceso. La cita opcional permanece en la
  tabla uno a uno `clinical_encounter_appointments`;
- `clinical_notes` conserva solamente estado y fechas. El contenido depende de
  la clave candidata `(clinical_note_id, version_number)` y vive en
  `clinical_note_versions`;
- `clinical_note_events` conserva las transiciones sin copiar contenido clínico;
- objetivos pertenecen a un plan mediante `treatment_plan_id`; no se almacenan
  como JSON ni como lista delimitada;
- cada plan referencia la relación asistencial concreta que autorizó su creación;
- los textos cifrados siguen siendo valores atómicos de sus atributos. El
  cifrado no introduce duplicación ni convierte auditoría en fuente de verdad;
- conteos de borradores, último encuentro y línea temporal son proyecciones
  calculadas e indexadas, no columnas derivadas.

Las versiones y eventos son append-only. La migración valida participantes de
encuentro contra expediente, profesional y relación mediante una restricción
diferible, preservando integridad incluso fuera del caso de uso HTTP.

## Decisión de normalización de la Fase 7.5

- `user_roles` tiene una clave sustituta porque una misma pareja Usuario–Rol
  puede acumular varios periodos históricos; los atributos temporales dependen
  de la asignación y no únicamente de la pareja;
- `care_modalities` concentra nombre, descripción y habilitación; las entidades
  transaccionales conservan solo el código referenciado;
- la oferta aceptada determina la procedencia de la relación y evita la
  dependencia ambigua Solicitud–Relación;
- conversación, cita, encuentro y plan dependen de una relación asistencial
  concreta y no repiten identidades como fuente autónoma;
- las antiguas tablas puente uno a uno de solicitud/conversación y cita/relación
  se retiraron después de un backfill validado porque no representaban una N:N;
- consentimiento y diagnóstico reciben contexto opcional sin habilitar todavía
  sus flujos. La obligatoriedad se impondrá únicamente cuando exista una regla
  de negocio aprobada y un backfill no ambiguo.

La migración falla ante huérfanos o más de una conversación por relación. Esa
conducta evita seleccionar datos arbitrariamente y preserva la integridad de la
transformación.

## Verificación en revisiones

Toda migración debe responder:

1. ¿Cuál es la clave candidata de cada tabla nueva?
2. ¿De qué clave depende cada atributo no clave?
3. ¿Existe una dependencia transitiva?
4. ¿Se está copiando información disponible mediante una relación?
5. ¿La restricción pertenece al dominio, a la base de datos o a ambos?
6. ¿Qué ocurre con las filas relacionadas al eliminar o desactivar la entidad?
