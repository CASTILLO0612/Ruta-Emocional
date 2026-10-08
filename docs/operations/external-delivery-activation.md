# Activación de correo, push y almacenamiento seguro

Este procedimiento activa las integraciones sin guardar credenciales en el repositorio. Los archivos de cuenta y las claves se conservan únicamente en los paneles del proveedor, el almacén de credenciales de EAS o el entorno local del backend.

Antes de construir o arrancar los servicios con proveedores reales, ejecutar:

```powershell
npm run validate:external-delivery
```

El preflight solamente informa presencia, coherencia y pertenencia del archivo FCM al paquete Android. Nunca imprime claves, tokens ni valores sensibles.

## Resend

1. Verificar un dominio o remitente dentro de Resend.
2. Crear una API key con alcance exclusivo de envío.
3. Definir en `backend/.env`:

```dotenv
PASSWORD_RESET_PROVIDER=RESEND
PASSWORD_RESET_RESEND_API_KEY=re_...
PASSWORD_RESET_SENDER=Ruta Emocional <acceso@dominio-verificado.example>
PASSWORD_RESET_URL=rutaemocional://restablecer-contrasena
```

4. Reiniciar el backend y solicitar una recuperación desde una cuenta de QA.
5. Verificar recepción, apertura del deep link, vencimiento y uso único del token.

El backend envía `Idempotency-Key: password-reset/{id}` para que un reintento de la misma recuperación no duplique el correo.

## Expo Push Notifications y FCM V1

1. Crear o seleccionar el proyecto Firebase asociado a `com.rutaemocional.app`.
2. Descargar `google-services.json` y guardarlo como `frontend/google-services.json`.
3. Crear una clave de cuenta de servicio para FCM V1 y cargarla en EAS Credentials. Esa clave privada no debe permanecer en el proyecto.
4. Obtener el UUID del proyecto en Expo/EAS y definir en `frontend/.env.local`:

```dotenv
EXPO_PUBLIC_EAS_PROJECT_ID=00000000-0000-0000-0000-000000000000
GOOGLE_SERVICES_FILE=./google-services.json
```

5. Definir en `backend/.env`:

```dotenv
PUSH_NOTIFICATIONS_ENABLED=true
EXPO_PUSH_ACCESS_TOKEN=
PUSH_RECEIPT_INITIAL_DELAY_MS=900000
PUSH_RECEIPT_RETRY_DELAY_MS=900000
```

`EXPO_PUSH_ACCESS_TOKEN` puede permanecer vacío cuando el proyecto Expo no tiene habilitada la seguridad adicional de acceso. Si se activa esa protección, debe contener el token definido para el servicio push.

Los receipts se consultan después de 15 minutos y los resultados aún ausentes
se reprograman sin bloquear entregas posteriores. Los intervalos siguen la
recomendación operativa de Expo y pueden ajustarse por entorno sin modificar
código.

6. Generar e instalar una nueva compilación nativa. Expo Go no sustituye esta validación porque la configuración FCM pertenece al binario Android.
7. Iniciar sesión en el dispositivo, aceptar el permiso y comprobar que existe un registro activo en `push_devices`.

Los mensajes push contienen solamente avisos genéricos y un identificador interno. No contienen notas clínicas, texto de conversaciones, diagnóstico ni ubicación.

## S3 y GuardDuty Malware Protection

1. Iniciar sesión mediante AWS CLI con un perfil o AWS IAM Identity Center. No copiar claves AWS al repositorio.
2. Desplegar la plantilla:

```powershell
aws cloudformation deploy `
  --template-file infra/aws/cloudformation/media-security.yaml `
  --stack-name ruta-emocional-media-qa `
  --parameter-overrides MediaBucketName=ruta-emocional-media-qa-unico `
  --capabilities CAPABILITY_NAMED_IAM
```

3. Otorgar al rol o identidad que ejecuta el backend acceso mínimo a `s3:PutObject`, `s3:GetObject`, `s3:GetObjectTagging` y `s3:DeleteObject` dentro de `quarantine/*` del bucket creado.
4. Definir en `backend/.env`:

```dotenv
MEDIA_STORAGE_PROVIDER=S3
MEDIA_S3_REGION=us-east-1
MEDIA_S3_BUCKET=ruta-emocional-media-qa-unico
MEDIA_S3_ENDPOINT=
MEDIA_S3_FORCE_PATH_STYLE=false
```

5. Reiniciar el backend y subir una foto de perfil y una evidencia profesional.
6. Confirmar que ambos objetos aparecen en `quarantine/`, que no son públicos y que comienzan con `uploadState=quarantine`.
7. Esperar el tag `GuardDutyMalwareScanStatus`. Solo `NO_THREATS_FOUND` permite activar una foto o exponer una evidencia al flujo administrativo.
8. Repetir el procesamiento y comprobar que no crea una segunda activación. Los estados finales en PostgreSQL hacen que el procesamiento sea idempotente.

## Matriz de QA físico

| Escenario | Teléfono A | Teléfono B | Resultado esperado |
|---|---:|---:|---|
| Foto válida | Android | Android | La UI confirma recepción; la foto anterior continúa hasta aprobar el análisis |
| Foto inválida | Android | Android | Mensaje comprensible sin detalles técnicos |
| Mensaje en foreground | Emisor | Receptor | Banner visible y navegación a la conversación |
| Mensaje en background | Emisor | Receptor | Notificación del sistema y navegación al tocarla |
| Mensaje con app cerrada | Emisor | Receptor | Notificación del sistema y restauración segura de sesión/ruta |
| Cita | Paciente | Psicólogo | Aviso genérico y apertura de Agenda |
| Logout | Receptor | Receptor | El dispositivo se desactiva y deja de recibir notificaciones de esa cuenta |
| Reasignación de token | Cuenta A | Cuenta B | El mismo token queda activo únicamente para la cuenta actual |

Registrar por cada ejecución: modelo, Android, versión del APK, usuario, estado inicial de la app, hora, resultado, captura y log filtrado sin tokens ni datos personales.
