# Fase 7 — Historia clínica segura

## Estado

Implementación técnica completada el 29 de agosto de 2026. No habilita por sí
sola uso clínico productivo: campos, retención, exportación, acceso paciente y
consentimientos requieren aprobación clínica y legal.

## Entregables

- migraciones incrementales `20260828005000_secure_clinical_records`,
  `20260828005100_validate_clinical_constraints` y
  `20260828005200_encrypt_clinical_metadata`;
- módulo backend `clinical-record` con dominio, puertos, servicio, adaptador
  Prisma, cifrado y transporte HTTP;
- relación explícita del encuentro con el vínculo asistencial;
- notas con versiones y eventos append-only;
- firma, edición de borrador y enmienda con control optimista de versión;
- planes de tratamiento y objetivos con máquina de estados;
- cifrado AES-256-GCM de notas, motivos de encuentro y enmienda, resúmenes y
  objetivos;
- llave activa y llavero anterior configurables fuera del código;
- auditoría de lecturas y escrituras sin contenido;
- pantalla `Pacientes` para el espacio del psicólogo, con Material Icons y sin
  datos simulados;
- OpenAPI, matriz de autorización, 3FN, ADR y grants mínimos actualizados.

## Contrato HTTP

- `GET /clinical/policy`
- `GET /clinical/patients`
- `GET /clinical/patients/{patientUserId}/record`
- `GET /clinical/notes/{noteId}/versions`
- `POST /clinical/encounters`
- `PUT /clinical/notes/{noteId}/draft`
- `POST /clinical/notes/{noteId}/sign`
- `POST /clinical/notes/{noteId}/amendments`
- `POST /clinical/treatment-plans`
- `POST /clinical/treatment-plans/{planId}/transitions`
- `PATCH /clinical/treatment-goals/{goalId}/status`

Toda mutación requiere `Idempotency-Key`. Autor, profesional, expediente,
relación, estados y versión nueva se derivan o validan en el servidor.

## Controles verificados

- el paciente no accede al módulo clínico;
- un psicólogo verificado ajeno recibe recurso no encontrado;
- dos actualizaciones concurrentes de la misma versión producen una ganadora y
  un conflicto `409`;
- firmar conserva la versión y bloquea edición de borrador;
- enmendar crea una nueva versión con motivo;
- los objetivos solo avanzan por transiciones explícitas y los estados
  terminales no pueden reabrirse;
- PostgreSQL rechaza alterar una versión histórica;
- el texto y los motivos devueltos por HTTP no aparecen en las columnas
  inspeccionadas;
- la llave anterior continúa descifrando después de activar una versión nueva;
- migraciones completas parten de una base vacía;
- compilación backend, pruebas unitarias, integración HTTP y typecheck frontend
  permanecen en verde.

## Límites explícitos

- no se habilitaron diagnósticos porque el catálogo, campos y política clínica
  necesitan revisión especializada;
- no se habilitó exportación: requiere autenticación reciente, propósito,
  generación asíncrona, almacenamiento privado y retención;
- no se habilitó lectura paciente ni transferencia entre profesionales;
- no existen adjuntos clínicos hasta cerrar object storage, URLs firmadas,
  cuarentena y antimalware;
- el llavero local no sustituye KMS o secret manager;
- el borrado directo permanece prohibido mientras no exista política legal.

## Despliegue y reversión

Las migraciones son acumulativas y se aplican antes de iniciar la versión nueva
del backend. No existe un `down` automático que elimine versiones, eventos o
ciphertext clínico. Ante una falla se detiene el despliegue, se conserva la base,
se corrige hacia adelante y se restaura el backup previo solo bajo el runbook de
incidente y después de reconciliar cualquier escritura recibida. La llave activa
y todas las versiones anteriores deben permanecer disponibles durante despliegue
y rollback de aplicación.

## Próxima fase

La Fase 8 corresponde a MENTA segura: reglas de crisis deterministas y
versionadas, minimización de datos, consentimiento, adaptador del proveedor,
salida estructurada y prohibición de diagnóstico automatizado.
