# Roles y permisos para Desarrollo

## 1. Tres familias exigidas por la rúbrica

Ruta Emocional cumple la definición de **Usuario**, **Administrador** y **Auditor**. La familia Usuario se divide en paciente y psicólogo porque sus responsabilidades son diferentes. PostgreSQL conserva los códigos estables `patient`, `psychologist`, `administrator` y `clinical_auditor`.

| Familia de la rúbrica | Rol de aplicación | Responsabilidad |
|---|---|---|
| Usuario | Paciente (`patient`) | buscar profesionales, crear y administrar solicitudes propias, aceptar ofertas, conversar y gestionar citas propias |
| Usuario | Psicólogo (`psychologist`) | completar incorporación; al ser verificado, ofertar, conversar, gestionar agenda y documentar atención autorizada |
| Administrador | Administrador (`administrator`) | gestionar cuentas y decidir verificaciones profesionales; no recibe acceso clínico implícito |
| Auditor | Auditor clínico (`clinical_auditor`) | capacidad excepcional `clinical:audit:approved-purpose`; no puede usarla sin un flujo de propósito aprobado y auditado |

## 2. Matriz resumida

| Recurso o acción | Paciente | Psicólogo pendiente | Psicólogo verificado y relacionado | Administrador | Auditor clínico |
|---|---:|---:|---:|---:|---:|
| perfil propio | Sí | Sí | Sí | Sí propio | Sí propio |
| directorio público | Sí | Sí | Sí | Sí | Sí |
| evidencia profesional propia | No | Sí | Sí | revisión autorizada | No |
| decidir verificación | No | No | No | Sí | No |
| solicitud propia | crear/administrar | No | proyección elegible | soporte limitado | No |
| oferta | aceptar como dueño | No | crear/retirar propia | soporte limitado | No |
| conversación | propias | No | propias | metadatos mínimos | solo por propósito aprobado |
| cita | propias | No | propias | soporte auditado | solo por propósito aprobado |
| texto clínico | cerrado en MVP | No | solo autor y relación activa | No | cerrado hasta habilitar propósito aprobado |
| eventos de auditoría | No | No | No | alcance operativo | alcance aprobado |

## 3. Aplicación técnica

- Los roles se crean en la migración inicial, no llegan desde un valor libre enviado por el cliente.
- La API convierte los roles en capacidades explícitas en [`identityService.ts`](../../../backend/src/modules/identity/application/identityService.ts).
- Cada ruta exige autenticación y capacidad; el repositorio vuelve a filtrar por propietario, participante o relación.
- Un psicólogo no recibe capacidades profesionales solo por tener el rol: también debe estar verificado.
- La posesión de un UUID no concede acceso. Para recursos sensibles se responde como no encontrado cuando revelar existencia aumentaría el riesgo.
- El rol administrador está separado del acceso clínico.

La matriz completa, incluidas reglas negativas y permisos por módulo, está en [`docs/security/authorization-matrix.md`](../../security/authorization-matrix.md).

## 4. Alcance honesto del auditor

El rol `clinical_auditor` y su capacidad existen en base de datos y en identidad, pero la aplicación no expone una pantalla ni un endpoint general para leer historias clínicas. Esto es deliberado: el acceso solo se habilitará cuando exista un caso de uso que reciba y compruebe propósito, alcance temporal, autorización y auditoría. Para la categoría Desarrollo se demuestra la **definición del rol**, no un acceso clínico inseguro.
