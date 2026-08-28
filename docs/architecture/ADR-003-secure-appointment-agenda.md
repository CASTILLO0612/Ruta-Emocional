# ADR-003 — Agenda segura basada en relaciones de atención

## Estado

**Aceptado e implementado** el 28 de agosto de 2026.

## Contexto

La interfaz conservaba un historial ficticio y el esquema relacional solo tenía
las tablas base de disponibilidad y cita. El flujo productivo necesita calcular
espacios en el servidor, interpretar horarios IANA, impedir reservas concurrentes,
autorizar por relación asistencial y conservar toda transición relevante.

Permitir que el cliente envíe duración, zona horaria, paciente, psicólogo o estado
convertiría datos de presentación en autoridad de negocio. Mantener documentos de
cita embebidos volvería a introducir duplicaciones propias del modelo MongoDB.

## Decisión

- PostgreSQL conserva reglas semanales, excepciones, citas, su vínculo con la
  relación de atención y una bitácora normalizada de eventos.
- El paciente crea una cita únicamente sobre una relación `ACTIVE`. El servidor
  deriva participantes, duración, fin y zona horaria.
- Los slots se generan en PostgreSQL desde reglas y excepciones, y se vuelven a
  validar dentro de la transacción de reserva.
- Las restricciones de exclusión GiST protegen al paciente y al psicólogo frente
  a intervalos activos solapados, incluso bajo carreras entre instancias.
- Los comandos son cerrados: confirmar, iniciar, completar, cancelar, marcar
  inasistencia y reprogramar. No existe `PATCH status` genérico.
- La reprogramación devuelve la cita a `SCHEDULED` y registra estado y horario
  anteriores en `appointment_events`.
- Cada mutación escribe cita, evento, auditoría y outbox en una transacción
  serializable e idempotente.
- Los recordatorios configurables se programan como eventos técnicos outbox. El
  dispatcher comprueba que la cita siga activa y conserve el mismo horario antes
  de notificar; un evento obsoleto se consume sin emitir.
- HTTP es la confirmación primaria. Socket.IO solo invalida/refresca la proyección
  y entrega recordatorios dentro de una sesión conectada.

## Normalización

`appointment_events` no duplica participante, modalidad ni horario actual. Su
clave determina actor, tipo, transición y, solo para una reprogramación, el
intervalo anterior. Los nombres se obtienen desde `users`; la pertenencia se
obtiene desde `appointment_care_relationships`. El payload outbox es un sobre
técnico reconstruible y no una fuente canónica.

El resultado conserva 1FN, 2FN y 3FN.

## Consecuencias

- Una relación pausada o finalizada bloquea nuevas reservas.
- Una credencial profesional revocada bloquea slots y reservas nuevas.
- Una cita terminal deja de reservar el intervalo, pero no se elimina.
- Un recordatorio WebSocket no garantiza aviso con la aplicación cerrada. Push
  móvil requiere proveedor, credenciales, consentimiento y política operativa;
  permanece como gate explícito.
- La duración fija es una política configurable del MVP. Duraciones por servicio
  exigirán un catálogo normalizado antes de habilitarse.

## Evidencia exigida

- prueba concurrente con un único ganador;
- repetición con la misma clave idempotente;
- rechazo de un tercero sin revelar existencia;
- transición profesional auditada;
- eventos de recordatorio configurados y vinculados al horario vigente;
- typecheck de backend y frontend;
- migración aplicada y contrato OpenAPI actualizado.
