# Observabilidad y alertas de producción

## Señales disponibles

- logs JSON con `requestId`, ruta normalizada, código HTTP y duración;
- liveness de proceso;
- readiness de PostgreSQL, outbox y solicitudes de privacidad vencidas;
- dead letters, intentos y atraso del outbox;
- evidencia fechada de la última restauración y RPO/RTO configurados;
- fallos de arranque por secretos, rol runtime, aprobación MENTA o recursos.

Los logs no deben contener tokens, contraseñas, texto clínico, respuestas MENTA,
ubicación precisa ni payloads de mensajes. El saneador central debe mantenerse
activo antes de integrar un colector.

## Matriz mínima

| Señal | Umbral inicial | Severidad | Responsable |
|---|---|---|---|
| readiness 503 | 2 comprobaciones consecutivas | crítica | guardia de plataforma |
| tasa 5xx | >2 % durante 5 min | alta | backend |
| p95 HTTP | >1 s durante 10 min | media | backend |
| DB sin conexión | 1 evento | crítica | plataforma/DBA |
| outbox atrasado | ventana configurada | alta | backend |
| dead letter | 1 evento | alta | backend |
| solicitud de privacidad vencida | 1 solicitud | crítica | privacidad |
| backup fallido o ausente | 1 ciclo | crítica | plataforma/DBA |
| restore más antiguo que máximo | al arrancar/deploy | crítica | plataforma/DBA |
| recursos de crisis próximos a vencer | 7 días | alta | product safety |

## Integración externa pendiente

El proveedor debe recolectar stdout/stderr estructurado, consultar readiness,
mantener paneles, enrutar alertas y conservar evidencia de reconocimiento y
resolución. `OBSERVABILITY_PROVIDER` y `OBSERVABILITY_ALERTING_ENABLED=true`
son obligatorios en producción, pero nombrarlos no sustituye una alerta de
prueba recibida por la guardia.

La selección final depende del hosting. Se aceptan OpenTelemetry/collector y un
backend administrado, o el stack nativo de la nube, siempre que cumpla
residencia, control de acceso, redacción y retención aprobadas.
