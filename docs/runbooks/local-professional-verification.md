# Verificación profesional local controlada

Este runbook habilita exclusivamente en desarrollo el ciclo de evidencia,
revisión administrativa y activación del espacio profesional. No sustituye la
arquitectura de almacenamiento productiva.

## Condiciones de seguridad

- `NODE_ENV` debe ser `development`; el backend rechaza el adaptador local en
  cualquier otro entorno.
- `ENABLE_LOCAL_QA` permanece en `false` por defecto.
- La evidencia se guarda bajo `LOCAL_QA_EVIDENCE_DIRECTORY`, fuera de los
  directorios públicos y excluida de Git.
- No se admiten roles administrativos en el registro HTTP. El administrador se
  concede a una cuenta local existente mediante una operación explícita y
  auditada.
- No se deben usar expedientes ni credenciales profesionales reales en este
  flujo de QA.

## Preparación

1. Configure los secretos y `DATABASE_URL` fuera del repositorio.
2. Active las siguientes variables solo para el proceso local:

   ```text
   NODE_ENV=development
   ENABLE_LOCAL_QA=true
   LOCAL_QA_EVIDENCE_DIRECTORY=./var/private/professional-evidence
   LOCAL_QA_EVIDENCE_MAXIMUM_BYTES=5242880
   LOCAL_QA_EVIDENCE_UPLOADS_PER_MINUTE=5
   ```

3. Compile el backend y registre primero una cuenta local que se utilizará para
   administración.
4. Con el mismo entorno del backend, conceda el rol:

   ```text
   npm run local-qa:grant-admin -- <correo-local-existente>
   ```

5. Cierre e inicie nuevamente la sesión de esa cuenta para obtener las
   capacidades administrativas actualizadas.

## Recorrido de prueba

1. Registre o inicie sesión con un psicólogo local.
2. Complete presentación, especialidad principal, modalidad, precio y
   disponibilidad.
3. En `Evidencia profesional`, seleccione un PDF, JPEG o PNG de prueba y envíelo
   a revisión.
4. Inicie sesión con la cuenta administrativa local y apruebe la solicitud desde
   `Verificación profesional`.
5. Mantenga abierta la sesión del psicólogo. El evento privado de verificación
   renueva `/auth/me` y el navegador cambia automáticamente al espacio
   profesional. `Actualizar estado` sirve como recuperación si el cliente estuvo
   desconectado durante la decisión.

## Evidencia técnica de la decisión

La aprobación o rechazo se ejecuta en una única transacción PostgreSQL que:

1. bloquea la solicitud pendiente;
2. registra `professional_verification_decisions` con el revisor;
3. actualiza la licencia y el perfil profesional;
4. inserta un evento de auditoría con actor, solicitud y decisión;
5. inserta el evento outbox que notifica únicamente la sala privada del usuario.

Las pruebas de integración validan la persistencia privada, autorización,
idempotencia de la decisión, auditoría, outbox y aislamiento del evento en
tiempo real.

## Gates que continúan abiertos para producción

Antes de aceptar evidencia real se requieren proveedor privado de objetos, URL
firmada, cuarentena, análisis antimalware, política legal de retención y borrado,
gestor externo de secretos y roles PostgreSQL de privilegio mínimo.
