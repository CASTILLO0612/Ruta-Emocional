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

## Dependencias funcionales principales

| Relación | Dependencia funcional |
|---|---|
| `users` | `id -> email, display_name, password_hash, status` |
| `patient_profiles` | `id -> user_id, birth_date` y `user_id -> id` |
| `psychologist_profiles` | `id -> user_id, verification_status, bio` |
| `professional_licenses` | `id -> psychologist_profile_id, authority, license_number, status` |
| `specialties` | `id -> code, name` |
| `service_requests` | `id -> patient_profile_id, modality, budget, status` |
| `offers` | `id -> request_id, psychologist_profile_id, amount, status` |
| `appointments` | `id -> patient_profile_id, psychologist_profile_id, starts_at, ends_at, status` |
| `clinical_records` | `id -> patient_profile_id, opened_at, status` |
| `clinical_encounters` | `id -> clinical_record_id, psychologist_profile_id, appointment_id` |
| `clinical_note_versions` | `(clinical_note_id, version_number) -> content, author_user_id, created_at` |
| `messages` | `id -> conversation_participant_id, content, type, sent_at` |
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

No se almacenarán arrays de roles, especialidades o modalidades dentro de una
fila del núcleo transaccional.

## Datos derivados

No se almacenarán como fuente primaria:

- Nombre o rol del autor de un mensaje.
- Calificación media del psicólogo.
- Psicólogo seleccionado de una solicitud.
- Estado de una relación deducido de una oferta sin una transición explícita.
- Disponibilidad calculada a partir de reglas, excepciones y citas.

Las optimizaciones desnormalizadas futuras necesitarán un ADR, una fuente de
verdad definida y un mecanismo comprobable de reconstrucción.

## Verificación en revisiones

Toda migración debe responder:

1. ¿Cuál es la clave candidata de cada tabla nueva?
2. ¿De qué clave depende cada atributo no clave?
3. ¿Existe una dependencia transitiva?
4. ¿Se está copiando información disponible mediante una relación?
5. ¿La restricción pertenece al dominio, a la base de datos o a ambos?
6. ¿Qué ocurre con las filas relacionadas al eliminar o desactivar la entidad?
