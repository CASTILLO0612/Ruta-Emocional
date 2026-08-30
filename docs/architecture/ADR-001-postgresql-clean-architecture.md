# ADR-001: PostgreSQL y monolito modular con Clean Architecture

- Estado: aceptado; transición de runtime cerrada en Fase 7.5
- Fecha: 2026-08-25

## Contexto

Ruta Emocional maneja relaciones fuertes entre pacientes, psicólogos, solicitudes,
ofertas, citas, conversaciones, pagos y, próximamente, expedientes clínicos. El
modelo actual en MongoDB duplica atributos descriptivos en varios documentos y
delega demasiadas garantías de consistencia al código de aplicación.

El dominio clínico requiere integridad referencial, transacciones, trazabilidad y
restricciones que impidan estados inválidos aun cuando dos operaciones ocurran de
forma concurrente.

## Decisión

1. PostgreSQL será la fuente de verdad del negocio.
2. El esquema transaccional cumplirá como mínimo la tercera forma normal (3FN).
3. PostGIS almacenará y consultará coordenadas geográficas.
4. Prisma será el adaptador ORM. Las capacidades que Prisma no represente de
   forma nativa, como `geography` y restricciones de exclusión, se mantendrán en
   migraciones SQL versionadas.
5. El backend evolucionará hacia un monolito modular con capas de dominio,
   aplicación, infraestructura y presentación.
6. Socket.IO notificará hechos ya confirmados; PostgreSQL seguirá siendo la
   fuente de verdad mediante un outbox transaccional.
7. MongoDB no forma parte del runtime. Una importación histórica, si todavía es
   necesaria, se ejecuta como proceso offline, idempotente y reconciliado.

## Consecuencias

### Positivas

- Claves foráneas y restricciones protegen las relaciones críticas.
- La aceptación de una oferta, creación de cita y registro de pago pueden ser
  una sola transacción.
- El expediente clínico puede versionarse y auditarse.
- La agenda puede impedir solapamientos a nivel de base de datos.
- Se eliminan copias de nombres, correos, roles y especialidades en entidades
  transaccionales.

### Costos

- Una recuperación histórica puede requerir un proceso ETL reproducible desde
  un export controlado.
- Las consultas geoespaciales usarán SQL tipado o repositorios especializados.

## Revisión de la Fase 7.5

El 29 de agosto de 2026 se retiraron del proceso `mongoose`, modelos,
controladores, rutas y scripts MongoDB. Los módulos funcionales cerrados usan
exclusivamente PostgreSQL. Las columnas `legacy_id` no activan una segunda
fuente: permanecen únicamente hasta cerrar la reconciliación histórica.

## Límites

- No se crearán microservicios en esta etapa.
- Los archivos binarios no se almacenarán en PostgreSQL; la base guardará sus
  metadatos y referencias a almacenamiento de objetos.
- Los payloads JSON se limitarán a integración, auditoría y outbox. El núcleo
  clínico y transaccional permanecerá normalizado.
