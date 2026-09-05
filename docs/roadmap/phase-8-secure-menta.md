# Fase 8 — MENTA segura

**Estado:** fase de ingeniería cerrada el 30 de agosto de 2026. La validación
local y el pipeline remoto finalizaron correctamente.

**Endurecimiento productivo:** implementado el 31 de agosto de 2026; las
aprobaciones humanas y servicios externos continúan fail closed.

Este documento conserva el cierre del **triaje determinista**. La conversación
contextual añadida después se documenta por separado en
[`phase-8-1-contextual-menta-agent.md`](phase-8-1-contextual-menta-agent.md) y
`ADR-006`; no modifica riesgo, reglas ni recursos de este subsistema.

## 1. Resultado

MENTA vuelve al producto como orientación automatizada estructurada, no como
chat clínico, diagnóstico ni simulación de un proveedor externo. El motor
determinista se ejecuta antes que cualquier integración, conserva el catálogo y
la versión de cada regla aplicada y falla de forma segura.

El alcance entregado comprende:

- cuestionario cerrado servido por el backend;
- consentimiento exacto y versionado;
- evaluación inmutable y N:N con todas las reglas aplicadas;
- nivel de riesgo calculado solo en servidor;
- recursos de crisis por país desde configuración validada;
- separación absoluta entre orientación y presupuesto;
- congelación del último triaje vinculado cuando se acepta una oferta;
- acceso del paciente propietario y del psicólogo responsable;
- revisión profesional append-only con auditoría;
- interfaz Expo para paciente y acceso desde el expediente profesional;
- adaptador externo cerrado por feature flag hasta seleccionar proveedor.
- revocación histórica, solicitud de eliminación bloqueante y auditoría;
- verificación criptográfica entre protocolo activo y aprobación profesional;
- validación efectiva del login PostgreSQL runtime al arranque productivo.

## 2. Decisiones de dominio

1. La evaluación acepta únicamente opciones pertenecientes a las preguntas
   activas. No existe texto libre en el comando de MENTA.
2. Un paciente puede generar varias evaluaciones. Ninguna sobrescribe otra.
3. Una solicitud puede conservar varias evaluaciones. Al aceptar una oferta se
   congela en `care_relationship_sources` la evaluación más reciente creada
   antes de la aceptación.
4. `LOW` y `MODERATE` deben recomendar una o más modalidades del catálogo
   común. `HIGH` y `CRITICAL` deben tener cero modalidades.
5. `CRITICAL` interrumpe la aceptación de la oferta con
   `409 CRITICAL_TRIAGE_INTERRUPTS_COMMERCIAL_FLOW`.
6. La revisión profesional solo añade psicólogo y fecha. El riesgo, resumen,
   proveedor, versión, reglas y modalidades permanecen inmutables.
7. El administrador no recibe acceso al resultado clínico individual por su
   rol administrativo.

## 3. Modelo PostgreSQL y tercera forma normal

La migración `20260830001000_secure_triage_menta` agrega:

| Relación | Dependencia funcional principal |
|---|---|
| `triage_needs` | `code → name, description, fallback_summary` |
| `triage_need_modalities` | `(need_code, modality) → priority` |
| `triage_questions` | `code → prompt, help_text, display_order, vigencia` |
| `triage_answer_options` | `code → question_code, label, need_code, modality` |
| `triage_rules` | `(code, version) → trigger_option_code, risk_level, vigencia` |
| `triage_assessments` | `id → paciente, consentimiento, necesidad, salida, versión, revisión` |
| `triage_assessment_modalities` | `(assessment_id, modality) → priority` |
| `triage_assessment_rule_results` | `(assessment_id, rule_id) → matched, evidence_option_code` |
| `request_triage_assessments` | `(service_request_id, triage_assessment_id) → linked_at` |
| `triage_consent_withdrawals` | `assessment_id → decisión retirada, paciente, fecha` |
| `triage_erasure_requests` | `assessment_id → política, plazo, estado, resolución` |

