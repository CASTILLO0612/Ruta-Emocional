# Alineación entre DER conceptual y modelo lógico

## Propósito

Este documento impide confundir el DER conceptual del Hackathon con el esquema
lógico ejecutable. Cada diferencia tiene una decisión, una fase responsable y
un criterio de cierre. Una diferencia explícitamente diferida no autoriza a
inventar una relación alternativa en código.

## Consolidado después de la Fase 8

| Área conceptual | Estado lógico después de Fase 7.5 | Decisión |
|---|---|---|
| Usuario–Rol con historial | Implementado | `user_roles` tiene identidad propia, inicio, finalización, estado, unicidad parcial de asignación activa y protección del último rol. |
| Usuario ISA Paciente/Psicólogo | Implementado | Los perfiles 1:1 son la representación lógica de una especialización parcial y superpuesta. |
| Licencias profesionales | Implementado con política más estricta | El modelo admite varias licencias; el registro público actual exige una para evitar perfiles profesionales incompletos. |
| Especialidad principal | Implementado | Índice parcial garantiza como máximo una principal; la habilitación profesional valida la requerida. |
| Modalidad de atención | Implementado | `care_modalities` es el catálogo canónico y las columnas de modalidad lo referencian mediante FK. Precio y moneda siguen dependiendo de Psicólogo+Modalidad. |
| Oferta aceptada–Relación asistencial | Implementado | `care_relationship_sources.accepted_offer_id` conserva la oferta exacta y deriva la solicitud sin duplicarla. |
| Relación asistencial–Conversación | Implementado | Existe una conversación longitudinal única por relación y exactamente sus dos participantes. |
| Relación asistencial–Cita | Implementado | `appointments.care_relationship_id` es obligatorio; se retiró la asociación transitoria y la cita no depende de la solicitud. |
| Relación asistencial–Encuentro | Implementado | La FK es obligatoria y una restricción cruzada valida expediente, paciente y profesional. |
| Relación asistencial–Plan | Implementado | Todo plan conserva la relación que autorizó su creación y la unicidad de plan abierto se delimita por esa relación. |
| Consentimiento con contexto | Implementado para MENTA | La evaluación referencia la decisión otorgada sobre la versión exacta. Otros alcances y la política legal general permanecen pendientes. |
| Diagnóstico con contexto | Preparado, flujo no habilitado | Existe FK opcional a relación para migración compatible. Se hará obligatoria al habilitar diagnósticos. |
| Catálogo/reglas de triaje | Implementado | Preguntas, opciones, necesidades y reglas son catálogos normalizados; la N:N conserva resultado y evidencia minimizada para todas las reglas vigentes. |
| Triaje–Solicitud–Relación | Implementado | Una solicitud conserva 0..N evaluaciones; la aceptación congela la más reciente anterior al vínculo en `care_relationship_sources.triage_assessment_id`. |
| Plan–Diagnóstico N:N | Pendiente deliberado | La tabla asociativa se crea cuando diagnósticos sean aprobados y habilitados; no se agrega una relación sin caso de uso. |
| Cita–Pago 1:N | Pendiente deliberado | El modelo financiero inicial sigue aislado y ningún endpoint de pago está montado. Fase 9 migrará datos compatibles o abortará ante ambigüedad. |
| Mensajes/eventos de sistema | Parcial | Auditoría admite actor nulo. Mensajes visibles de sistema no se habilitan hasta definir origen, contenido permitido y autorización. |
| Evidencia profesional privada | Local QA únicamente | El adaptador local controlado no es productivo. URLs firmadas, cuarentena y antimalware dependen del proveedor aprobado. |
| Identificadores `legacy_id` | Solo reconciliación offline | No existe conexión ni paquete MongoDB en runtime. Las columnas se retiran únicamente después de un reporte de reconciliación aprobado. |

## Reglas de evolución

1. El esquema Prisma y las migraciones SQL cambian juntos.
2. Una migración aplicada nunca se modifica; la corrección es incremental.
3. Todo backfill ambiguo aborta y exige reconciliación manual identificable.
4. Una FK nueva se vuelve obligatoria solo después de comprobar y validar las
   filas históricas.
5. Ningún campo JSON sustituye una relación del dominio.
6. Las funciones deshabilitadas no conservan endpoints simulados como respaldo.
7. MENTA consume `care_modalities`; no mantiene otro catálogo de modalidades.
8. Una fase futura no puede mutar una evaluación histórica; debe crear una nueva
   evaluación y conservar la regla/versiones aplicadas.

## Evidencia de cierre de Fase 8

- migraciones completas desde una base vacía;
- compilación y pruebas unitarias en verde;
- integraciones PostgreSQL de identidad, solicitudes, mensajería, agenda y
  clínica en verde;
- cero dependencia `mongoose` y cero rutas MongoDB en el proceso;
- esquema y grants runtime actualizados para las tablas consolidadas;
- migración de triaje aplicada como la número 20 desde una base vacía;
- motor, autorización, congelación temporal e inmutabilidad cubiertos por
  pruebas PostgreSQL;
- grants runtime incluyen inserción de resultados y actualización limitada de
  revisión;
- cualquier gate externo no resuelto permanece deshabilitado y documentado en
  [`phase-8-secure-menta.md`](../roadmap/phase-8-secure-menta.md).
