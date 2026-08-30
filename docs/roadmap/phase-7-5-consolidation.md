# Fase 7.5 — Consolidación antes de MENTA

## Estado

Fase cerrada el 30 de agosto de 2026. Las 19 migraciones se aplicaron desde cero
sobre PostgreSQL 16 con PostGIS en la validación local y sobre PostgreSQL 17 con
PostGIS 3.6 en CI. Las siete suites de integración finalizaron correctamente en
ambos entornos. El workflow [`Quality` #6](https://github.com/CASTILLO0612/Ruta-Emocional/actions/runs/33297234387)
registró la validación remota completa. Esta fase no habilita por sí sola
producción clínica.

## Objetivo

Crear una línea base única, normalizada y verificable para las fases 1–7 antes
de incorporar triaje e IA. No agrega capacidades de producto ni reescribe casos
de uso ya cerrados.

## Cambios entregados

### Fuente de datos

- PostgreSQL es la única base conectada por el servidor.
- Se retiraron `mongoose`, modelos, controladores, rutas y scripts MongoDB.
- Se retiraron las rutas heredadas `/api/*`; el contrato soportado es
  `/api/v1`.
- MENTA y pagos simulados dejaron de estar disponibles. Volverán únicamente a
  través de sus módulos seguros en las fases 8 y 9.
- El frontend ya no muestra la pestaña MENTA ni formularios locales de tarjeta,
  PIN, notificaciones, soporte o perfil que aparentaban persistencia. Solo se
  mantienen acciones conectadas a contratos HTTP reales.
- `legacy_id` permanece como dato de reconciliación offline, no como dependencia
  de ejecución.

### Identidad y catálogos

- Las asignaciones de rol conservan identidad, estado, inicio y finalización.
- Un índice parcial impide dos asignaciones activas iguales.
- Un trigger diferible impide retirar el último rol activo de un usuario
  operativo.
- `care_modalities` materializa el catálogo conceptual y todas las modalidades
  actuales lo referencian con FK.

### Atención y mensajería

- La relación asistencial conserva la oferta aceptada exacta, no solo la
  solicitud.
- La conversación pertenece directamente a la relación asistencial.
- Una restricción diferible exige exactamente el paciente y psicólogo de la
  relación como participantes.
- Toda cita conserva una FK obligatoria a la relación; las tablas puente
  transitorias fueron retiradas.

### Historia clínica

- `clinical_encounters.care_relationship_id` se vuelve no nulo.
- Todo plan de tratamiento conserva la relación asistencial concreta.
- La unicidad de plan abierto se delimita por relación.
- Consentimientos admiten rechazo y contexto asistencial opcional.
- Diagnósticos reciben contexto asistencial opcional para una habilitación
  posterior compatible y controlada.

### Calidad y operación

- El pipeline de GitHub levanta PostGIS, aplica migraciones desde cero, valida
  Prisma, compila, ejecuta pruebas unitarias e integración y revisa el frontend.
- El frontend y su job usan Node.js 22.13 o posterior, mínimo documentado para
  Expo SDK 57.
- El pipeline rechaza reintroducir dependencias MongoDB en runtime.
- El pipeline verifica los grants positivos y negativos del rol PostgreSQL de
  runtime.
- Los grants mínimos y la prueba de backup/restore incluyen el esquema
  consolidado.
- Las integraciones existentes comprueban procedencia exacta, conversación
  longitudinal, FK de cita, FK de plan y protección del último rol.
- El envío concurrente de evidencias se serializa por licencia y devuelve un
  conflicto de dominio controlado al segundo request, sin errores HTTP 500.

## Estrategia de migración

La migración `20260829001000_consolidate_core_relationships` usa expand/backfill/
validate/contract:

1. agrega columnas y catálogos compatibles;
2. reconstruye procedencia y relaciones desde FKs existentes;
3. aborta ante filas huérfanas o asociaciones ambiguas;
4. agrega `NOT NULL`, índices, FKs y triggers;
5. retira únicamente tablas puente después de validar el backfill.

No existe borrado silencioso de relaciones, conversaciones, citas o contenido
clínico. Un ambiente con datos incompatibles debe reconciliarse antes de volver
a ejecutar la migración.

## Límites deliberados

- El proveedor privado de evidencia, KMS y secret manager siguen siendo gates
  de infraestructura.
- La rotación de la credencial PostgreSQL compartida requiere coordinación con
  el operador y no se automatiza desde Git.
- Pago–Cita 1:N se implementará en Fase 9 porque pagos está deshabilitado y
  necesita proveedor y reconciliación propios.
- Plan–Diagnóstico y Evaluación–Regla se implementarán cuando sus casos de uso
  sean habilitados.
- Consentimiento productivo, campos diagnósticos, retención y acceso paciente
  requieren aprobación clínica/legal.
- Observabilidad externa, backups administrados, carga y pentest continúan como
  puertas productivas.

## Criterio de salida — cumplido

La Fase 8 puede comenzar. El workflow `Quality` finalizó en verde y registró
evidencia de:

- migración desde cero;
- 27 pruebas unitarias aprobadas;
- integraciones PostgreSQL aprobadas;
- typecheck frontend aprobado;
- ausencia de MongoDB en runtime;
- documentación y matriz DER–lógico actualizadas.