Las modalidades no se duplican: referencian `care_modalities`. El
consentimiento referencia `patient_consents` y `consent_documents`. Las reglas
y sus resultados se separan de la evaluación para evitar grupos repetidos y
dependencias parciales. No existe atributo de presupuesto en el subsistema de
triaje.

La base impone mediante constraints y triggers:

- consentimiento otorgado para el mismo paciente y alcance;
- vínculo solo con una solicitud propia abierta;
- resultado para todas las reglas vigentes;
- riesgo igual a la regla coincidente de mayor severidad;
- ausencia de modalidades en riesgo alto/crítico;
- salida inmutable y revisión profesional de una sola asignación;
- congelación temporal correcta en el origen de la relación asistencial.
- correspondencia entre evaluación, paciente y decisión `WITHDRAWN`;
- máquina de estados y plazo inmutable de solicitudes de eliminación.

## 4. Seguridad y privacidad

- Capacidades: `triage:create:self`, `triage:read:self` y
  `triage:review:authorized`.
- Los UUID ajenos se responden como no encontrados para no revelar existencia.
- Los DTO se construyen explícitamente; no se serializan filas Prisma.
- La entrada rechaza campos desconocidos, identidad, texto libre, presupuesto,
  proveedor y riesgo del cliente.
- La auditoría contiene actor, acción, recurso, correlación y metadatos mínimos;
  nunca respuestas, resumen ni evidencia sensible.
- La creación es idempotente y serializada por actor/clave.
- El proveedor externo recibe solo necesidad, riesgo y modalidades
  deterministas. No recibe nombre, correo, teléfono, ubicación ni UUID.
- La salida externa permite únicamente `summary` y `recommendedModalities`,
  aplica límite de tamaño y bloquea diagnóstico, prescripción, garantías,
  presupuesto o afirmaciones falsas de contacto de emergencia.
- Un error o payload inválido del proveedor conserva el fallback determinista.
- El rol PostgreSQL de runtime puede insertar resultados, pero no modificar
  reglas, consentimientos o evaluaciones; solo dispone de actualización por
  columna para los dos campos de revisión.
- El paciente puede retirar el consentimiento y solicitar eliminación. Ambos
  comandos son idempotentes por evaluación y bloquean nuevos usos profesionales
  o comerciales sin borrar historia automáticamente.

## 5. Recursos y habilitación

El ejemplo local configura Nicaragua con fuentes oficiales verificadas el
30 de agosto de 2026:

- Policía Nacional, emergencia `118`:
  <https://www.policia.gob.ni/?p=145448>
- Ministerio de Salud, Central de Ambulancias `102`:
  <https://www.minsa.gob.ni/index.php/>

Los recursos no están codificados en la interfaz. Se inyectan por
`TRIAGE_CRISIS_RESOURCES_JSON`, se validan al iniciar y se devuelven solo para
riesgo alto o crítico. `TRIAGE_PROTOCOL_APPROVED=false` permanece como valor de
ejemplo. En producción, habilitar MENTA exige aprobación explícita del
protocolo y recursos.

`TRIAGE_EXTERNAL_PROVIDER_ENABLED=false` es una decisión aceptada para el MVP
mediante `ADR-005`. No existe un fallback que simule IA externa.

## 6. API y experiencia

Rutas implementadas:

```text
GET  /api/v1/triage/policy
POST /api/v1/triage/assessments
GET  /api/v1/triage/assessments/{assessmentId}
POST /api/v1/triage/assessments/{assessmentId}/review
POST /api/v1/triage/assessments/{assessmentId}/consent-withdrawal
POST /api/v1/triage/assessments/{assessmentId}/erasure-request
```

La pestaña **Orientación** usa preguntas dinámicas del backend, estado de carga,
reintento, consentimiento accesible e iconos Material. Un resultado de riesgo
alto/crítico prioriza acciones y enlaces telefónicos antes del resumen. El
panel profesional expone la evaluación congelada dentro del paciente activo y
permite registrar su revisión sin editarla.
El resultado del paciente incorpora un panel minimalista de control de datos,
confirmación accesible y estado de revocación/solicitud.

