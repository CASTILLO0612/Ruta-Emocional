# Backup y restauración de PostgreSQL

## Objetivo

Un backup no se considera válido hasta restaurarlo y verificarlo. Este runbook
define una prueba local reproducible y los controles que deberá proporcionar la
infraestructura de producción.

## Prueba automatizada local

El script
[`Test-PostgreSqlBackupRestore.ps1`](../../backend/prisma/operations/Test-PostgreSqlBackupRestore.ps1)
realiza:

1. rechazo de un destino existente o con nombre no permitido;
2. `pg_dump` en formato custom, sin propietarios ni grants locales;
3. creación de una base desechable vacía;
4. `pg_restore` con salida inmediata ante error;
5. comprobación de tablas críticas y migraciones completas;
6. eliminación de la base creada por el propio script y del artefacto temporal.

Ejemplo local, usando valores explícitos y entrada enmascarada:

```powershell
./backend/prisma/operations/Test-PostgreSqlBackupRestore.ps1 `
  -SourceDatabase ruta_emocional `
  -VerificationDatabase ruta_emocional_restore_verify_local `
  -PostgresBinPath 'C:\Program Files\PostgreSQL\16\bin' `
  -DatabaseHost localhost `
  -DatabasePort 5432 `
  -DatabaseUser postgres
```

El script nunca acepta como destino la base de origen, no sobrescribe una base
existente y no guarda la contraseña. Esta verificación local no reemplaza un
backup cifrado y administrado del ambiente productivo.

## Requisitos productivos

- backups automáticos cifrados con identidad separada;
- copias en región/cuenta aislada según residencia aprobada;
- protección contra borrado y modificación durante el periodo definido;
- retención y legal hold acordes con la política legal;
- alertas por fallo, atraso o tamaño anómalo;
- restauración periódica en ambiente aislado;
- comprobaciones de esquema, conteos, integridad referencial y muestras de
  lectura autorizadas;
- medición real de RPO y RTO;
- evidencia sin secretos ni contenido clínico en tickets o logs.

## Gate

La prueba local cierra el riesgo de que el procedimiento versionado sea
inoperante. El gate productivo permanece abierto hasta seleccionar hosting,
definir RPO/RTO y ejecutar una restauración desde el backup administrado real.
