# Plan de ejecución del MVP

## 1. Estrategia

La migración se entrega por flujos verticales. Cada incremento conecta pantalla, adaptador frontend, contrato API, caso de uso, repositorio PostgreSQL, políticas, auditoría y pruebas. MongoDB no recibe nuevas capacidades.

La prioridad no es reemplazar archivos por capas, sino mover autoridad y garantizar reglas sin romper la experiencia actual.

## 2. Fases

### Fase 0 — Baseline y decisiones

**Entregables**

- definición del MVP;
- reglas y máquinas de estado;
- matriz de autorización;
- modelo de amenazas;
- contrato API inicial;
- NFR y métricas;
- esquema PostgreSQL 3FN y migraciones base.

**Salida**

- documentos revisables en repositorio;
- riesgos críticos identificados;
- simulaciones marcadas y feature flags previstas;
- decisiones pendientes con dueño.

### Fase 1 — Plataforma backend

**Trabajo**

- configuración centralizada y fail-fast;
- composición de aplicación sin side effects al importar;
- Prisma singleton y transacciones;
- errores Problem Details;
- request/correlation ID;
- logging estructurado con redacción;
- CORS allowlist, headers, body limits;
- rate-limit abstraído;
- liveness/readiness;
- graceful shutdown;
- estructura modular y dependencias dirigidas hacia dominio.

**Salida**

- servidor inicia con PostgreSQL y falla claramente ante configuración insegura;
- health checks probados;
- ningún secreto fallback;
- CI básico.

### Fase 2 — Identidad y sesiones

**Trabajo**

- registro separado paciente/psicólogo;
- creación transaccional de roles/perfiles/licencia pendiente;
- hash moderno con compatibilidad y rehash de bcrypt legado;
- access token corto;
- refresh token opaco y rotativo;
- logout/logout-all;
- `/auth/me` y capacidades;
- política de cuenta/verificación;
- rate limiting y eventos de auditoría;
- almacenamiento seguro del frontend.

**Pruebas de salida**

- registro concurrente del mismo correo;
- rol administrativo no puede autoconcederse;
- login uniforme para usuario inexistente/contraseña incorrecta;
- refresh anterior reutilizado revoca sesión;
- cuenta suspendida/revocada no opera;
- paciente y psicólogo se rehidratan correctamente en el frontend.

### Fase 3 — Directorio y verificación

**Trabajo**

- catálogos de especialidades/modalidades;
- expediente de verificación;
- flujo admin sin acceso clínico;
- perfil público minimizado;
- filtros y PostGIS;
- disponibilidad básica;
- eliminar seeds en endpoints de lectura y mocks silenciosos.

**Salida**

- solo perfiles verificados aparecen;
- datos públicos se derivan de fuente normalizada;
- consultas paginadas e indexadas.

### Fase 4 — Solicitudes y ofertas

**Trabajo**

- DTO sin identificadores/nombres del actor;
- solicitud inmediata/programada estructurada;
- elegibilidad de psicólogos;
- oferta propia y única;
- aceptación transaccional e idempotente;
- relación de atención;
- outbox;
- adaptadores del Home/Radar/Dashboard actuales.

**Pruebas de salida**

- dos aceptaciones concurrentes producen una sola ganadora;
- otro paciente no ve/acepta;
- psicólogo pendiente no oferta;
- monto manipulado se ignora;
- frontend reconcilia el estado real.

### Fase 5 — Tiempo real y mensajería

**Trabajo**

- handshake autenticado;
- salas derivadas de participación;
- mensajes persistidos antes del evento;
- `clientMessageId` idempotente;
- cursor de mensajes;
- outbox → Socket.IO;
- reconexión/rehidratación;
- eliminar broadcasts globales y eventos de dominio emitidos por clientes.

**Salida**

- usuario ajeno no se suscribe;
- mensaje reintentado no se duplica;
- pérdida de socket no pierde estado;
- no hay contenido en logs.

### Fase 6 — Agenda

**Trabajo**

- reglas y excepciones;
- cálculo de slots;
- zona horaria;
- cita, confirmación, reprogramación, cancelación y no-show;
- recordatorios;
- integración de calendario para psicólogo y paciente;
- historial real en lugar de datos mock.

**Salida**

- constraints de no solapamiento probadas bajo concurrencia;
- cambios conservan traza;
- slots no se calculan en el cliente.

### Fase 7 — Historia clínica

**Trabajo**

- revisión clínica/jurídica de campos;
- expediente/encuentro;
- notas versionadas y firmadas;
- diagnóstico y plan;
- consentimientos;
- permisos de campo y propósito;
- auditoría de lectura/escritura;
- exportación asíncrona;
- vista nueva para psicólogo.

