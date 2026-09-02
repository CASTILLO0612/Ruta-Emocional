# ADR-002 — Almacenamiento privado y gestor de secretos

## Estado

**Propuesto, condicionado.** La opción técnica preferida es AWS cuando el
hosting de la aplicación, la residencia de datos y el presupuesto permitan usar
una región aprobada. La decisión no pasa a `Accepted` hasta que producto, legal
e infraestructura confirmen mercado, región y cuenta productiva.

No se incorporará un SDK ni se habilitarán cargas reales basándose únicamente
en este ADR propuesto.

## Contexto

Las evidencias profesionales contienen documentos sensibles. El flujo necesita
carga directa privada, cuarentena, análisis antimalware, descarga temporal,
cifrado, auditoría y eliminación por política. Las credenciales de PostgreSQL,
JWT, pepper y proveedores tampoco deben residir en archivos `.env` productivos.

Una solución compuesta manualmente con servicios de distintos proveedores
aumentaría identidades, webhooks, reconciliación y superficie operativa para el
MVP.

## Decisión propuesta

Si AWS es aprobado como plataforma de hosting:

- Amazon S3, bucket de propósito general privado, para objetos;
- claves aleatorias generadas por servidor y prefijo de cuarentena;
- URLs prefirmadas de corta duración con método, clave, tamaño, checksum y tipo
  esperado controlados por backend;
- Malware Protection for S3 de Amazon GuardDuty sobre el prefijo de cuarentena;
- EventBridge para resultado autenticado e idempotente;
- etiquetado `GuardDutyMalwareScanStatus` y política de bucket que impida lectura
  antes de `NO_THREATS_FOUND`;
- cifrado con KMS, versionado y lifecycle según política aprobada;
- AWS Secrets Manager para secretos de backend;
- identidad de workload/IAM para obtener secretos, sin credenciales AWS de larga
  duración en el contenedor;
- rotación con usuarios PostgreSQL alternos cuando la topología de base lo
  soporte; para PostgreSQL no administrado se requiere un rotador específico y
  ensayo coordinado.

Documentación primaria consultada:

- [Carga con URL prefirmada de Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [Funcionamiento de Malware Protection for S3](https://docs.aws.amazon.com/guardduty/latest/ug/how-malware-protection-for-s3-gdu-works.html)
- [Compatibilidad, lifecycle y acceso por etiquetas](https://docs.aws.amazon.com/guardduty/latest/ug/supported-s3-features-malware-protection-s3.html)
- [Rotación administrada de AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotate-secrets_managed.html)
- [Plantillas de rotación para PostgreSQL](https://docs.aws.amazon.com/secretsmanager/latest/userguide/reference_available-rotation-templates.html)

## Invariantes de implementación

El dominio dependerá de puertos propios y no de tipos AWS:

```text
ProfessionalEvidenceStorage
  authorizeUpload
  inspectUploadedObject
  authorizeCleanDownload
  quarantine
  deleteAccordingToPolicy

SecretProvider
  resolveVersionedSecret
```

El resultado de escaneo se trata como entrega al menos una vez. La transición
usa identificador del proveedor y estado actual para deduplicar. Un tag del
objeto ayuda a aplicar defensa en profundidad, pero PostgreSQL conserva el
estado de negocio y auditoría.

No se aceptará una clave elegida por el cliente. Una URL prefirmada tampoco
autoriza descarga posterior ni demuestra que el objeto esté limpio.

## Alternativas

- Proveedor S3-compatible: reduce acoplamiento de objeto, pero exige integrar y
  operar por separado antimalware, eventos y secretos.
- Azure Blob + Defender for Storage + Key Vault: opción válida si el hosting
  aprobado es Azure; no justifica dividir el MVP entre nubes.
- Google Cloud Storage + Secret Manager: opción válida si el hosting aprobado es
  GCP; requiere diseñar el pipeline antimalware aprobado para esa plataforma.
- MinIO/autogestionado: control alto, pero transfiere al equipo disponibilidad,
  parches, malware, backups, KMS y respuesta a incidentes; no se recomienda para
  el MVP clínico.

## Condiciones para aceptar el ADR

1. mercado y jurisdicción definidos;
2. región con residencia y servicios verificados;
3. cuenta/organización, red y responsables operativos aprobados;
4. estimación de costo con volumen y tamaño máximo reales;
5. política de MIME, tamaño, URL, retención y eliminación aprobada;
6. prueba de carga, cuarentena, resultado duplicado, archivo infectado,
   indisponibilidad, descarga autorizada y eliminación;
7. prueba de acceso negativo directo al bucket y rotación sin caída.

Si AWS no cumple estas condiciones, se reabre la decisión antes de implementar
el adaptador; los puertos y estados permanecen válidos.
