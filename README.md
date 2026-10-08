# Ruta Emocional

Ruta Emocional es una plataforma móvil y web para conectar pacientes con
profesionales de psicología verificados y coordinar el ciclo de atención. El
recorrido cubre identidad, directorio profesional, solicitudes, ofertas,
relación asistencial, chat, llamadas, citas, navegación presencial, reseñas,
historia clínica y el agente contextual MENTA.

El proyecto es un monorepositorio TypeScript. PostgreSQL es la fuente canónica;
el backend expone una API REST versionada, eventos Socket.IO y streaming SSE,
mientras que la aplicación Expo comparte la mayor parte del código entre
Android y web.

> **Estado del entorno:** la solución está preparada para QA y demostración. El
> backend y Ollama todavía se ejecutan localmente y se publican temporalmente
> para pruebas. Antes de producción se requiere alojamiento HTTPS estable,
> observabilidad, backups, cierre de los gates clínicos y QA físico completo.

## Estado de capacidades

| Área | Estado | Alcance actual |
|---|---|---|
| Identidad y sesiones | Implementado | Registro, acceso, Google Sign-In, refresh rotativo, revocación y recuperación de acceso |
| Resend | Activo en QA | Entrega real de correos de recuperación; producción requiere dominio verificado |
| Directorio profesional | Implementado | Perfil, especialidades, modalidades, precios, disponibilidad, ubicación y verificación |
| Solicitudes y ofertas | Implementado | Creación, radar, elegibilidad, propuestas, cancelación y aceptación transaccional |
| Mensajería | Implementado | Conversaciones persistentes, Socket.IO, outbox, historial y borradores locales |
| Llamadas LiveKit | Implementado | Audio/video, aceptación, rechazo, finalización y tokens de sala efímeros; QA físico pendiente |
| Agenda y reseñas | Implementado | Disponibilidad, reserva, reprogramación, transiciones y feedback posterior a la cita |
| Navegación Android | Implementado | Google Navigation SDK, ruta, tráfico, recálculo y guía giro a giro; requiere APK nativo |
| Mapa web | Implementado como fallback | Mapa embebido y salida a proveedor externo; sin navegación giro a giro dentro del navegador |
| Historia clínica | Implementado | Expedientes, encuentros, notas versionadas, firma, enmiendas y planes de tratamiento |
| MENTA | Activo en QA local | Triaje determinista y agente contextual con Ollama, cifrado y streaming SSE |
| Push Expo + FCM | Implementado/configurado | Registro de dispositivos, outbox, tickets y receipts; matriz de QA físico pendiente |
| Fotos y evidencias locales | Implementado | Selección, validación, compresión, reemplazo y errores sanitizados |
| AWS S3 + GuardDuty | **Pendiente** | Adaptadores y plantilla existen, pero el bucket, IAM y Malware Protection no están activos |
| Pagos | No habilitado | El modelo relacional existe para una fase posterior; no hay pasarela productiva |

## Funcionalidad por actor

### Paciente

- Registrar cuenta o acceder con correo/contraseña y Google.
- Editar información personal y fotografía.
- Consultar el directorio de psicólogos verificados.
- Crear solicitudes de atención por chat, llamada o modalidad presencial.
- Recibir y comparar ofertas profesionales.
- Aceptar una propuesta y establecer una relación asistencial.
- Conversar por chat o iniciar/aceptar llamadas habilitadas.
- Consultar, reservar y gestionar citas.
- Obtener una ruta al consultorio y usar navegación nativa en Android.
- Calificar una cita completada.
- Conversar con MENTA y usar la orientación determinista separada.

### Psicólogo

- Completar el perfil profesional y ubicación de práctica.
- Configurar especialidades, modalidades, precios y disponibilidad.
- Adjuntar evidencia y solicitar verificación.
- Consultar solicitudes elegibles y presentar ofertas.
- Conversar y realizar llamadas dentro de relaciones autorizadas.
- Gestionar agenda y reseñas recibidas.
- Consultar pacientes vinculados y administrar su historia clínica autorizada.
- Usar MENTA en alcance profesional como apoyo de lectura y preparación.