**Salida**

- nota firmada es inmutable;
- enmienda conserva historial;
- admin no lee contenido;
- profesional ajeno no accede;
- exportación requiere autenticación reciente y queda auditada.

### Fase 8 — MENTA segura

**Trabajo**

- revisión clínica del alcance;
- avisos y consentimiento;
- reglas de crisis versionadas;
- recursos por país en configuración;
- minimización de payload;
- adaptador de proveedor y salida validada;
- pruebas adversariales;
- separación entre orientación y presupuesto.

**Salida**

- riesgo crítico interrumpe el flujo comercial;
- proveedor caído produce fallback seguro;
- no se envía PII;
- ningún resultado se presenta como diagnóstico.

### Fase 9 — Proveedores opcionales

#### Pagos

Solo se ejecuta con proveedor y políticas aprobadas. Incluye tokenización, webhooks firmados, idempotencia, conciliación y reembolsos.

#### RTC

Solo se ejecuta con proveedor/arquitectura y privacidad aprobados. Incluye TURN, tokens efímeros, autorización por cita, telemetría sin contenido y política de grabación.

En caso contrario, ambos módulos permanecen deshabilitados en producción.

### Fase 10 — ETL y cutover

**Trabajo**

- inventario de colecciones y calidad;
- mapeo campo/regla;
- exportación consistente;
- transformación idempotente con `legacy_id`;
- cuarentena de registros inválidos;
- dry-run;
- reconciliación de conteos, relaciones y totales;
- ensayo de rollback;
- ventana de escritura controlada;
- cutover y monitoreo;
- Mongo read-only durante periodo definido;
- retiro seguro.

**Salida**

- reporte firmado de reconciliación;
- cero huérfanos no explicados;
- rollback ensayado;
- PostgreSQL es única fuente de verdad.

### Fase 11 — Preparación productiva

- infraestructura y red final;
- roles DB mínimos;
- secret manager y rotación;
- backups/restauración;
- monitoreo/alertas;
- carga y pentest;
- runbooks e incident response;
- revisión jurídica/clínica;
- store privacy manifests y permisos;
- eliminación de mocks, valores de demostración y datos de prueba.

## 3. Definition of Done por módulo

Un módulo está terminado solo si:

- las reglas tienen pruebas unitarias;
- repositorios tienen pruebas con PostgreSQL;
- cada permiso positivo tiene caso negativo;
- OpenAPI coincide con implementación;
- el frontend usa DTO v1 y maneja loading/error/offline;
- no hay IDs autoritativos del actor enviados por el cliente;
- mutaciones reintentables son idempotentes;
- logs/auditoría cumplen clasificación;
- métricas y alertas existen;
- migración y rollback están definidos;
- documentación y ADR se actualizaron;
- TypeScript, tests, build, audit y diff check pasan.

## 4. Orden de commits sugerido

1. documentación y ADR;
2. plataforma compartida;
3. esquema/migración incremental;
4. dominio y casos de uso;
5. adaptador Prisma;
6. HTTP/OpenAPI;
7. pruebas;
8. adaptador frontend;
9. retiro legacy;
10. operación/observabilidad.

Cada commit debe ser revisable y no mezclar una actualización de Expo con un cutover de datos crítico.

## 5. Decisiones pendientes con bloqueo productivo

| Decisión | Responsable requerido | Bloquea |
|---|---|---|
| Jurisdicción/mercado final | Producto + legal | usuarios reales |
| Política de edad/menores | Legal + clínico | registro productivo |
| Campos clínicos y acceso paciente | Clínico + legal | historia clínica |
| Protocolo y recursos de crisis | Clínico + operaciones | MENTA productiva |
| Autoridad de verificación profesional | Operaciones + legal | marketplace real |
| Proveedor de pagos | Negocio + seguridad | pagos reales |
| Proveedor/arquitectura RTC | Producto + seguridad | llamadas reales |
| Retención y eliminación | Legal + seguridad | producción clínica |
| Hosting y residencia de datos | Infraestructura + legal | producción |

El trabajo de ingeniería puede avanzar con adaptadores y feature flags, pero ninguna puerta se considera implícitamente aprobada.

## 6. Prioridad inmediata

El siguiente incremento técnico es Fase 1 y Fase 2: plataforma backend e identidad. Es el menor corte vertical que permite validar arquitectura, seguridad, PostgreSQL, contratos y compatibilidad con el frontend antes de mover datos clínicos o financieros.
