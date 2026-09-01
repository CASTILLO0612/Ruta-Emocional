# Secretos externos y rotación PostgreSQL

## Contrato productivo

El backend no integra un SDK de nube: recibe secretos por inyección del workload
y valida `SECRETS_SOURCE=EXTERNAL_INJECTION` junto con una versión no vacía en
`SECRETS_BUNDLE_VERSION`. El sistema de despliegue es responsable de resolver
el gestor externo sin escribir `.env` dentro de la imagen.

La opción preferida continúa siendo AWS Secrets Manager si se aprueban cuenta,
región y residencia en `ADR-002`. Hasta entonces, ningún proveedor se presenta
como instalado. La misma interfaz admite el gestor nativo del hosting elegido.

## Inventario y separación

| Secreto | Consumidor | Rotación | Observación |
|---|---|---|---|
| login PostgreSQL app A/B | API | alternada | miembro de rol `NOLOGIN` runtime |
| login migrador | pipeline | por despliegue | nunca se entrega a runtime |
| JWT access secret | API | versionada | sesiones/ventana coordinadas |
| password pepper | identidad | plan de rehash | no retirar hasta migrar hashes |
| llaves clínicas | historia clínica | versión de escritura | conservar lectura de versiones antiguas |
| clave de mapa | build nativo | según proveedor | restringida por bundle/package; no `EXPO_PUBLIC_*` |

## Rotación de la credencial compartida

La contraseña anteriormente compartida se considera expuesta. No se repite ni
se almacena en el repositorio.

1. crear `ruta_emocional_app_b` con secreto aleatorio emitido por el gestor;
2. hacerlo miembro de `ruta_emocional_runtime` y ejecutar
   `verify_application_login.sql` conectándose como ese login;
3. publicar una versión nueva de `DATABASE_URL` y reciclar el pool;
4. comprobar liveness, readiness y un flujo de lectura/escritura permitido;
5. deshabilitar `LOGIN` de la identidad anterior y terminar sus sesiones;
6. rotar por separado la cuenta administrativa compartida en pgAdmin;
7. registrar actor, fecha, bundle y resultado, nunca el valor secreto.

La rotación de la cuenta administrativa requiere coordinación con el propietario
de pgAdmin para evitar bloquear su acceso. No debe automatizarse desde CI ni
desde la aplicación.

## Evidencia exigida

- identidad productiva distinta del rol grupal y del dueño de la base;
- prueba de membresía, atributos y privilegios efectivos al arrancar;
- acceso al secreto auditado por identidad de workload;
- último uso de la versión anterior y revocación confirmada;
- escaneo del repositorio, historial, logs y artefactos;
- procedimiento de rollback limitado y con caducidad.
