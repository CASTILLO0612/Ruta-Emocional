# Modelo de amenazas

## 1. Alcance y método

Este modelo cubre la aplicación Expo, API REST, WebSockets, PostgreSQL, migración desde MongoDB e integraciones previstas. Se combina STRIDE con riesgos de OWASP API Security y riesgos particulares de datos clínicos.

Escala:

- **Crítica**: puede causar daño a personas, exposición clínica extensa, fraude o control administrativo.
- **Alta**: acceso no autorizado relevante, manipulación de negocio o indisponibilidad grave.
- **Media**: exposición limitada o degradación recuperable.
- **Baja**: impacto menor o condiciones difíciles, sin ignorar su corrección.

## 2. Activos

- credenciales y sesiones;
- identidad y contacto de pacientes/profesionales;
- documentos de verificación profesional;
- solicitudes y ubicación;
- conversaciones y archivos;
- citas y disponibilidad;
- historia clínica, diagnósticos, planes y consentimientos;
- resultados de triaje;
- estados y referencias de pago;
- llaves y secretos;
- logs, auditoría, backups y datos migrados;
- reputación y confianza clínica de Ruta Emocional.

## 3. Adversarios y fallos plausibles

- usuario que manipula su cliente móvil;
- usuario autenticado que cambia identificadores para acceder a otro recurso;
- falso psicólogo o profesional cuya licencia fue revocada;
- atacante con credenciales robadas;
- bot que abusa de registro, login, MENTA o solicitudes;
- personal interno con privilegios excesivos;
- dependencia o proveedor comprometido;
- atacante que obtiene un backup, log o secreto;
- error de programación o carrera concurrente;
- prompt injection o salida insegura de IA;
- configuración errónea de CORS, red o almacenamiento;
- fallo operativo que impide restaurar datos.

## 4. Riesgos prioritarios

| ID | Riesgo | Severidad | Controles requeridos | Evidencia de cierre |
|---|---|---:|---|---|
| TM-001 | BOLA/IDOR cambiando `patientId`, `userId`, `requestId` o `roomId` | Crítica | actor desde sesión, políticas por objeto/relación, filtros en repositorio, pruebas negativas | suite automatizada entre usuarios A/B |
| TM-002 | Cliente se autodeclara psicólogo o administrador | Crítica | registro con allowlist, roles administrativos fuera del flujo público, verificación profesional obligatoria | pruebas de mass assignment y roles |
| TM-003 | Psicólogo no verificado atiende o ve pacientes | Crítica | `verificationStatus=VERIFIED` en toda capacidad profesional, invalidación al cambiar estado | pruebas de marketplace/agenda/clínica |
| TM-004 | Acceso administrativo a notas clínicas por conveniencia | Crítica | separación de rol, DTO y repositorio; acceso excepcional con propósito; auditoría | pruebas y revisión de permisos |
| TM-005 | Sala WebSocket arbitraria permite escuchar mensajes/ubicación | Crítica | autenticación obligatoria y verificación de participación antes de join/evento | prueba de socket ajeno rechazada |
| TM-006 | Evento de cliente falsifica aceptación, estado o mensaje | Alta | API como comando, eventos de dominio emitidos por servidor después de commit | cliente no puede cambiar estado por socket |
| TM-007 | Robo/replay de refresh token | Alta | token opaco, hash, rotación, detección de reutilización, revocación | pruebas de rotación/replay |
| TM-008 | Secreto JWT fallback o débil | Crítica | arranque fail-fast, secreto aleatorio mínimo, rotación, validación de algoritmo/claims | test de config y secret scan |
| TM-009 | Enumeración y fuerza bruta de cuentas | Alta | error uniforme, rate limit por IP/cuenta, backoff, alertas, contraseña fuerte | pruebas de respuesta y límites |
| TM-010 | Tokens en localStorage/almacenamiento inseguro | Alta | SecureStore nativo; cookie HttpOnly web; access token preferentemente en memoria | pruebas por plataforma y revisión build |
| TM-011 | Descripción, mensajes o notas aparecen en logs | Crítica | logging por allowlist, redacción de headers/body, tests de captura | prueba automática de ausencia |
| TM-012 | Manipulación concurrente acepta dos ofertas | Alta | transacción, bloqueo/serialización, índice único parcial, idempotencia | prueba concurrente y constraint |
| TM-013 | Doble reserva de paciente o psicólogo | Alta | revalidación servidor y exclusion constraints PostgreSQL | prueba concurrente ya iniciada |
| TM-014 | Cliente altera precio/pago | Alta | importe desde oferta persistida; webhooks firmados; transición del servidor | tests de monto manipulado |
| TM-015 | “Pago” simulado se presenta como real | Alta | feature flag, proveedor requerido para producción, texto explícito | configuración de producción falla cerrada |
| TM-016 | Ubicación precisa se difunde globalmente | Crítica | consentimiento, participantes, precisión mínima, TTL, sin logs | tests de canal/retención |
| TM-017 | Prompt injection cambia el rol de MENTA | Alta | mensajes separados, reglas previas, salida estructurada y validada, pruebas adversariales | corpus de prompts y bloqueo |
| TM-018 | MENTA omite una señal de crisis o recomienda presupuesto | Crítica | detector determinista, protocolo revisado, interrupción comercial, fallback seguro | suite clínica versionada y aprobación |
| TM-019 | Proveedor IA recibe PII o retiene contenido | Crítica | minimización, contrato/configuración, allowlist de campos, DPA cuando aplique | inspección de payload y contrato |
| TM-020 | SSRF mediante URLs, webhooks o archivos | Alta | destinos allowlist, no fetch de URL de usuario, egress control, validación DNS/red | pruebas SSRF y reglas de red |
| TM-021 | Archivo malicioso o acceso por URL pública | Alta | object storage privado, MIME/contenido, cuarentena, malware scan, URL firmada | prueba EICAR/ACL |
| TM-022 | SQL injection o consulta sin ámbito | Alta | Prisma parametrizado, raw SQL aislado/revisado, repositorios autorizados | SAST y pruebas |
| TM-023 | Mass assignment actualiza estado/rol/campos internos | Alta | esquemas de entrada cerrados y DTO por comando | pruebas de propiedades extra |
| TM-024 | Respuesta excesiva expone hashes o PII | Crítica | select explícito y DTO; nunca modelo directo | snapshot/contract tests |
| TM-025 | CORS abierto permite orígenes no previstos | Alta | allowlist exacta por entorno, credenciales coherentes | test de origen permitido/denegado |
| TM-026 | Consumo ilimitado agota API/IA/DB | Alta | límites de tamaño, rate limit, paginación, timeout, cuota y circuit breaker | pruebas de carga/abuso |
| TM-027 | Dependencia vulnerable o paquete comprometido | Alta | lockfile único, audit, actualizaciones controladas, SBOM y CI | reporte de pipeline |
| TM-028 | Superusuario de DB usado por la app | Crítica | roles owner/migrator/app separados y mínimo privilegio | prueba de permisos con rol runtime |
| TM-029 | Backup no cifrado o no restaurable | Crítica | cifrado, acceso separado, retención y simulacro de restore | reporte de restauración |
| TM-030 | Auditoría puede alterarse o contiene clínica | Alta | append-only, permisos, allowlist, exportación protegida | prueba de UPDATE/DELETE denegado |
| TM-031 | ETL duplica o asocia mal pacientes/profesionales | Crítica | dry-run, `legacy_id`, idempotencia, cuarentena, reconciliación | reporte de conteos y reglas |
| TM-032 | Historial clínico se sobrescribe | Crítica | versiones inmutables, firma y enmienda, auditoría | constraint y pruebas de inmutabilidad |
| TM-033 | Consulta N+1 o polling degrada servicio | Media | proyecciones, joins controlados, índices, eventos servidor, métricas | perfiles de consultas/carga |
| TM-034 | Error externo filtra clave o payload | Alta | errores normalizados, no incluir URL con key, secretos en headers | test de logs/errores |
| TM-035 | Usuario menor ingresa a flujo adulto | Crítica | puerta de edad y política de representante antes de producción | regla legal implementada o bloqueo |

