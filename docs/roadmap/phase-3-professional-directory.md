# Fase 3 — Directorio y verificación profesional

## Estado

Completada el 27 de agosto de 2026 sobre la rama `postgresql-migration`.
PostgreSQL es la fuente de verdad de esta fase; las rutas heredadas de MongoDB
no participan en el flujo del directorio v1.

## Alcance entregado

### Backend

- Módulo `professional-directory` separado en dominio, aplicación, puertos,
  persistencia Prisma y presentación HTTP.
- Catálogo público de modalidades y especialidades activas.
- Administración auditada de especialidades sin valores de negocio incrustados
  en la interfaz.
- Perfil profesional propio con biografía, especialidad principal, modalidades,
  tarifas con moneda, reglas semanales y excepciones.
- Entregas históricas de evidencia mediante claves opacas de almacenamiento
  privado.
- Cola administrativa paginada y decisión aprobar/rechazar con actor, razones,
  fecha, auditoría y outbox.
- Directorio público y detalle individual que solo publican perfiles verificados,
  activos, con licencia verificada y modalidad habilitada con precio positivo.
- Filtros parametrizados por especialidad, modalidad, precio, vigencia de
  disponibilidad y distancia PostGIS.
- Paginación por cursor estable, límites configurables y rate limit público.

### Frontend

- Repositorios tipados contra `/api/v1`; se eliminó el uso de `any` y la
  adaptación implícita de documentos MongoDB en el directorio.
- Eliminación del archivo de seed de profesionales y de los fallbacks silenciosos
  que mostraban perfiles ficticios ante errores o respuestas vacías.
- Home carga una vez, muestra estados de carga/error/vacío y permite reintento
  explícito; ya no consulta cada tres segundos.
- El perfil público se vuelve a cargar por identificador y no transporta datos
  sensibles o potencialmente obsoletos en parámetros de navegación.
- Las rutas usadas por las pantallas consolidadas tienen parámetros tipados; se
  eliminaron conversiones `any` del flujo de directorio y aceptación de ofertas.
- Radar envía la ubicación del paciente solo para el filtro; no recibe ni dibuja
  coordenadas exactas de profesionales y no usa coordenadas predeterminadas si
  el permiso es rechazado.
- La vista profesional pendiente permite completar biografía, especialidad,
  modalidad/tarifa y disponibilidad usando catálogos del servidor.

## Seguridad

- Autenticación seguida de autorización por capacidad, con comprobación adicional
  en el caso de uso y propiedad en el repositorio.
- Rechazo estricto de campos desconocidos para evitar mass assignment.
- Evidencia y decisiones históricas inmutables ante `UPDATE`; una corrección crea
  una nueva entrega.
- Los envíos de evidencia se serializan por licencia en PostgreSQL para impedir
  dos expedientes pendientes ante solicitudes concurrentes.
- Una aprobación exige evidencia, una especialidad principal y al menos una
  modalidad habilitada con precio positivo.
- Un profesional pendiente o rechazado no aparece en el directorio.
- La proyección pública excluye correo, teléfono, número de licencia, claves de
  evidencia y coordenadas. La distancia se redondea a una décima de kilómetro.
- El administrador operativo no obtiene ninguna capacidad clínica.

## Rendimiento

- La selección candidata se ejecuta en PostgreSQL con filtros `EXISTS`, índices
  relacionales y `ST_DWithin` para radio geográfico.
- Los perfiles se hidratan en lote y la calificación se agrega en una sola consulta;
  no hay una consulta por profesional.
- El cursor usa UUID y orden estable; no se usa `OFFSET` creciente.
- Los tamaños de página, radio, ventana temporal, reglas y límite público se
  configuran mediante variables de entorno validadas.

## Tercera forma normal

Las tablas nuevas separan entrega y decisión. La entrega referencia solo la
licencia: no repite el perfil que ya se deduce de esa licencia. La decisión
referencia la entrega y el revisor. Catálogos, modalidades, especialidades y
disponibilidad continúan en relaciones independientes. La justificación completa
está en [`../database/normalization-3nf.md`](../database/normalization-3nf.md).

## Contrato y migraciones

- Contrato: [`../api/openapi.yaml`](../api/openapi.yaml).
- Migración funcional: `20260827000000_professional_directory`.
- Corrección de restricción portable: `20260827001000_fix_evidence_key_constraint`.
- Corrección 3FN: `20260827002000_normalize_verification_submission`.

Nunca se modificó una migración ya aplicada; cada hallazgo posterior a su
aplicación produjo una migración correctiva nueva.

## Verificación ejecutada

- Esquema Prisma formateado, validado y cliente regenerado.
- Compilación estricta de backend.
- 12 pruebas unitarias aprobadas.
- Flujo HTTP de identidad aprobado contra PostgreSQL.
- Flujo HTTP de directorio aprobado contra PostgreSQL: registro, expediente,
  evidencia concurrente, denegación no administrativa, aprobación, publicación
  minimizada y filtros combinados sobre la misma modalidad.
- Typecheck estricto del frontend aprobado con Expo SDK 57.

Las pruebas de integración eliminan sus fixtures al finalizar y no guardan la
contraseña local en archivos o en Git.

## Dependencia operativa explícita

La API registra una `evidenceObjectKey` de un objeto que ya debe existir en
almacenamiento privado. La elección del proveedor, emisión de URL de carga
firmada, análisis antimalware y política física de retención son un gate de
infraestructura previo a producción; no se sustituyeron por URLs públicas ni por
archivos guardados en la base de datos.
