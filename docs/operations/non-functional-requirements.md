# Requisitos no funcionales

Estos objetivos convierten “robusto y escalable” en condiciones medibles. Son la línea base del MVP y deben ajustarse con telemetría real, no mediante optimización especulativa.

## 1. Hipótesis de capacidad inicial

La primera prueba de carga se diseña para:

- 10 000 cuentas registradas;
- 1 000 usuarios activos diarios;
- 500 conexiones WebSocket simultáneas;
- 50 solicitudes HTTP por segundo sostenidas;
- ráfagas de 100 solicitudes por segundo durante un minuto;
- 20 mensajes por segundo sostenidos;
- 100 000 mensajes y 50 000 eventos de auditoría como conjunto inicial de prueba;
- al menos dos veces el pico esperado antes de cada lanzamiento.

Estas cifras son objetivos de validación, no una afirmación de demanda. Un único backend bien diseñado y PostgreSQL administrado pueden cubrir esta etapa; no justifican microservicios.

## 2. Disponibilidad y recuperación

| Indicador | MVP beta | Objetivo posterior |
|---|---:|---:|
| Disponibilidad mensual del API | 99.5% | 99.9% |
| Error inesperado 5xx | < 0.5% | < 0.1% |
| RPO | ≤ 15 minutos | ≤ 5 minutos |
| RTO | ≤ 4 horas | ≤ 1 hora |
| Restauración de backup probada | antes de beta y mensual | mensual/automatizada |

MENTA no se anuncia como servicio de emergencia y debe fallar de forma segura cuando el proveedor externo no esté disponible.

## 3. Latencia

Medida en el servidor, sin incluir red móvil y salvo dependencia externa:

| Operación | p50 | p95 | p99 |
|---|---:|---:|---:|
| Health/liveness | 20 ms | 50 ms | 100 ms |
| Lectura por ID o `/me` | 80 ms | 250 ms | 600 ms |
| Listado paginado/directorio | 120 ms | 400 ms | 900 ms |
| Mutación transaccional | 150 ms | 500 ms | 1 000 ms |
| Envío de mensaje hasta ACK persistido | 150 ms | 500 ms | 1 000 ms |
| Evento en tiempo real después de commit | 250 ms | 1 000 ms | 2 000 ms |

Integraciones externas tienen presupuesto propio y timeout. No mantienen una transacción de PostgreSQL abierta mientras esperan una red externa.

## 4. Base de datos

- Pool por instancia limitado y menor que el máximo total de PostgreSQL.
- `statement_timeout` y `idle_in_transaction_session_timeout` configurados.
- Transacciones breves, sin llamadas HTTP dentro de ellas.
- Índices revisados contra consultas y `EXPLAIN (ANALYZE, BUFFERS)` con datos representativos.
- Cero consultas no paginadas sobre tablas crecientes.
- Cero patrón N+1 en listados; presupuesto inicial de hasta 5 consultas SQL por endpoint de lectura común.
- Umbral de slow query inicial: 500 ms, con alerta y plan de análisis.
- Autovacuum y estadísticas supervisados.
- Migraciones bloqueantes evaluadas con datos equivalentes a producción.
- Restricciones de integridad conservadas incluso si una validación existe en aplicación.

## 5. Paginación y límites

| Recurso | Predeterminado | Máximo |
|---|---:|---:|
| Psicólogos | 20 | 50 |
| Solicitudes | 20 | 50 |
| Citas | 25 | 100 |
| Conversaciones | 20 | 50 |
| Mensajes | 50 | 100 |
| Auditoría administrativa | 50 | 200 |

- Cursor estable por `(createdAt, id)` o clave equivalente.
- Los cuerpos JSON tienen límite global inicial de 256 KiB; endpoints normales usan límites menores.
- Mensaje de texto: máximo inicial 4 000 caracteres.
- Descripción de solicitud: máximo inicial 2 000 caracteres.
- Archivos no atraviesan Express como base64; se cargan directamente a almacenamiento privado.

Los valores son configuración centralizada y pueden variar mediante decisión de producto; no se duplican en pantallas.

## 6. Caché

Prioridades de caché:

1. no introducir caché hasta medir;
2. catálogos y perfiles públicos con TTL corto/ETag;
3. rate limiting y presencia en Redis cuando haya múltiples instancias;
4. nunca usar caché compartida para notas o conversaciones sin clave, cifrado y política específicas.

La caché no puede ser fuente de verdad de aceptación, citas, pagos, consentimientos o clínica.

## 7. Trabajos asíncronos

Se ejecutan fuera de la petición:

- notificaciones y recordatorios;
- expiración de solicitudes/ofertas;
- entrega de outbox;
- webhooks reintentables;
- exportaciones clínicas;
- análisis y cuarentena de archivos;
- conciliación de pagos;
- limpieza según retención.