### Administrador

- Gestionar el catálogo de especialidades.
- Consultar la cola de verificaciones profesionales.
- Aprobar o rechazar evidencias y registrar la decisión.
- Auditar operaciones permitidas sin recibir acceso clínico implícito.

## Arquitectura

El flujo principal es:

```text
Expo / React Native
  ├─ REST JSON ───────────────┐
  ├─ SSE (MENTA) ────────────┤
  ├─ Socket.IO (eventos) ────┤
  └─ LiveKit WebRTC ──────┐  │
                          │  ▼
                    Backend Express
                      ├─ presentación
                      ├─ aplicación
                      ├─ dominio / puertos
                      └─ infraestructura
                           ├─ Prisma / PostgreSQL / PostGIS
                           ├─ Ollama
                           ├─ Resend
                           ├─ Expo Push / FCM
                           ├─ LiveKit
                           └─ almacenamiento LOCAL
                              └─ S3 + GuardDuty (pendiente)
```

Los módulos canónicos del backend siguen la separación:

```text
presentation → application → domain/ports ← infrastructure
```

- Los controladores validan y traducen HTTP; no consultan Prisma directamente.
- Los servicios de aplicación coordinan casos de uso y transacciones.
- El dominio contiene estados, reglas e invariantes.
- Los adaptadores implementan persistencia y proveedores externos.
- Los repositorios vuelven a validar propiedad o relación como defensa adicional.
- `compositionRoot.ts` ensambla las implementaciones según la configuración.

## Tecnologías

### Aplicación

- React `19.2` y React Native `0.86`.
- Expo SDK `57` y TypeScript.
- React Navigation 7 con stacks y tabs por rol.
- Zustand para estado global.
- React Native Web para navegador.
- Socket.IO Client para eventos en tiempo real.
- `expo-secure-store` para el refresh token en Android/iOS.
- `expo-notifications` para push.
- `expo-image-picker` y `expo-image-manipulator` para fotografías.
- LiveKit React Native y WebRTC para audio/video.
- Google Navigation SDK para mapas y navegación Android.
- Lucide como iconografía principal y MorphIcons para microinteracciones.
- Inter y Poppins como familias tipográficas.

### Backend y datos

- Node.js 22+, Express y TypeScript.
- Socket.IO y Server-Sent Events.
- Prisma `6.12`.
- PostgreSQL/PostGIS.
- LiveKit Server SDK.
- AWS SDK para el adaptador S3 pendiente.
- JWT, scrypt, AES-256-GCM y controles de rate limiting propios.
- Resend mediante API HTTP.
- Expo Push Service y receipts.

### Infraestructura y herramientas

- Docker Compose para PostgreSQL/PostGIS local.
- EAS Build para APK internos firmados.
- Firebase/FCM V1 para push Android.
- Google Cloud Console para OAuth y Navigation SDK.
- Ollama local para el proveedor actual de MENTA.
- CloudFormation preparada para S3/GuardDuty, todavía sin activar.

## Estructura del repositorio

