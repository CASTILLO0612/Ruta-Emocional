# ADR-006 — MENTA como agente contextual con frontera determinista de seguridad

## Estado

**Aceptado el 1 de septiembre de 2026.**

Reemplaza la prohibición general de proveedor externo de ADR-005, pero no
reemplaza el triaje determinista ni sus requisitos de aprobación clínica.

## Contexto

MENTA no es únicamente el cuestionario de orientación. El alcance de producto
requiere una conversación directa que conozca las acciones autorizadas dentro
de Ruta Emocional:

- el paciente consulta citas, solicitudes y profesionales disponibles y puede
  recibir apoyo motivacional no clínico;
- el psicólogo consulta agenda, pacientes vinculados y contexto operativo o
  clínico para preparar borradores;
- MENTA nunca reemplaza al psicólogo, diagnostica, prescribe, firma una nota o
  afirma haber ejecutado una acción que no realizó.

El cuestionario determinista resuelve clasificación y crisis, pero no satisface
la interacción contextual. Mezclar ambos comportamientos en un mismo motor
haría difícil auditar qué parte es una regla aprobada y cuál es generación.

## Decisión

Se implementan dos capacidades complementarias:

1. **Triaje determinista:** conserva preguntas cerradas, reglas versionadas,
   recursos locales y bloqueo comercial ante riesgo crítico.
2. **Agente contextual:** usa un proveedor generativo exclusivamente desde el
   backend y obtiene datos mediante herramientas de lectura autorizadas.

La primera versión del agente cumple estas restricciones:

- cada conversación pertenece a un usuario y a un alcance `PATIENT` o
  `PSYCHOLOGIST` que debe coincidir con su rol y capacidad activa;
- el consentimiento se registra con versión antes del primer mensaje;
- el detector de señales inmediatas de crisis se ejecuta antes del proveedor;
- las herramientas aplican autorización en servidor y nunca aceptan actor desde
  el modelo o el cliente;
- el psicólogo solo consulta pacientes con relación asistencial `ACTIVE` o
  `PAUSED` y capacidad clínica vigente;
- citas, solicitudes, directorio y contexto clínico son lecturas; esta versión
  no ejecuta cambios ni guarda borradores automáticamente;
- mensajes y respuestas se cifran en PostgreSQL; auditoría y logs no contienen
  el texto;
- las llamadas a Gemini usan Interactions API en modo sin almacenamiento
  (`store=false`) y reenvían únicamente el historial local necesario;
- una indisponibilidad o salida rechazada produce una respuesta de contingencia
  explícita, no una simulación de IA exitosa;
- la clave del proveedor es exclusiva del backend y está prohibida en variables
  `EXPO_PUBLIC_*`.

## Modelo y aislamiento

`menta_conversations`, `menta_turns` y `menta_tool_invocations` separan el
consentimiento/conversación, cada turno idempotente y la evidencia de uso de
herramientas. No se duplican citas, solicitudes, perfiles ni expedientes: las
herramientas consultan sus módulos propietarios.

El runtime puede insertar y actualizar conversaciones/turnos, e insertar
evidencia de herramientas. No puede eliminar estos registros; la eliminación o
anonimización corresponde a un proceso operativo separado sujeto a la política
legal de retención.

## Consecuencias

- MENTA puede responder con datos actuales sin otorgar acceso directo del modelo
  a PostgreSQL;
- los borradores profesionales quedan claramente separados de notas firmadas;
- se introduce costo, latencia y dependencia de proveedor, mitigados por timeout,
  límite por usuario y fallback;
- una conversación profesional puede contener datos sensibles y exige contrato,
  evaluación de impacto, residencia/retención y aprobación clínica antes de
  producción;
- cualquier herramienta mutante futura necesitará confirmación humana explícita,
  idempotencia, autorización, auditoría y un ADR o extensión de esta decisión.

## Gate productivo

El código puede habilitarse en desarrollo, pero producción falla cerrada si no
existen proveedor aprobado, gestor externo de secretos, política de retención y
triaje determinista activo. La aprobación local de demostración no constituye
aprobación legal o clínica productiva.
