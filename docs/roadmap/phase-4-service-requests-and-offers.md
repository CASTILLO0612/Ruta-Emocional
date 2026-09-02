# Fase 4 — Solicitudes y ofertas

## Estado

Completada el 27 de agosto de 2026 sobre la rama `postgresql-migration`.
PostgreSQL es la única fuente de verdad del flujo HTTP v1. Las rutas MongoDB y
los eventos de dominio fabricados por clientes fueron retirados para solicitudes
y ofertas.

## Alcance entregado

### Backend

- Módulo `service-request` separado en dominio, aplicación, puertos,
  persistencia Prisma y presentación HTTP.
- Solicitudes inmediatas o programadas con modalidad, moneda, presupuesto,
  vencimiento, ubicación temporal opcional y límites obtenidos de configuración.
- Proyección de matching sin identidad ni ubicación exacta del paciente.
- Elegibilidad defensiva: cuenta activa, perfil y licencia verificados, modalidad
  habilitada y tarifa profesional positiva.
- Una oferta propia por profesional y solicitud, con importe y mensaje limitados.
- Cancelación y retiro mediante comandos explícitos; no existe actualización
  genérica de estado.
- Aceptación serializable e idempotente que bloquea la solicitud, toma el precio
  persistido, acepta una oferta, rechaza competidoras, crea la relación de
  atención, auditoría, idempotencia y outbox dentro de la misma transacción.
- Reintentos acotados y configurables para conflictos `40001` de PostgreSQL.

### Frontend

- `RequestRepository` y `OfferRepository` tipados contra `/api/v1`, sin `any`,
  `_id`, nombres/IDs de actor ni precio final enviados por el dispositivo.
- UUID v4 criptográficamente seguro para reintentar creación de solicitud,
  creación de oferta y aceptación con la misma clave de idempotencia.
- Polling serializado, abortable y configurable, sin solicitudes superpuestas.
  La Fase 5 reemplazará la latencia de polling por outbox y tiempo real seguro.
- Home obtiene moneda, mínimos, máximos, longitudes y ventana de programación
  desde la política del servidor; la fecha se transmite estructurada y ya no se
  concatena dentro de la descripción.
- Radar reconcilia solicitud y ofertas desde HTTP, navega solo después de una
  aceptación confirmada y conserva el precio retornado por el servidor.
- Dashboard muestra únicamente solicitudes elegibles y crea ofertas sin datos
  profesionales simulados ni ganancias ficticias.

## Integridad y concurrencia

- `service_requests` admite `EXPIRED`, moneda, programación y vencimientos.
- Índice parcial único garantiza una oferta aceptada por solicitud.
- Triggers de transición rechazan saltos o reaperturas no permitidas.
- Trigger diferible exige que una solicitud aceptada tenga exactamente una
  oferta aceptada y ninguna pendiente.
- Una migración correctiva separó la reapertura `BIDDING -> PENDING` al retirar
  la última oferta; otra endureció el trigger polimórfico usando proyección JSON
  segura del registro del trigger.
- El lock por solicitud y el aislamiento `SERIALIZABLE` hacen que dos
  aceptaciones concurrentes produzcan una respuesta exitosa y un conflicto.

## Seguridad

- El actor se deriva de la sesión en todos los comandos.
- Los DTO usan `additionalProperties: false` y el backend rechaza mass assignment.
- Otro paciente recibe `404` al intentar revelar o aceptar una solicitud ajena.
- Un profesional pendiente recibe `403` antes de consultar u ofertar.
- El cuerpo de aceptación debe estar vacío: `finalPrice`, `psychologistId` u
  otros valores fabricados producen `422`.
- La proyección profesional no contiene paciente, contacto ni coordenadas.
- Mutaciones limitadas por frecuencia; errores exponen códigos estables y
  `requestId`, no detalles SQL.

## Tercera forma normal

- La solicitud referencia `patient_profile_id`; no repite identidad del paciente.
- La oferta referencia solicitud y perfil profesional; no repite nombre,
  fotografía, especialidad, rating ni moneda derivable de la solicitud.
- La oferta aceptada se identifica por su estado y por la procedencia exacta
  `care_relationship_sources.accepted_offer_id`; no se copia al registro de
  solicitud.
- `care_relationship_sources` enlaza la relación con la oferta ganadora, desde
  la cual se deriva la solicitud, sin duplicar identificadores de contexto.
- `idempotency_records` conserva el resultado técnico por actor, operación y
  clave; no almacena una copia del recurso de negocio.

## Contrato y migraciones

- Contrato: [`../api/openapi.yaml`](../api/openapi.yaml).
- Columnas y registro de idempotencia: `20260827003000_service_request_offer_columns`.
- Invariantes de estados/aceptación: `20260827004000_service_request_offer_invariants`.
- Reapertura al retirar la última oferta: `20260827005000_allow_offerless_request_reopen`.
- Trigger diferible portable: `20260827006000_harden_acceptance_consistency_trigger`.
- Alineación de procedencia exacta: `20260829001000_consolidate_core_relationships`.

Las migraciones aplicadas no se editaron; cada corrección se agregó como una
migración nueva.

## Verificación ejecutada

- Esquema Prisma formateado y validado.
- Compilación estricta del backend y 16 pruebas unitarias aprobadas.
- Flujo HTTP real contra PostgreSQL: idempotencia, límite de solicitud abierta,
  privacidad, profesional pendiente, oferta única, mass assignment, propiedad,
  precio persistido, dos aceptaciones concurrentes, replay y outbox.
- Typecheck estricto del frontend con Expo SDK 57.
- Dependencias alineadas con Expo 57 (`expo install --check` en verde) y audit
  del backend sin vulnerabilidades conocidas. El audit del frontend conserva 11
  avisos moderados encadenados al `uuid@7` de `xcode` dentro de herramientas Expo;
  la corrección automática propone versiones incompatibles de Expo y no se
  aplicó. Se mantiene como riesgo de build monitoreado, sin `--force`.
- Fixtures de integración eliminados al finalizar; la contraseña local no se
  persiste en pruebas ni scripts.

## Límites productivos que permanecen

Esta fase no habilita por sí sola producción. Continúan abiertos el proveedor
privado y análisis de evidencia, retención/eliminación, rol PostgreSQL de runtime,
secret manager, rotación de credenciales, backups/restauración, observabilidad,
mensajería segura, agenda, historia clínica y revisión legal/clínica.