```text
Ruta Emocional/
├── frontend/
│   ├── assets/                   # Marca, splash, iconos y documentos legales
│   ├── plugins/                  # Config plugins nativos de Expo
│   ├── src/
│   │   ├── components/           # Componentes visuales reutilizables
│   │   ├── config/               # Configuración pública validada
│   │   ├── navigation/           # Rutas por rol
│   │   ├── providers/            # Inicialización transversal
│   │   ├── repositories/         # Contratos tipados contra la API
│   │   ├── screens/              # Flujos de paciente, psicólogo y admin
│   │   ├── services/             # HTTP, sesión, sockets, Google y push
│   │   ├── store/                # Estado Zustand
│   │   ├── theme/                # Tokens visuales
│   │   └── utils/                # Errores y utilidades
│   ├── app.config.ts
│   ├── app.json
│   └── eas.json
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # Modelo relacional canónico
│   │   └── migrations/           # Historial SQL inmutable
│   ├── src/
│   │   ├── modules/              # Módulos de dominio
│   │   ├── shared/               # HTTP, logging, cifrado y storage
│   │   ├── sockets/              # Autorización y eventos Socket.IO
│   │   ├── app.ts                # Composición HTTP
│   │   └── server.ts             # HTTP, sockets y workers
│   └── tests/                    # Unitarias e integración
├── docs/                         # API, arquitectura, seguridad y operaciones
├── infra/aws/cloudformation/     # S3/GuardDuty pendiente
├── scripts/                      # QA, smoke tests y validaciones
├── compose.yaml
└── package.json
```

## Modelo de datos

El corte actual contiene:

- 63 modelos Prisma.
- 28 migraciones versionadas.
- Normalización documentada hasta tercera forma normal.
- Extensión PostGIS para consultas geográficas.
- Restricciones, claves candidatas e índices explícitos.
- Outbox, auditoría e idempotencia como estructuras operativas.

Los principales agregados son:

- usuarios, roles, sesiones e identidades federadas;
- pacientes, psicólogos, licencias, especialidades y modalidades;
- solicitudes, ofertas y relaciones asistenciales;
- citas, eventos de cita y reseñas;
- conversaciones, participantes, mensajes y llamadas;
- expedientes, encuentros, notas, diagnósticos y planes;
- consentimiento, triaje y privacidad;
- conversaciones, turnos e invocaciones MENTA;
- dispositivos y entregas push;
- objetos multimedia en cuarentena;
- eventos de auditoría, outbox e idempotencia.

Fuentes:

- [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)
- [`docs/database/normalization-3nf.md`](docs/database/normalization-3nf.md)
- [`docs/Hackathon/desarrollo/Entregable/Diagrama ER.pdf`](docs/Hackathon/desarrollo/Entregable/Diagrama%20ER.pdf)

## Requisitos

- Git.
- Node.js `22.13` o posterior.
- npm.
- PostgreSQL con PostGIS, local o mediante Docker Desktop.
- Ollama para probar MENTA con el proveedor local.
- Android Studio/SDK o un dispositivo Android para módulos nativos.
- Cuenta Expo/EAS para generar APK.
- Proyecto Google/Firebase asociado a `com.rutaemocional.app`.

Para integraciones opcionales o externas:

- Cuenta Resend.
- Proyecto LiveKit Cloud o servidor compatible.
- Cuenta AWS para la futura activación S3/GuardDuty.

## Instalación

1. Clonar el repositorio.

   ```bash
   git clone https://github.com/CASTILLO0612/Ruta-Emocional.git
   cd Ruta-Emocional
   ```

2. Instalar las dependencias bloqueadas.

   ```bash
   npm --prefix backend ci
   npm --prefix frontend ci
   ```

3. Crear los archivos locales de configuración.

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

   En PowerShell puede usar `Copy-Item`. Nunca confirme archivos `.env`, claves,
   tokens, `google-services.json`, keystores ni cuentas de servicio.

4. Iniciar PostgreSQL/PostGIS y aplicar las migraciones.

   ```bash
   docker compose up -d postgres
   npm run db:migrate:deploy
   npm run db:validate
   ```

5. Descargar el modelo configurado en Ollama para el entorno local.

   ```bash
   ollama pull phi3:3.8b
   ollama serve
   ```

## Configuración

Las plantillas canónicas están en:

- [`.env.example`](.env.example)
- [`backend/.env.example`](backend/.env.example)
- [`frontend/.env.example`](frontend/.env.example)

Los valores siguientes son ejemplos; no copie secretos reales al README.

### Backend mínimo

