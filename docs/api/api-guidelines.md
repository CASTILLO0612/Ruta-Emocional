# Convenciones de API y tiempo real

## 1. Objetivo de compatibilidad

El frontend actual conserva pantallas, navegación y componentes. La integración cambia servicios, repositorios y stores mediante adaptadores. Los componentes no deben depender de documentos MongoDB, nombres `_id`, modelos Prisma ni detalles de transporte.

```text
Pantalla
  └── Store/caso de interacción
        └── Puerto de aplicación del frontend
              └── Adaptador HTTP/WebSocket v1
                    └── Backend
```

Durante la transición puede existir un adaptador de compatibilidad, pero no dos reglas de negocio distintas.

## 2. Base y versionado

- Prefijo: `/api/v1`.
- El número mayor cambia solo ante una ruptura de contrato.
- Cambios compatibles agregan campos opcionales o endpoints.
- El cliente ignora campos desconocidos y no depende del orden JSON.
- Rutas legacy `/api/*` se retiran mediante deprecación medible, no se mantienen indefinidamente.
- El documento ejecutable inicial está en [openapi.yaml](openapi.yaml).

## 3. Nombres y representaciones

- JSON externo usa `camelCase`.
- PostgreSQL usa `snake_case` mediante mapeo Prisma.
- Identificadores externos son UUID como strings opacos.
- Fechas/instantes son RFC 3339 UTC, por ejemplo `2026-08-25T18:30:00.000Z`.
- Fechas civiles usan `YYYY-MM-DD`.
- Zonas horarias usan nombres IANA, por ejemplo `America/Managua`.
- Dinero se representa como string decimal y código ISO 4217:

```json
{
  "amount": "600.00",
  "currency": "NIO"
}
```

- Los enums de API usan `UPPER_SNAKE_CASE` y no los textos localizados de la interfaz.
- Los campos opcionales ausentes se omiten; `null` significa ausencia conocida solo cuando el esquema lo permite.

## 4. Respuestas

### Recurso único

