# PostgreSQL y Prisma

El modelo canónico está en `schema.prisma`. PostgreSQL es la fuente de verdad y
las migraciones SQL versionadas son la autoridad sobre la estructura desplegada.

## Requisitos

- Node.js 22.13 o posterior para compartir el runtime mínimo de Expo SDK 57.
- PostgreSQL con PostGIS; `compose.yaml` usa la imagen oficial mantenida por el
  proyecto Docker PostGIS.
- Una variable `DATABASE_URL` válida.

## Flujo local

1. Copiar `.env.example` como `.env` en la raíz y en `backend/`.
2. Definir contraseñas locales no reutilizadas.
3. Iniciar PostgreSQL con `docker compose up -d postgres`.
4. Instalar dependencias del backend.
5. Ejecutar `npm run db:validate`.
6. Ejecutar `npm run db:migrate:dev` para crear o aplicar una migración local.

## Reglas de migración

- Una migración aplicada nunca se edita; se crea otra migración correctiva.
- `db push` no se usa en ambientes compartidos o productivos.
- Los cambios destructivos necesitan migración expand/contract y respaldo.
- Las restricciones PostGIS, parciales o de exclusión se escriben en SQL cuando
  Prisma no pueda expresarlas.
- Toda migración debe justificar el cumplimiento de 3FN en
  `docs/database/normalization-3nf.md`.

## Estado actual

- Extensiones `postgis`, `btree_gist` y `pgcrypto` habilitadas.
- Esquema inicial y restricciones relacionales aplicadas.
- Invariantes cruzadas protegidas por triggers diferibles.
- Solapamiento de citas protegido por restricciones de exclusión.
- Defaults y triggers de `updated_at` aplicados.
- Cliente Prisma generado y flujo de identidad v1 probado contra PostgreSQL.
- Solicitudes, ofertas, relaciones, conversaciones, citas e historia clínica
  migradas a PostgreSQL con idempotencia y outbox transaccional.
- La procedencia asistencial referencia la oferta aceptada exacta; citas,
  conversaciones y planes referencian directamente la relación asistencial.
- Los roles conservan periodos de asignación y PostgreSQL impide retirar el
  último rol activo de una cuenta existente.
- La canalización de calidad crea una base limpia, aplica todas las migraciones
  y ejecuta las pruebas de integración antes de aceptar cambios.

La aplicación debe usar un rol con privilegios mínimos. El superusuario
`postgres` solo se utiliza para administración local, extensiones y preparación
de roles; no es una credencial de runtime.

Los grants versionados para el rol `NOLOGIN` de runtime están en
[`operations/grant_runtime_role.sql`](operations/grant_runtime_role.sql). El
script no crea logins ni contraseñas y debe ejecutarse con una identidad
administrativa después de revisar el conjunto de tablas del release.