```dotenv
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://usuario:password@localhost:5432/ruta_emocional?schema=public
JWT_ACCESS_SECRET=<32_o_mas_caracteres_aleatorios>
PASSWORD_PEPPER=<secreto_diferente>
CLINICAL_CONTENT_ENCRYPTION_KEYS=1:<clave_base64_de_32_bytes>
CLINICAL_ACTIVE_CONTENT_ENCRYPTION_KEY_VERSION=1
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

### Frontend mínimo

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_TRIAGE_COUNTRY_CODE=NI
EXPO_PUBLIC_DIRECTORY_RADIUS_KM=25
EXPO_PUBLIC_REQUEST_POLL_INTERVAL_MS=5000
```

En un teléfono físico, `localhost` apunta al teléfono. Para desarrollo use una
IP de la red local accesible o un origen HTTPS de QA. Un APK Preview incorpora
`EXPO_PUBLIC_API_URL` durante la compilación, por lo que cambiarla requiere una
nueva compilación si no existe un canal OTA configurado.

### Google Sign-In

Backend:

```dotenv
GOOGLE_AUTH_ENABLED=true
GOOGLE_WEB_CLIENT_ID=<oauth_client_id_tipo_web>
```

Frontend:

```dotenv
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<mismo_client_id_web>
```

Android necesita además un cliente OAuth de tipo Android para el paquete
`com.rutaemocional.app` y las huellas SHA-1 de las firmas utilizadas. El cliente
web es el `audience` que valida el backend; el cliente Android autoriza el
binario firmado.

### Resend

```dotenv
PASSWORD_RESET_PROVIDER=RESEND
PASSWORD_RESET_RESEND_API_KEY=<api_key_privada>
PASSWORD_RESET_SENDER="Ruta Emocional <onboarding@resend.dev>"
PASSWORD_RESET_URL=rutaemocional://restablecer-contrasena
LOCAL_QA_EXPOSE_PASSWORD_RESET_TOKEN=false
```

`onboarding@resend.dev` sirve para pruebas limitadas. Para enviar a usuarios
reales se debe verificar un dominio propio y cambiar el remitente. La API key
permanece exclusivamente en el backend.

### MENTA con Ollama

```dotenv
TRIAGE_ENABLED=true
TRIAGE_PROTOCOL_APPROVED=false
TRIAGE_EXTERNAL_PROVIDER_ENABLED=false

MENTA_AGENT_ENABLED=true
MENTA_AI_PROVIDER=OLLAMA
MENTA_OLLAMA_BASE_URL=http://127.0.0.1:11434
MENTA_OLLAMA_MODEL=phi3:3.8b
MENTA_OLLAMA_KEEP_ALIVE=10m
MENTA_OLLAMA_TOOL_CALLING_ENABLED=false
```

El triaje determinista y el agente conversacional son capacidades separadas.
El agente transmite deltas desde Ollama y el backend los entrega al frontend
mediante SSE. Sus mensajes se almacenan cifrados.

### Llamadas con LiveKit

```dotenv
CALL_PROVIDER=LIVEKIT
LIVEKIT_URL=wss://<proyecto>.livekit.cloud
LIVEKIT_API_KEY=<api_key_privada>
LIVEKIT_API_SECRET=<api_secret_privado>
CALL_ACCESS_TOKEN_TTL_SECONDS=600
CALL_RINGING_TIMEOUT_SECONDS=45
CALL_MAXIMUM_DURATION_SECONDS=7200
```

Estas variables pertenecen únicamente al backend. La aplicación recibe un
token efímero limitado a una sala. LiveKit/WebRTC requiere un APK nativo; no
funciona mediante Expo Go.

### Push Android con Expo y FCM

