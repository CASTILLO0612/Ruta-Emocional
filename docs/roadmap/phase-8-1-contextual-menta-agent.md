# Fase 8.1 — Agente contextual MENTA

**Estado:** incremento funcional implementado el 1 de septiembre de 2026.

## Resultado

MENTA vuelve a ser una conversación integrada para pacientes y psicólogos sin
eliminar la orientación determinista de seguridad. El agente no recibe acceso
general a la base: razona sobre herramientas pequeñas, tipadas y autorizadas.

### Paciente

- consulta próximas citas y solicitudes propias;
- consulta psicólogos verificados, modalidades, tarifa, disponibilidad y reseñas;
- recibe motivación breve no clínica;
- accede por separado al cuestionario estructurado de seguridad.

### Psicólogo verificado

- consulta su agenda y pacientes con relación asistencial vigente;
- obtiene contexto reciente autorizado de citas, mensajes, encuentros y planes;
- prepara borradores que permanecen fuera del expediente hasta revisión humana;
- no puede usar MENTA para consultar un paciente ajeno.

## Backend y PostgreSQL

La migración `20260901001000_contextual_menta_agent` incorpora:

| Tabla | Responsabilidad | Dependencia funcional |
|---|---|---|
| `menta_conversations` | propietario, alcance y consentimiento | `id → user_id, scope, consent_version, fechas` |
| `menta_turns` | mensaje/respuesta cifrados e idempotencia | `id → conversation_id, client_message_id, contenidos, resultado, modelo, fechas` |
| `menta_tool_invocations` | evidencia mínima de herramienta | `id → turn_id, tool_code, outcome, recurso, cantidad, fecha` |

Existe una sola conversación abierta por usuario y alcance. La pareja
`conversation_id + client_message_id` es única. Las herramientas no duplican
entidades del negocio y sus resultados no se persisten dentro del turno.

Rutas:

```text
GET  /api/v1/menta/bootstrap?scope=PATIENT|PSYCHOLOGIST
POST /api/v1/menta/conversations
POST /api/v1/menta/conversations/{conversationId}/turns
```

## Seguridad aplicada

- autenticación y capacidad `menta:use:self`;
- coincidencia obligatoria entre rol y alcance;
- capacidad `clinical:read:authorized` y relación activa para contexto clínico;
- consentimiento versionado previo;
- detector determinista de crisis antes del proveedor;
- límite por usuario, tamaño máximo e idempotencia por mensaje;
- cifrado AES-GCM con contexto distinto para mensaje y respuesta;
- Interactions API stateless con `store=false`;
- protección contra instrucciones incluidas en resultados de herramientas;
- auditoría de apertura, envío, respuesta y herramientas sin texto sensible;
- fallback visible ante indisponibilidad o salida rechazada;
- cero operaciones automáticas de escritura clínica o de negocio.

## Frontend Expo

La pestaña MENTA existe para ambos espacios. La interfaz usa iconos Material,
consentimiento accesible, sugerencias por rol, estados de carga y errores,
distinción visual de fuentes consultadas y aviso persistente de borrador clínico.
No contiene claves del proveedor ni datos simulados.

El flujo profesional pendiente ahora expone un checklist de especialidad,
modalidad/tarifa y evidencia. Si el almacenamiento privado está deshabilitado,
la interfaz explica el bloqueo en lugar de ocultar la sección.

La evidencia local usa `expo-document-picker` con copia al caché y el objeto
`File` de Expo para la carga binaria nativa. La disponibilidad normaliza horas
de una cifra y valida el rango en el dispositivo antes de enviarlo.

## Verificación

- esquema Prisma formateado y cliente generado;
- migración 22 aplicada en PostgreSQL local;
- backend y frontend compilan con TypeScript estricto;
- 46 de 46 pruebas unitarias superadas, incluidas autorización, herramientas,
  crisis previa al modelo y validación de firma de evidencias;
- 9 de 9 suites de integración HTTP/WebSocket superadas contra PostgreSQL,
  incluidas autenticación, verificación profesional, consentimiento MENTA,
  persistencia cifrada y fallback;
- sonda externa confirma disponibilidad del modelo configurado sin transmitir
  datos de usuario;
- validador nativo confirma que no existe clave pública de Gemini.

## Límites productivos

La implementación está disponible para QA local. No debe habilitarse con datos
reales hasta aprobar contrato/tratamiento del proveedor, base jurídica para el
contexto clínico, retención/eliminación de conversaciones, gestor externo de
secretos, pruebas adversariales y observabilidad de latencia/costo sin contenido.

Las futuras acciones mutantes —crear cita, guardar borrador, enviar mensaje—
quedan fuera de este incremento y requerirán confirmación explícita del usuario.