```json
{
  "data": {
    "id": "uuid",
    "status": "PENDING"
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

### Colección

```json
{
  "data": [],
  "page": {
    "nextCursor": null,
    "hasMore": false
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

- Las colecciones crecientes usan cursor, no offset.
- `limit` tiene valor predeterminado y máximo.
- No se devuelve un conteo total costoso salvo necesidad demostrada.

### Sin contenido

Operaciones como logout pueden devolver `204 No Content`.

## 5. Errores

Se usa `application/problem+json` compatible con Problem Details:

```json
{
  "type": "https://ruta-emocional.example/problems/validation-error",
  "title": "La solicitud no es válida",
  "status": 422,
  "detail": "Revisa los campos indicados.",
  "instance": "/api/v1/auth/register/patient",
  "code": "VALIDATION_ERROR",
  "requestId": "uuid",
  "errors": [
    {
      "field": "email",
      "code": "INVALID_EMAIL",
      "message": "Ingresa un correo válido."
    }
  ]
}
```

`code` es estable y la UI lo puede mapear a traducciones. `detail` no contiene excepciones, SQL, stack traces, nombres de tablas ni respuestas de proveedores.

| HTTP | Uso |
|---:|---|
| `400` | JSON mal formado o protocolo inválido |
| `401` | autenticación ausente, inválida o expirada |
| `403` | actor autenticado sin permiso |
| `404` | recurso inexistente o existencia deliberadamente oculta |
| `409` | estado concurrente, duplicado o transición incompatible |
| `422` | validación de campos/reglas de entrada |
| `429` | límite de consumo |
| `500` | fallo interno no revelado |
| `502` | dependencia externa falló |
| `503` | servicio no listo o dependencia crítica indisponible |

## 6. Autenticación

### Endpoints

```text
POST /api/v1/auth/register/patient
POST /api/v1/auth/register/psychologist
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/logout-all
GET  /api/v1/auth/me
```

- El registro de psicólogo crea perfil y licencia `PENDING`.
- Login devuelve un access token corto y, en nativo, refresh token opaco.
- En web, el refresh token se migrará a cookie HttpOnly y no se expondrá a JavaScript.
- `/me` es la fuente para rehidratar rol, estado y perfil; el frontend no confía en su caché.
- Los errores de login son uniformes.

## 7. Directorio profesional

```text
GET /api/v1/psychologists
GET /api/v1/psychologists/{psychologistId}
GET /api/v1/psychologists/me
PATCH /api/v1/psychologists/me
PUT /api/v1/psychologists/me/modalities/{modality}
PUT /api/v1/psychologists/me/availability
POST /api/v1/psychologists/me/availability-exceptions
```

Filtros públicos permitidos:

```text
specialty, modality, minPrice, maxPrice,
availableFrom, availableUntil, latitude, longitude, radiusKm,
cursor, limit
```

La geoconsulta no devuelve ubicación exacta del profesional; devuelve distancia aproximada cuando sea apropiado.

## 8. Solicitudes y ofertas

```text
POST /api/v1/service-requests
GET  /api/v1/service-requests/me
GET  /api/v1/service-requests/available
GET  /api/v1/service-requests/{requestId}
POST /api/v1/service-requests/{requestId}/cancel

POST /api/v1/service-requests/{requestId}/offers
GET  /api/v1/service-requests/{requestId}/offers
POST /api/v1/offers/{offerId}/withdraw
POST /api/v1/offers/{offerId}/accept
```

La creación no acepta `patientId`, nombre o fotografía. La oferta no acepta datos proyectados del psicólogo. La aceptación no acepta monto final ni psicólogo: todos se derivan de la oferta y sesión.

Ejemplo de solicitud programada:

```json
{
  "modality": "CALL",
  "primaryNeed": "Manejo de ansiedad",
  "description": "Quisiera conversar sobre episodios recientes.",
  "budget": { "amount": "600.00", "currency": "NIO" },
  "desiredWindow": {
    "startsAt": "2026-08-27T21:00:00.000Z",
    "endsAt": "2026-08-28T01:00:00.000Z",
    "timezone": "America/Managua"
  }
}
```

`desiredWindow` requerirá campos normalizados antes de implementación porque el esquema actual no los contiene. No se codifica dentro de `description`.

## 9. Relaciones y citas

```text
GET  /api/v1/care-relationships
GET  /api/v1/care-relationships/{relationshipId}
POST /api/v1/care-relationships/{relationshipId}/pause
POST /api/v1/care-relationships/{relationshipId}/resume
POST /api/v1/care-relationships/{relationshipId}/end

GET  /api/v1/psychologists/{psychologistId}/slots
POST /api/v1/appointments
GET  /api/v1/appointments
GET  /api/v1/appointments/{appointmentId}
POST /api/v1/appointments/{appointmentId}/confirm
POST /api/v1/appointments/{appointmentId}/reschedule
POST /api/v1/appointments/{appointmentId}/cancel
POST /api/v1/appointments/{appointmentId}/start
POST /api/v1/appointments/{appointmentId}/complete
POST /api/v1/appointments/{appointmentId}/no-show
```

No se expone `PATCH /appointments/{id}/status`; cada transición tiene intención, permisos y validación propios.

## 10. Conversaciones

```text
GET  /api/v1/conversations/policy
GET  /api/v1/conversations
GET  /api/v1/conversations/{conversationId}
GET  /api/v1/conversations/{conversationId}/messages
POST /api/v1/conversations/{conversationId}/messages
```

Enviar mensaje incluye:

```json
{
  "clientMessageId": "uuid-generado-por-cliente",
  "type": "TEXT",
  "text": "Hola"
}
```

No incluye sender, senderRole, senderName ni roomId. El servidor deriva identidad y conversación.

La lectura usa cursor opaco y dirección `before` o `after`. El envío responde
`201` al crear y `200` al reproducir idempotentemente el mismo
`clientMessageId`. Usar el mismo identificador con otro texto responde `409`.
Archivos y audio no forman parte de este contrato mientras no exista
almacenamiento privado con cuarentena y análisis antimalware.

Socket.IO solo expone `conversation.subscribe`, `conversation.unsubscribe` y
`message.created`. La suscripción recibe `conversationId`, pero la sala se deriva
en el servidor. El cliente reconcilia por HTTP al conectar o reconectar porque el
socket es entrega, no fuente de verdad.

## 11. Historia clínica

```text
GET  /api/v1/patients/{patientId}/clinical-record
POST /api/v1/clinical-records/{recordId}/encounters
GET  /api/v1/clinical-encounters/{encounterId}
POST /api/v1/clinical-encounters/{encounterId}/notes
PATCH /api/v1/clinical-notes/{noteId}/draft
POST /api/v1/clinical-notes/{noteId}/sign
POST /api/v1/clinical-notes/{noteId}/amendments
POST /api/v1/clinical-records/{recordId}/diagnoses
POST /api/v1/clinical-records/{recordId}/treatment-plans
POST /api/v1/clinical-records/{recordId}/exports
```

- Las rutas son orientativas hasta completar revisión jurídica/clínica.
- Las respuestas clínicas son DTO por capacidad; no devuelven todo el expediente automáticamente.
- Exportación es trabajo asíncrono, auditado y con enlace temporal.

## 12. MENTA

```text
POST /api/v1/triage/assessments
GET  /api/v1/triage/assessments/{assessmentId}
POST /api/v1/triage/assessments/{assessmentId}/review
```

La respuesta separa riesgo y orientación de cualquier decisión comercial:

```json
{
  "data": {
    "id": "uuid",
    "riskLevel": "MODERATE",
    "primaryNeed": "Apoyo emocional",
    "recommendedModalities": ["CALL"],
    "summary": "...",
    "requiresImmediateHelp": false,
    "safetyActions": []
  }
}
```

Un riesgo `HIGH` o `CRITICAL` no devuelve presupuesto sugerido.

## 13. Idempotencia y concurrencia

- Header `Idempotency-Key`: UUID generado por cliente.
- Ámbito: actor + ruta + clave.
- El servidor guarda hash del request y respuesta final durante una ventana definida.
- Repetir misma clave y mismo request devuelve la respuesta original.
- Misma clave con otro payload devuelve `409 IDEMPOTENCY_KEY_REUSED`.
- Usos obligatorios: aceptar oferta, reservar/reprogramar cita, pago, exportación y comandos externos reintentables.
- Para actualizaciones de borrador se usa control optimista mediante versión o `If-Match`.

El esquema necesitará una tabla de idempotencia antes de habilitar estos comandos en producción.

## 14. WebSocket v1

### Conexión

- Namespace: `/realtime/v1`.
- Access token en `auth.accessToken` durante handshake.
- El servidor rechaza sesión inválida y asigna salas internas por usuario.
- Al expirar el token, el cliente renueva y reconecta.

### Comandos permitidos desde el cliente

```text
conversation.subscribe { conversationId, afterCursor? }
conversation.unsubscribe { conversationId }
presence.heartbeat {}
rtc.signal { appointmentId, payload }        # solo si RTC está habilitado
location.publish { appointmentId, coordinates } # solo presencial y consentido
```

Cada comando responde con ACK:

```json
{ "ok": true, "requestId": "uuid" }
```

o:

```json
{ "ok": false, "code": "FORBIDDEN", "requestId": "uuid" }
```

### Eventos del servidor

```text
serviceRequest.created
serviceRequest.updated
offer.created
offer.updated
offer.accepted
appointment.created
appointment.updated
message.created
conversation.updated
rtc.incoming
rtc.accepted
rtc.ended
location.updated
```

Todos incluyen `eventId`, `occurredAt`, `type`, `data` y, cuando aplica, `aggregateVersion`. El cliente deduplica por `eventId` y reconcilia mediante HTTP.

## 15. Integración gradual con el frontend

1. Crear DTO v1 y adaptador frontend.
2. Conectar autenticación y rehidratación.
3. Conectar directorio.
4. Conectar solicitudes/ofertas sin eventos del cliente.
5. Reemplazar salas libres por suscripciones autorizadas.
6. Conectar agenda.
7. Conectar historia clínica en vistas nuevas de psicólogo.
8. Retirar repositorios legacy, polling y mocks.

Cada cambio mantiene una feature flag y una prueba end-to-end antes de retirar el flujo anterior.