1. Registrar `com.rutaemocional.app` en Firebase.
2. Guardar el archivo descargado como `frontend/google-services.json`.
3. Cargar la cuenta de servicio FCM V1 en EAS Credentials; no conservarla en Git.
4. Configurar:

   ```dotenv
   # frontend/.env.local o entorno EAS
   EXPO_PUBLIC_EAS_PROJECT_ID=<uuid_del_proyecto_expo>
   GOOGLE_SERVICES_FILE=./google-services.json
   ```

   ```dotenv
   # backend/.env
   PUSH_NOTIFICATIONS_ENABLED=true
   EXPO_PUSH_ACCESS_TOKEN=
   PUSH_RECEIPT_INITIAL_DELAY_MS=900000
   PUSH_RECEIPT_RETRY_DELAY_MS=900000
   ```

El backend registra instalaciones, crea entregas idempotentes desde outbox,
consulta receipts y desactiva tokens inválidos. Las notificaciones no incluyen
notas clínicas, conversaciones, diagnósticos ni ubicación precisa.

### Google Navigation SDK

```dotenv
# frontend/.env.local o variable sensible de EAS
GOOGLE_NAVIGATION_API_KEY=<clave_android_restringida>
```

La clave debe restringirse por:

- paquete `com.rutaemocional.app`;
- huella SHA-1 de la firma correspondiente;
- APIs de Google necesarias;
- cuotas, presupuesto y alertas.

Android utiliza `@googlemaps/react-native-navigation-sdk`. La fase de
planificación conserva mapa, lugares y ruta; al iniciar la navegación activa
guía giro a giro, tráfico, recálculo y presentación nocturna. Web mantiene un
fallback embebido y no intenta ejecutar el SDK nativo.

### Fotografías, S3 y GuardDuty

El entorno actual usa:

```dotenv
MEDIA_STORAGE_PROVIDER=LOCAL
```

#### AWS S3 + GuardDuty — pendiente

El repositorio contiene adaptadores S3, procesamiento idempotente de resultados
de Malware Protection y la plantilla
[`infra/aws/cloudformation/media-security.yaml`](infra/aws/cloudformation/media-security.yaml),
pero la infraestructura todavía no está desplegada ni activa.

Cuando se apruebe su costo y se configure la cuenta AWS, se deberán completar:

1. autenticación mediante AWS CLI o IAM Identity Center;
2. bucket privado con nombre único;
3. rol IAM de mínimo privilegio;
4. GuardDuty Malware Protection para el prefijo `quarantine/`;
5. despliegue de la plantilla CloudFormation;
6. configuración privada del backend:

   ```dotenv
   MEDIA_STORAGE_PROVIDER=S3
   MEDIA_S3_REGION=<region>
   MEDIA_S3_BUCKET=<bucket_privado>
   MEDIA_S3_ENDPOINT=
   MEDIA_S3_FORCE_PATH_STYLE=false
   ```

7. QA con fotos válidas, archivos rechazados y procesamiento repetido.

Hasta completar esos pasos, no debe afirmarse que AWS o el análisis antimalware
están activos. Las fotos y evidencias continúan en el almacenamiento local de QA.

## Ejecución local

Abra terminales separadas desde la raíz.

Backend:

```bash
npm run start:backend
```

Frontend:

```bash
npm run start:frontend
```

O directamente:

```bash
cd frontend
npx expo start --clear
```

Servicios esperados:

- Web/Metro: `http://localhost:8081`
- Backend: `http://localhost:5000`
- Ollama: `http://127.0.0.1:11434`

Health checks:

```text
GET /health
GET /api/v1/health/live
GET /api/v1/health/ready
```

`ready` comprueba base de datos, retraso/dead-letter del outbox y solicitudes de
privacidad vencidas.

## Recorrido funcional recomendado

1. Registrar un paciente y un psicólogo.
2. Completar perfil, modalidad, especialidad, disponibilidad y evidencia.
3. Aprobar la verificación desde la cola administrativa de QA.
4. Crear una solicitud como paciente.
5. Presentar y aceptar una oferta como psicólogo/paciente.
6. Probar chat y entrega en tiempo real.
7. Para modalidad `CALL`, iniciar una llamada entre dos dispositivos.
8. Reservar, reprogramar y completar una cita.
9. Registrar una reseña posterior a la cita.
10. Para modalidad presencial, calcular la ruta e iniciar navegación Android.
11. Crear un encuentro y una nota clínica con datos ficticios.
12. Conversar con MENTA y comprobar streaming y reinicio de conversación.
13. Validar correo de recuperación y deep link.
14. Validar push con app abierta, en background y cerrada.

