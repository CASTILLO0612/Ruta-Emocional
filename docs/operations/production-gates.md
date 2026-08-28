# Gates de preparación productiva

## Estado

Este documento convierte los límites conocidos en controles verificables. No
declara producción habilitada: los gates dependen de infraestructura, seguridad,
legal y operación, y deben cerrarse con evidencia por ambiente.

## 1. Evidencia profesional privada

### Contrato requerido

El backend debe depender de un puerto de almacenamiento, no de SDKs dentro del
caso de uso. El adaptador seleccionado deberá ofrecer estas operaciones:

1. emitir una autorización de carga de corta duración para una clave aleatoria;
2. confirmar tamaño, tipo detectado, checksum y pertenencia del objeto;
3. mantener el objeto en cuarentena sin permiso de descarga;
4. recibir un resultado antimalware autenticado e idempotente;
5. emitir una descarga temporal solo después de autorización y resultado limpio;
6. eliminar o bloquear el objeto según la política de retención.

Estados mínimos de evidencia:

```text
UPLOAD_PENDING -> QUARANTINED -> SCANNING -> CLEAN
                         |           |
                         +----------> INFECTED
                         +----------> SCAN_FAILED

CLEAN | INFECTED | SCAN_FAILED -> RETENTION_HOLD -> DELETED
```

Una `evidenceObjectKey` enviada directamente por el cliente no es prueba de que
el objeto exista, pertenezca al profesional o esté limpio. El flujo actual de la
Fase 3 permanece bloqueado para producción hasta incorporar este estado y el
adaptador real.

### Decisiones externas necesarias

- proveedor, región y residencia del objeto;
- servicio/motor antimalware y SLA;
- tamaño y MIME permitidos por categoría;
- duración de URL de carga/descarga;
- retención por evidencia aprobada, rechazada, abandonada o infectada;
- legal hold, solicitud de eliminación y auditoría;
- cifrado administrado por proveedor o KMS del proyecto.

La opción preferida, condicionada a hosting y residencia aprobados, está
documentada en
[`ADR-002`](../architecture/ADR-002-object-storage-and-secrets-provider.md): S3
privado, GuardDuty Malware Protection, KMS y Secrets Manager dentro de AWS. El
ADR continúa propuesto; no autoriza una duración legal ni habilita cargas reales.

## 2. Rol PostgreSQL de runtime

La aplicación no debe conectarse como `postgres`, propietario ni migrador. La
separación recomendada es:

- `ruta_emocional_owner`: dueño de objetos, sin login de aplicación;
- `ruta_emocional_migrator`: login temporal de despliegue;
- `ruta_emocional_runtime`: rol `NOLOGIN` con privilegios explícitos;
- `ruta_emocional_app_a` / `ruta_emocional_app_b`: logins alternables miembros
  del rol runtime para rotación sin reutilizar contraseña.

El script
[`grant_runtime_role.sql`](../../backend/prisma/operations/grant_runtime_role.sql)
concede únicamente las tablas usadas por las fases cerradas. No crea roles ni
acepta contraseñas, no concede DDL, `TRUNCATE` o triggers y deliberadamente no
configura privilegios por defecto. Cada tabla futura exige revisión explícita.

[`ensure_runtime_role.sql`](../../backend/prisma/operations/ensure_runtime_role.sql)
crea de forma idempotente el rol grupal `NOLOGIN` sin atributos administrativos;
no crea usuarios, contraseñas ni membresías.

Ejecución administrativa, después de crear el rol `NOLOGIN`:

```powershell
psql -v application_role=ruta_emocional_runtime -d ruta_emocional -f backend/prisma/operations/grant_runtime_role.sql
```

El gate cierra cuando `DATABASE_URL` usa un login miembro, las migraciones usan
otra identidad y una prueba automatizada confirma que runtime puede operar pero
no crear, alterar, truncar ni eliminar auditoría/outbox.

La verificación estática versionada se encuentra en
[`verify_runtime_role.sql`](../../backend/prisma/operations/verify_runtime_role.sql).
El worker outbox comparte por ahora el proceso de aplicación y recibe `UPDATE`
solo sobre sus columnas operativas; no recibe `DELETE`, `TRUNCATE` ni capacidad
de cambiar payloads. Separarlo en otro login será obligatorio si el worker se
despliega como proceso independiente.

**Evidencia local del 28 de agosto de 2026:** el rol grupal
`ruta_emocional_runtime` fue creado como `NOLOGIN`, los grants fueron aplicados y
la verificación positiva/negativa terminó correctamente. El gate sigue abierto
porque la aplicación aún no usa un login miembro administrado por el gestor de
secretos.

## 3. Gestión externa de secretos

El código ya falla si faltan secretos o contiene placeholders conocidos. Para
staging/producción, las variables deben ser inyectadas en runtime desde el gestor
del proveedor o una plataforma aprobada; un archivo `.env` no es el sistema de
registro.

Inventario mínimo:

- credencial PostgreSQL de runtime y de migración por separado;
- `JWT_ACCESS_SECRET` o llave asimétrica versionada;
- `PASSWORD_PEPPER`;
- credenciales de object storage, antimalware, IA, pagos, RTC y notificaciones;
- llaves de cifrado/KMS y credenciales de backup.