## 5. Estado de mitigación al cierre de la Fase 7.5

Los hallazgos del prototipo original se conservan en el historial Git. El estado
vigente es:

| Superficie | Estado actual | Riesgo residual |
|---|---|---|
| Identidad | Sesiones revocables, refresh opaco rotatorio, secretos fail-fast y roles server-side | gestor externo, rotación operativa y política web final |
| Autorización | Solicitudes, conversaciones, citas y clínica filtran actor y relación en repositorio | pentest y revisión independiente |
| Tiempo real | Socket autenticado, suscripción por conversación persistida y eventos server-side | carga, métricas y respuesta a dead letters |
| Datos | PostgreSQL es el único runtime; no existen rutas ni paquete MongoDB | reconciliación offline de `legacy_id` si se importa historia |
| CORS/errores | allowlist por entorno y Problem Details sin excepción interna | configuración y observabilidad del hosting final |
| Pagos | endpoints simulados retirados | permanece deshabilitado hasta Fase 9 |
| MENTA | controlador, servicio cliente, navegación y respuestas fallback retirados | permanece deshabilitado hasta protocolo determinista de Fase 8 |
| Evidencias | adaptador privado local solo para QA controlado | proveedor, URL firmada, cuarentena y antimalware |
| Clínica | cifrado, relación, mínimo privilegio lógico, versiones y auditoría | KMS, retención, acceso paciente y aprobación legal/clínica |

Una mitigación técnica no equivale a aceptación productiva. Los riesgos
residuales mantienen sus gates en `operations/production-gates.md`.

## 6. Orden de mitigación

### Antes de conectar el frontend a PostgreSQL

1. configuración fail-fast y secretos;
2. sesiones revocables y políticas de objeto;
3. DTO/validación y error handling;
4. autenticación WebSocket;
5. eventos originados por servidor;
6. roles DB mínimos.

### Antes de beta cerrada

1. verificación profesional real;
2. agenda y concurrencia probadas;
3. auditoría clínica;
4. protocolo MENTA/crisis revisado;
5. SecureStore y sesión web segura;
6. backups/restauración;
7. pruebas de carga y autorización.

### Antes de producción

1. revisión jurídica y clínica;
2. pentest independiente;
3. incident response y monitoreo;
4. cifrado/gestión de llaves final;
5. proveedores y contratos;
6. eliminación o cierre de todas las simulaciones.

## 7. Riesgo residual

No existe riesgo cero. La aceptación de un riesgo debe incluir propietario, alcance, fecha de revisión, compensaciones y aprobación. Los riesgos críticos no pueden aceptarse informalmente ni quedar ocultos detrás de texto de interfaz.