## API

La API tiene 76 rutas y 82 operaciones documentadas bajo `/api/v1`. Usa DTO
explícitos y no expone entidades Prisma directamente.

| Método | Ruta | Propósito |
|---|---|---|
| `POST` | `/api/v1/auth/register/patient` | Registrar paciente |
| `POST` | `/api/v1/auth/register/psychologist` | Registrar cuenta profesional |
| `POST` | `/api/v1/auth/login` | Iniciar sesión |
| `POST` | `/api/v1/auth/google` | Intercambiar credencial Google validada |
| `POST` | `/api/v1/auth/password-reset/request` | Solicitar recuperación sin enumerar cuentas |
| `POST` | `/api/v1/auth/password-reset/complete` | Consumir token opaco de un solo uso |
| `PATCH` | `/api/v1/auth/me` | Editar perfil propio |
| `PUT` | `/api/v1/auth/me/photo` | Actualizar fotografía |
| `GET` | `/api/v1/psychologists` | Consultar directorio público |
| `POST` | `/api/v1/service-requests` | Crear solicitud |
| `POST` | `/api/v1/service-requests/:id/offers` | Presentar oferta elegible |
| `POST` | `/api/v1/service-requests/:requestId/offers/:offerId/accept` | Aceptar oferta transaccionalmente |
| `GET` | `/api/v1/conversations` | Listar conversaciones propias |
| `POST` | `/api/v1/conversations/:id/messages` | Enviar mensaje idempotente |
| `POST` | `/api/v1/conversations/:id/calls` | Iniciar llamada |
| `POST` | `/api/v1/calls/:id/join` | Aceptar y obtener token de sala |
| `POST` | `/api/v1/appointments` | Reservar cita |
| `POST` | `/api/v1/appointments/:id/review` | Registrar reseña |
| `POST` | `/api/v1/clinical/encounters` | Crear encuentro clínico autorizado |
| `GET` | `/api/v1/menta/bootstrap` | Cargar consentimiento y conversación |
| `POST` | `/api/v1/menta/conversations/:id/turns/stream` | Enviar mensaje con streaming SSE |
| `PUT` | `/api/v1/notifications/devices/current` | Registrar instalación push |

Contrato completo: [`docs/api/openapi.yaml`](docs/api/openapi.yaml).

## Tiempo real y procesamiento asíncrono

- **Socket.IO:** notifica mensajes y eventos autorizados en foreground.
- **Outbox:** conserva eventos dentro de la misma transacción de negocio.
- **Push dispatcher:** transforma eventos permitidos en entregas Expo/FCM.
- **Receipts:** reconsulta resultados sin bloquear entregas posteriores.
- **SSE:** transmite deltas de MENTA.
- **LiveKit:** transporta medios WebRTC; PostgreSQL conserva el ciclo de sesión.
- **Media scan processor:** implementado para consultar tags GuardDuty cuando S3
  sea activado.

Los sockets y proveedores de entrega no son fuente de verdad. El estado durable
permanece en PostgreSQL.

## Seguridad

- Access tokens breves y refresh tokens rotativos/revocables.
- Refresh token en Secure Store; access token en memoria.
- Contraseñas con scrypt, salt y pepper; migración de hashes bcrypt heredados.
- Verificación de Google ID Token en el backend.
- Rate limits diferenciados por operación.
- CORS por lista permitida y headers de seguridad.
- Límite estricto de cuerpos JSON y validación de entrada.
- Autorización por rol, capacidad, propiedad y relación asistencial.
- AES-256-GCM para contenido clínico y conversaciones MENTA.
- Idempotencia para mutaciones críticas.
- Auditoría de acciones sensibles.
- Errores sanitizados: el cliente no recibe stack traces ni mensajes internos.
- Tokens LiveKit de duración breve y permisos mínimos.
- Notificaciones sin contenido clínico sensible.
- Evidencias privadas y fotos en cuarentena cuando se active S3.