## 7. Verificación ejecutada

| Evidencia | Resultado |
|---|---|
| Prisma format/validate/generate | correcto |
| 21 migraciones al cierre original de la fase; 23 en el corte de entrega vigente | correcto |
| TypeScript backend y frontend | correcto |
| Pruebas unitarias | 41/41 |
| Integraciones secuenciales PostgreSQL/WebSocket | 8/8 |
| Integración específica MENTA | propietario/ajeno/profesional, idempotencia, inmutabilidad, retiro, eliminación, revisión y bloqueos de seguridad correctos |
| Grants de runtime | grupo y login separado verificados; permisos requeridos presentes y destructivos ausentes |
| Backup/restauración local | 21 migraciones verificadas al cierre original; el corte vigente contiene 23 y requiere repetir el ensayo antes de producción |
| Expo SDK 57 | dependencias exactas, TypeScript y configuración nativa correctos |
| Exportación Expo Web | bundle generado y sin nombres de secretos públicos prohibidos |
| CI del endurecimiento productivo `f305d65` | [Quality #33462146189](https://github.com/CASTILLO0612/Ruta-Emocional/actions/runs/33462146189) correcto |

La integración comprueba además que el identificador de triaje congelado se
proyecta al expediente del profesional responsable, que el retiro de
consentimiento es naturalmente idempotente y que una solicitud de eliminación
impide continuar el tratamiento comercial de la evaluación.

## 8. Rollback

No se debe eliminar una evaluación producida en un entorno real. Para una
reversión funcional:

1. establecer `TRIAGE_ENABLED=false`;
2. retirar la pestaña mediante despliegue del frontend anterior;
3. conservar tablas, consentimiento, auditoría y referencias históricas;
4. investigar y corregir antes de reactivar;
5. revertir físicamente la migración solo en un entorno efímero sin datos.

## 9. Endurecimiento ejecutable incorporado

- configuración productiva exige secretos externos versionados, proveedor de
  backup/observabilidad, alerta activa, RPO/RTO y restore reciente;
- `DATABASE_URL` no puede usar una identidad administrativa;
- antes de escuchar tráfico, PostgreSQL confirma login separado, membresía en
  rol runtime, ausencia de atributos/DDL y permisos positivos/negativos;
- MENTA exige aprobación profesional vigente que coincida con la huella del
  protocolo realmente cargado desde PostgreSQL;
- cada recurso exige responsable y `reviewDueAt`; un vencimiento impide arranque;
- readiness expone outbox y solicitudes de privacidad vencidas;
- CI restaura un dump desechable y verifica tablas/migraciones críticas;
- Expo está alineado con las versiones recomendadas, usa perfiles EAS y valida
  configuración nativa/ausencia de secretos públicos prohibidos.

## 10. Gates productivos abiertos

La fase funcional está implementada, pero MENTA no se declara clínicamente
aprobada para producción hasta cerrar:

- aprobación firmada del cuestionario, reglas, textos y acciones de crisis;
- verificación periódica y responsable operativo de los recursos por país;
- firma real del protocolo y aprobación legal de retención;
- titular/suplente nominados para recursos y evidencia del calendario;
- cuenta/hosting con gestor de secretos y rotación coordinada de la credencial
  administrativa previamente compartida;
- aplicación de los roles en la base desplegada, no sólo local/CI;
- backup administrado, restauración del proveedor y alerta externa recibida;
- pruebas de accesibilidad/seguridad sobre builds release Android/iOS.

Los formatos y runbooks se encuentran en `docs/governance`, `docs/operations`
y `docs/security`. El servidor no permite sustituir su evidencia con booleanos
sin contenido verificable.

La siguiente fase funcional es la **Fase 9 — Proveedores opcionales**. Pagos y
RTC continuarán deshabilitados mientras no existan proveedores y políticas
aprobadas.
