# Cierre de la Fase 5 — Mensajería segura en tiempo real

## Estado

Fase completada el 28 de agosto de 2026 para mensajes de texto. La mensajería ya
no depende de MongoDB, salas arbitrarias, polling ni eventos de contenido
originados por el cliente. PostgreSQL es la fuente de verdad y Socket.IO es un
canal de entrega posterior al commit.

Este cierre no habilita archivos, audio, llamadas, ubicación ni RTC. Esas
capacidades permanecen cerradas hasta contar con sus proveedores, políticas y
controles específicos.

## Alcance entregado

- La aceptación idempotente de una oferta crea, en la misma transacción, la
  relación de atención, la conversación, el vínculo con la solicitud y los dos
  participantes.
- El backend expone política, bandeja, detalle, paginación por cursor y envío de
  mensajes en `/api/v1/conversations`.
- El actor se obtiene exclusivamente de la sesión. El cuerpo rechaza
  `sender`, `senderName`, `senderRole`, `roomId` y campos desconocidos.
- `clientMessageId` es UUID y es único por participante. Repetir el mismo UUID y
  contenido devuelve el mismo mensaje; reutilizarlo con otro contenido produce
  conflicto.
- Solo `TEXT` está habilitado y la longitud máxima proviene de configuración y
  del endpoint de política.
- La conversación activa permite lectura y escritura. La conversación pausada
  conserva lectura y suscripción, pero bloquea nuevos mensajes.
- El mensaje, la auditoría y el evento outbox se confirman en una sola
  transacción.
- El worker reclama eventos con `FOR UPDATE SKIP LOCKED`, lease temporal,
  backoff acotado, contador de intentos y dead letter.
- Socket.IO exige access token en el handshake, revalida la sesión, deriva el
  nombre interno de sala y vuelve a autorizar cada suscripción.
- El payload outbox contiene identificadores, no texto del mensaje.
- El frontend usa bandeja y conversación reales, reconcilia por HTTP tras una
  reconexión, deduplica mensajes y reintenta con el mismo identificador.
- Se retiraron chat, salas, llamadas y ubicación simuladas del transporte y de
  la navegación de mensajería.

## Modelo y normalización

El flujo usa estas relaciones:

```text
service_requests 1 ── 1 request_conversations 1 ── 1 conversations
                                                    │
                                                    ├──< conversation_participants >── users
                                                    │
                                                    └──< messages
```

- `request_conversations` expresa el contexto sin duplicar la solicitud en
  `conversations`.
- `conversation_participants` expresa la pertenencia; el mensaje referencia al
  participante y no repite usuario, rol, nombre ni conversación.
- `(conversation_participant_id, client_message_id)` es una clave candidata
  adicional de `messages`.
- La relación asistencial se deriva por la fuente normalizada de la solicitud;
  no se copia paciente o psicólogo en la conversación.
- `outbox_events.payload` es un sobre técnico y no sustituye relaciones del
  dominio.

El modelo conserva 1FN, 2FN y 3FN. Los índices siguen los cursores de bandeja y
mensajes; las restricciones de longitud e idempotencia también existen en
PostgreSQL.

## Contrato HTTP y tiempo real

HTTP es la autoridad para comandos y confirmaciones:

```text
GET  /api/v1/conversations/policy
GET  /api/v1/conversations
GET  /api/v1/conversations/{conversationId}
GET  /api/v1/conversations/{conversationId}/messages
POST /api/v1/conversations/{conversationId}/messages
```

El único contrato público de Socket.IO de esta fase es:

```text
cliente -> conversation.subscribe
cliente -> conversation.unsubscribe
servidor -> message.created
```

El servidor construye internamente `conversation:<uuid>`. El cliente nunca
elige un nombre de sala ni publica mensajes por Socket.IO. La entrega es al
menos una vez; el receptor deduplica por identificador y siempre puede
rehidratar el estado por HTTP.

## Controles de seguridad

- capacidades `conversation:read:self` y `conversation:send:self`;
- verificación de participante y estado dentro del repositorio;
- ocultamiento con `404` frente a identificadores ajenos;
- máximo configurable de suscripciones por socket;
- revalidación periódica de sesión y desconexión ante revocación;
- límite de mutaciones por usuario/IP y buffer Socket.IO reducido;
- validación cerrada de UUID, cursor, dirección, tipo y cuerpo;
- mensajes, tokens y payloads no aparecen en logs;
- auditoría contiene identificadores y tipo, no el texto;
- readiness degrada ante retraso configurado o dead letters de mensajería.

## Evidencia de validación

- Prisma format, validate y generate: correctos.
- TypeScript backend, pruebas y frontend: sin errores.
- 19 pruebas unitarias/Socket: 19 aprobadas.
- Base aislada `ruta_emocional_test_phase5`: 13 migraciones aplicadas y al día.
- Integración HTTP PostgreSQL: autenticación, directorio, solicitudes/ofertas y
  mensajería aprobadas sin exclusiones.
- Casos negativos: suscriptor ajeno, conversación ajena, identidad de remitente
  forjada, cursor inválido, tipo no soportado y reutilización conflictiva del
  identificador.
- Caso concurrente: una sola oferta ganadora y una sola conversación.
- Caso de recuperación: outbox publicado y reintento HTTP sin duplicación.
- Rol runtime grupal aplicado y verificado localmente; backup de 13 migraciones
  restaurado y validado en una base desechable.

## Límites que permanecen abiertos

- Los objetos profesionales necesitan proveedor privado, URL firmada,
  cuarentena, antimalware y política de retención aprobada.
- El script de privilegios mínimos ya incluye las tablas de mensajería, pero el
  login runtime separado aún debe crearse, probarse y convertirse en la
  credencial real de la aplicación.
- El gestor externo de secretos, la rotación coordinada de PostgreSQL y la
  separación futura del worker outbox requieren infraestructura aprobada.
- Readiness y logs estructurados ya exponen señales, pero el colector, dashboard
  y reglas de alerta externas continúan pendientes.
- Backup/restauración, carga, pentest y revisión legal siguen siendo gates de
  producción.
- Citas, historial, MENTA, pagos y RTC se retirarán o implementarán en sus fases.

## Siguiente incremento

La Fase 6 implementa agenda: disponibilidad efectiva, slots calculados en el
servidor, citas sin solapamiento, zona horaria, transiciones auditadas,
recordatorios y sustitución del historial simulado. La historia clínica se
mantiene como Fase 7 y requiere aprobación clínica/jurídica previa de sus campos.