Documentación:

- [`docs/security/security-and-privacy.md`](docs/security/security-and-privacy.md)
- [`docs/security/authorization-matrix.md`](docs/security/authorization-matrix.md)
- [`docs/security/native-accessibility-and-security.md`](docs/security/native-accessibility-and-security.md)

## Calidad y pruebas

Compuerta completa:

```bash
npm run quality:delivery
```

Incluye documentación, Prisma, build backend, pruebas unitarias, typecheck,
pruebas frontend, validación visual y configuración nativa.

Comandos adicionales:

```bash
npm run validate:external-delivery
npm run quality:load-smoke
npm run quality:menta-stream
npm --prefix backend run test:integration
npm --prefix frontend test -- --runInBand
```

El corte actual contiene aproximadamente:

- 12 archivos de pruebas unitarias del backend.
- 9 archivos de integración del backend.
- 62 archivos de pruebas del frontend.

La automatización no reemplaza QA físico para Google Sign-In, GPS, navegación,
cámara, micrófono, LiveKit, FCM, background/cierre forzado ni fabricantes Android.

## Compilación Android

El perfil `preview` de EAS genera un APK de distribución interna:

```bash
cd frontend
npx --yes eas-cli@latest build --platform android --profile preview
```

El artefacto debe usar:

- la URL HTTPS correcta del backend;
- `google-services.json` correspondiente al paquete;
- clave Navigation SDK restringida;
- huellas SHA-1 del keystore real;
- credenciales FCM V1 cargadas en EAS.

Navigation SDK, LiveKit y FCM requieren una compilación nativa nueva cuando
cambia su configuración; recargar Metro no modifica un APK ya instalado.

## Limitaciones y pendientes

1. **AWS S3 y GuardDuty permanecen pendientes.** El código no equivale a una
   infraestructura activa.
2. El backend necesita un despliegue HTTPS estable; los túneles rápidos son solo
   para QA y pueden cambiar o caducar.
3. Ollama corre en el equipo local; se debe definir la estrategia permanente de
   inferencia antes de producción.
4. Push, llamadas y navegación requieren cierre de la matriz de QA con varios
   teléfonos.
5. Google Sign-In debe comprobarse con cada firma Android utilizada.
6. El protocolo clínico de triaje y las políticas de retención requieren
   aprobación formal para producción.
7. Pagos no están habilitados.
8. No se graban llamadas y todavía no existe integración CallKit/ConnectionService
   de pantalla completa como una llamada telefónica del sistema.
9. Web no ofrece navegación interna giro a giro.
10. iOS requiere configuración, firma y QA independientes.

## Documentación técnica

- Índice: [`docs/README.md`](docs/README.md)
- OpenAPI: [`docs/api/openapi.yaml`](docs/api/openapi.yaml)
- Navegación Google: [`docs/architecture/ADR-007-native-google-navigation.md`](docs/architecture/ADR-007-native-google-navigation.md)
- Llamadas: [`docs/operations/realtime-calls.md`](docs/operations/realtime-calls.md)
- Entrega externa: [`docs/operations/external-delivery-activation.md`](docs/operations/external-delivery-activation.md)
- Requisitos no funcionales: [`docs/operations/non-functional-requirements.md`](docs/operations/non-functional-requirements.md)
- Preparación productiva: [`docs/operations/production-gates.md`](docs/operations/production-gates.md)
- Modelo relacional: [`docs/Hackathon/desarrollo/Entregable/Diagrama ER.pdf`](docs/Hackathon/desarrollo/Entregable/Diagrama%20ER.pdf)

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulte [LICENSE](LICENSE).