Controles de salida:

- acceso por identidad de workload cuando el proveedor lo permita;
- separación development/staging/production;
- permisos de lectura por servicio, no por equipo completo;
- auditoría de lectura y alerta por acceso inusual;
- versionado, fecha de rotación y responsable;
- escaneo de repositorio, historial, artefactos y bundles móviles;
- ningún secreto bajo `EXPO_PUBLIC_*`, porque esos valores se incluyen en el
  bundle del cliente.

## 4. Rotación de PostgreSQL compartida

La credencial compartida previamente se considera comprometida. No debe copiarse
a documentación, comandos versionados ni gestores de tareas.

Procedimiento coordinado:

1. crear el login alterno inactivo con una contraseña aleatoria generada por el
   gestor de secretos y membresía en `ruta_emocional_runtime`;
2. probar conexión y permisos negativos en staging/local controlado;
3. publicar una nueva versión de `DATABASE_URL` en el gestor;
4. reiniciar o reciclar los pools y confirmar health/readiness;
5. revocar conexiones y `LOGIN` del usuario anterior;
6. observar errores y, tras la ventana de rollback, eliminar el login anterior;
7. registrar fecha, actor y evidencia sin registrar la contraseña.

La rotación local no se ejecuta automáticamente porque cambiaría la conexión de
pgAdmin y requiere coordinar el nuevo secreto con el usuario. El gate permanece
abierto hasta realizar esa coordinación.

## 5. Política de retención y eliminación

La implementación necesita una matriz aprobada antes de borrar evidencia o datos
clínicos:

| Categoría | Evento inicial | Retención | Excepción | Método de eliminación | Evidencia |
|---|---|---|---|---|---|
| Evidencia pendiente | carga/abandono | Por definir | investigación | objeto + metadatos | auditoría |
| Evidencia aprobada | decisión | Por definir | vigencia/legal hold | flujo autorizado | comprobante |
| Ubicación precisa | captura/sesión | Configuración técnica corta | incidente | job idempotente | métrica/auditoría |
| Solicitudes/ofertas | cierre | Por definir | disputa | anonimizar/eliminar según ley | reconciliación |
| Historia clínica | encuentro/firma | Revisión legal obligatoria | legal hold | nunca borrado directo | expediente |
| Auditoría/backups | evento/snapshot | Por definir | incidente | ciclo de backup | prueba de restore |

Producto no puede convertir TTL técnicos en política legal. La matriz final debe
tener propietario legal, seguridad y operaciones.

## 6. Simulaciones restantes

Solicitudes, ofertas y mensajería ya no montan sus rutas MongoDB ni aceptan
salas o eventos de dominio fabricados por clientes. Las llamadas y la ubicación
en vivo heredadas también fueron retiradas del transporte de mensajería y no se
presentan como capacidades reales. Aún deben resolverse en sus fases:

- recordatorios push fuera de la app hasta contar con proveedor, consentimiento y observabilidad;
- respuestas/fallbacks clínicos de MENTA y proveedor fijado (Fase 8);
- pagos y RTC de demostración si no hay proveedor aprobado (Fase 9);
- cualquier ubicación en vivo solo podrá volver con propósito, consentimiento,
  retención corta y autorización por sesión presencial.

La regla de despliegue es fail closed: una integración no aprobada permanece
deshabilitada, no reemplazada por datos ficticios.

## 7. Dependencias y cadena de build

El backend debe mantener cero vulnerabilidades conocidas en el audit del release.
Expo debe permanecer en las versiones esperadas por SDK 57. El audit actual del
frontend reporta avisos moderados transitivos por `uuid@7` bajo `xcode` y
`expo-splash-screen`; el escenario vulnerable corresponde a APIs con buffer del
UUID usadas por tooling, no a la generación de claves de idempotencia de la app,
que usa `expo-crypto`.

El gate exige actualizar cuando Expo publique una cadena compatible, validar de
nuevo `expo install --check`, build nativo, audit y SBOM. No se permite resolverlo
forzando un downgrade mayor de Expo ni imponiendo un override fuera del rango del
paquete sin pruebas de build Android/iOS.

## 8. Backup, restauración y observabilidad

El procedimiento local versionado está en
[`postgresql-backup-restore.md`](postgresql-backup-restore.md). La prueba crea un
destino desechable, restaura un dump y verifica migraciones y tablas críticas sin
alterar la base fuente.

La aplicación ya ofrece:

- liveness independiente;
- readiness con conexión PostgreSQL;
- estado del outbox de mensajería por atraso configurable y dead letters;
- logs estructurados de HTTP, sockets y dispatcher sin contenido de mensajes.

**Evidencia local del 28 de agosto de 2026:** el dump de la base con 13
migraciones fue restaurado, validado y eliminado correctamente en un destino
desechable. Esta evidencia valida el runbook local, no el backup administrado de
producción.

Siguen abiertos para producción:

- backup administrado, cifrado y aislado con RPO/RTO aprobados;
- restore periódico contra el proveedor real;
- colector y almacenamiento de logs;
- métricas, dashboard y alertas externas para 5xx, latencia, DB, sockets,
  readiness, outbox y backups;
- proceso de respuesta a dead letters e incidentes.