Propiedades:

- al menos una entrega con consumidor idempotente;
- backoff exponencial con jitter;
- máximo de intentos y dead-letter operativa;
- métricas de antigüedad del evento más antiguo;
- trazabilidad por `eventId`/`correlationId`.

## 8. Escalabilidad

### Escala vertical inicial

- una API modular;
- un worker separable del mismo código;
- PostgreSQL con PostGIS;
- object storage;
- Redis solo cuando presencia/rate limiting multiinstancia lo requieran.

### Escala horizontal

La API permanece stateless salvo tokens/sesiones persistidos. Socket.IO requerirá adaptador compartido y afinidad solo si el mecanismo elegido lo demanda. Outbox evita perder eventos al escalar instancias.

### Criterios para extraer un servicio

Solo se evalúa cuando existe al menos uno:

- necesidad de escalado radicalmente distinta y demostrada;
- límite regulatorio/de aislamiento;
- equipo con propiedad independiente;
- disponibilidad diferente;
- cuello de botella no resoluble dentro del monolito.

Pagos o RTC pueden convertirse en módulos/adaptadores separados antes que el dominio clínico.

## 9. Observabilidad

### Golden signals

- tasa y latencia por ruta/operación;
- errores por código estable;
- conexiones activas y fallos WebSocket;
- saturación de CPU/memoria/event loop;
- pool DB, tiempo de espera y slow queries;
- retraso y fallos del outbox;
- tiempo/respuesta de proveedores;
- intentos de autenticación y bloqueos;
- denegaciones clínicas y accesos excepcionales.

### Trazas

- `requestId` en cada petición y respuesta;
- `correlationId` conserva el viaje entre HTTP, transacción, outbox y worker;
- propagación a proveedores sin PII;
- sampling que prioriza errores, sin capturar payload clínico.

### Alertas iniciales

- 5xx > 2% durante 5 minutos;
- p95 de endpoints críticos supera objetivo durante 10 minutos;
- readiness falla en dos comprobaciones;
- pool DB > 80% o espera sostenida;
- outbox más antiguo > 2 minutos;
- webhook con fallos consecutivos;
- backup o restore test fallido;
- reutilización de refresh token o acceso excepcional clínico.

## 10. Confiabilidad

- Graceful shutdown deja de aceptar tráfico, drena HTTP/socket y cierra Prisma.
- Readiness falla durante migraciones incompatibles o pérdida de DB; liveness no depende de proveedores opcionales.
- Retries solo para operaciones idempotentes y errores transitorios.
- Circuit breaker para IA, pagos, mapas, notificaciones y RTC.
- Timeouts explícitos por dependencia.
- Feature flags permiten apagar integraciones sin desplegar.
- Los eventos se reconcilian desde la fuente de verdad después de una reconexión.

## 11. Calidad

### Pirámide mínima

- pruebas unitarias para reglas, políticas, parsers y transiciones;
- pruebas de integración con PostgreSQL real para repositorios y restricciones;
- contract tests contra OpenAPI;
- pruebas de WebSocket autenticado;
- end-to-end de flujos paciente/psicólogo;
- carga para rutas críticas;
- seguridad negativa para cada autorización positiva.

### Puertas CI

- TypeScript estricto;
- lint/format;
- unit/integration tests;
- migración sobre base vacía;
- detección de drift;
- audit de dependencias sin vulnerabilidades críticas/altas no aceptadas;
- secret scanning;
- SAST;
- OpenAPI válida y compatible;
- build reproducible.

Objetivo de cobertura por sí solo no garantiza calidad. Como indicador inicial: 80% de líneas/ramas en dominio y aplicación, y 100% de transiciones y decisiones de autorización críticas.

## 12. Compatibilidad móvil

El repositorio exige revisar Expo SDK 57 antes de modificar código. El frontend actual declara SDK 54, por lo que la actualización será una tarea separada:

- SDK 57 apunta a React Native 0.86, React 19.2.3 y Node mínimo 22.13.x según la documentación versionada;
- se actualizará un SDK mayor a la vez o mediante una rama/ventana controlada;
- se ejecutará `expo install --fix`, diagnóstico y pruebas Android/iOS/web;
- SecureStore se integrará con la versión compatible del SDK activo;
- la actualización no se mezclará con el cutover de un módulo crítico sin un rollback claro.

## 13. Criterio de rendimiento terminado

Una funcionalidad no está lista porque “funciona” localmente. Debe:

- cumplir los percentiles objetivo con datos representativos;
- no tener N+1 ni colecciones ilimitadas;
- soportar reintentos sin duplicar efectos;
- exponer métricas suficientes;
- degradarse de forma segura;
- conservar autorización e integridad bajo concurrencia.
