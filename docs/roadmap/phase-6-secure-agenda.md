# Cierre de la Fase 6 — Agenda y citas seguras

## Estado

Fase completada el 28 de agosto de 2026 para agenda transaccional y
recordatorios dentro de la aplicación. El historial ficticio fue eliminado y PostgreSQL es la única
fuente de verdad de disponibilidad, citas y transiciones.

Los avisos con la aplicación cerrada no se presentan como terminados: requieren
un proveedor push y una compilación de desarrollo/producción de Expo, además de
consentimiento y observabilidad.

## Alcance entregado

- módulo backend independiente de agenda con dominio, aplicación, puertos,
  repositorio Prisma y presentación HTTP;
- relaciones de atención elegibles sin copiar identidades;
- cálculo de slots en servidor con reglas semanales, excepciones `AVAILABLE` y
  `UNAVAILABLE`, zona IANA, duración e intervalo configurables;
- revalidación del espacio dentro de una transacción serializable;
- exclusión GiST para solapamientos activos de paciente y psicólogo;
- creación idempotente y derivación server-side de participantes, fin y zona;
- confirmación, inicio, finalización, cancelación, no-show y reprogramación como
  comandos cerrados;
- política configurable de anticipación, horizonte, cancelación y ventana de
  inicio;
- `appointment_events` para actor, transición y horario anterior;
- auditoría y outbox en la misma transacción;
- eventos `appointment.created`, `appointment.updated`,
  `appointment.rescheduled` y `appointment.reminder_due`;
- invalidación y recordatorios en salas internas por usuario;
- pantalla minimalista de Agenda para ambos roles, con iconos Material Icons,
  próximos/historial, reserva, reprogramación y acciones por estado;
- eliminación completa de `MOCK_HISTORY`.

## Contrato HTTP

```text
GET  /api/v1/appointments/policy
GET  /api/v1/appointment-relationships
GET  /api/v1/appointment-slots
GET  /api/v1/appointments
POST /api/v1/appointments
POST /api/v1/appointments/{appointmentId}/transitions
POST /api/v1/appointments/{appointmentId}/reschedule
```

Los tres comandos mutables requieren `Idempotency-Key`. Fechas de entrada usan
ISO 8601 con zona explícita. Campos de actor, duración, fin, zona y estado son
rechazados.

## Seguridad y concurrencia

- capacidad de lectura/gestión propia para participantes;
- creación limitada al paciente en el flujo actual;
- psicólogo verificado para toda disponibilidad o transición profesional;
- propiedad y relación comprobadas nuevamente en el repositorio;
- `404` para un identificador ajeno;
- límites de mutación configurables;
- advisory lock por operación idempotente;
- aislamiento serializable con retry/backoff acotado;
- restricciones PostgreSQL como última línea de defensa;
- payloads realtime sin contenido clínico.

## Recordatorios

Los minutos previos se configuran en `APPOINTMENT_REMINDER_MINUTES_BEFORE`. Al
crear o reprogramar se añaden eventos outbox futuros. Al vencer, el worker lee la
cita canónica: solo emite si el horario coincide y el estado sigue siendo
`SCHEDULED` o `CONFIRMED`. Esto invalida de forma segura recordatorios antiguos
sin intentar borrar historial técnico.

La entrega actual es en-app y al menos una vez. Push con la aplicación cerrada
permanece deshabilitado hasta seleccionar y operar un proveedor.

## Evidencia de validación

- migración `20260828004000_secure_appointment_agenda` aplicada en la base local;
- Prisma format y validate correctos; cliente de tipos actualizado;
- backend y frontend sin errores TypeScript;
- 23 pruebas unitarias aprobadas;
- 6 integraciones de regresión aprobadas en una base temporal con las 15
  migraciones aplicadas desde cero;
- prueba HTTP PostgreSQL aprobada con reserva concurrente `201/409`, replay
  idempotente, aislamiento de tercero, confirmación profesional, eventos,
  auditoría y dos recordatorios programados;
- interfaz sin mocks, emojis ni dependencias visuales improvisadas.

## Gates que permanecen abiertos

- proveedor push y métricas de entrega para recordatorios fuera de la app;
- proveedor privado, firma, cuarentena y antimalware de evidencias;
- gestor externo de secretos y rotación coordinada de credenciales;
- rol PostgreSQL runtime realmente aplicado como credencial de la app;
- backup/restore periódico, alertas externas, carga y pentest;
- política legal de retención y eliminación;
- MENTA, pagos y RTC reales en sus fases.

## Siguiente incremento

La Fase 7 implementa historia clínica. Antes de escribir campos clínicos deben
aprobarse alcance jurídico/clínico, consentimiento, acceso del paciente,
retención y separación estricta del administrador de plataforma.
