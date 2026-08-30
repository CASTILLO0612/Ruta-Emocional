# Ruta Emocional

Ruta Emocional es una aplicación móvil que conecta pacientes con profesionales de psicología verificados. El flujo demostrable permite registrar cuentas, verificar localmente a un profesional, publicar solicitudes de atención, presentar y aceptar ofertas, conversar, gestionar citas y documentar un expediente clínico básico.

El MVP usa PostgreSQL como fuente canónica para los módulos implementados. La evidencia de la categoría **Aficionado / Desarrollo** se encuentra en [`docs/Hackathon/desarrollo/`](docs/Hackathon/desarrollo/README.md).

## Capacidades demostrables

| Módulo | Estado actual |
|---|---|
| Identidad | registro de paciente o psicólogo, acceso, renovación y revocación de sesión en PostgreSQL |
| Directorio profesional | perfil, especialidades, modalidades, disponibilidad y verificación controlada |
| Solicitudes y ofertas | creación, búsqueda elegible, oferta, retiro, aceptación y cancelación transaccional |
| Mensajería | conversaciones y mensajes persistidos, autorización por participante y entrega Socket.IO mediante outbox |
| Agenda | disponibilidad, reserva, reprogramación y transiciones de cita con prevención de solapamientos |
| Historia clínica | expedientes, encuentros, notas versionadas, firma, enmiendas y planes de tratamiento para el psicólogo autorizado |
| Administración | cola local de verificación, decisión y auditoría sin acceso clínico implícito |

MENTA, pagos y audio/video no forman parte del recorrido funcional que se presenta en Desarrollo. Sus superficies demostrativas fueron retiradas y solo volverán mediante módulos seguros en sus fases correspondientes.

## Tecnologías y arquitectura

### Aplicación móvil

- React Native 0.86 y Expo SDK 57.
- TypeScript, React Navigation y Zustand.
- Socket.IO Client para notificaciones en tiempo real.
- `expo-secure-store` para el refresh token en Android/iOS; el access token permanece en memoria.
- Material Icons mediante Expo Vector Icons; la interfaz no depende de emojis como iconografía.

### API y datos

- Node.js, Express, TypeScript y Socket.IO.
- PostgreSQL/PostGIS con 19 migraciones versionadas y un esquema normalizado al menos hasta tercera forma normal.
- Prisma como adaptador de persistencia dentro de módulos separados por dominio.
- Contratos REST versionados bajo `/api/v1` y respuestas mediante DTO explícitos.
- Sesiones rotativas, contraseñas con scrypt y pepper, límites de peticiones, CORS por lista permitida y auditoría de acciones sensibles.
- Cifrado AES-256-GCM de contenido clínico mediante claves externas al repositorio.

Los módulos canónicos siguen el flujo `presentación -> aplicación -> dominio/puertos -> infraestructura`. Los controladores no consultan Prisma directamente y los repositorios vuelven a aplicar propiedad o relación como defensa adicional.

## Estructura del repositorio

```text
Ruta Emocional/
├── frontend/                   # Aplicación React Native/Expo
│   └── src/
│       ├── screens/            # Flujos de paciente, psicólogo y administrador
│       ├── repositories/       # Acceso tipado a la API
│       ├── services/           # HTTP, sesión y Socket.IO
│       └── store/              # Estado de aplicación con Zustand
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Modelo relacional canónico
│   │   └── migrations/         # Historial SQL inmutable
│   ├── src/modules/            # Identidad, directorio, solicitudes, mensajería, agenda y clínica
│   └── tests/                  # Pruebas unitarias e integración
├── docs/                       # Arquitectura, seguridad, API, reglas y entregables
├── output/pdf/                 # DER conceptual exportado
├── compose.yaml                # PostgreSQL/PostGIS local
└── package.json                # Scripts del monorepositorio
```

## Requisitos

- Git.
- Node.js 22.13 o posterior y npm, mínimo requerido por Expo SDK 57.
- PostgreSQL con PostGIS, instalado localmente o mediante Docker Desktop.
- Para Android/iOS: dispositivo o emulador compatible. La demostración también puede ejecutarse en web.

## Instalación

1. Clonar el repositorio.

   ```bash
   git clone https://github.com/CASTILLO0612/Ruta-Emocional.git
   cd Ruta-Emocional
   git switch postgresql-migration
   ```

2. Instalar las dependencias bloqueadas.

   ```bash
   npm --prefix backend ci
   npm --prefix frontend ci
   ```

3. Crear los archivos locales de configuración, sin confirmarlos en Git.

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

   En PowerShell, use `Copy-Item` en lugar de `cp` si lo prefiere. Cambie todos los valores de ejemplo, especialmente contraseñas, secretos JWT, pepper y clave de cifrado clínico.

4. Iniciar PostgreSQL/PostGIS y aplicar las migraciones.

   ```bash
   docker compose up -d postgres
   npm run db:migrate:deploy
   npm run db:validate
   ```

Si utiliza PostgreSQL 16 ya instalado, cree una base vacía, habilite PostGIS, configure `DATABASE_URL` en `backend/.env` y ejecute los dos últimos comandos. No necesita levantar el contenedor.

## Configuración mínima

Las plantillas completas y comentadas están en [`.env.example`](.env.example), [`backend/.env.example`](backend/.env.example) y [`frontend/.env.example`](frontend/.env.example). Como mínimo, el backend requiere:

```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/ruta_emocional?schema=public
JWT_ACCESS_SECRET=<32_o_mas_caracteres_aleatorios>
PASSWORD_PEPPER=<otro_valor_aleatorio_diferente>
CLINICAL_CONTENT_ENCRYPTION_KEYS=1:<clave_base64_de_32_bytes>
CLINICAL_ACTIVE_CONTENT_ENCRYPTION_KEY_VERSION=1
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

El frontend necesita el origen del servidor, sin agregar `/api`:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000
```

En un teléfono físico, `localhost` apunta al propio teléfono; use la IP local del equipo que ejecuta el backend.

## Ejecución local

Abra dos terminales desde la raíz:

```bash
npm run start:backend
```

```bash
npm run start:frontend
```

El backend expone `GET http://localhost:5000/api/v1/health/live` y `GET http://localhost:5000/api/v1/health/ready`. Expo mostrará las opciones para web, Android o iOS.

### Recorrido recomendado

1. Registrar un paciente y un psicólogo.
2. Completar el perfil profesional y adjuntar una evidencia de prueba controlada.
3. Conceder el rol administrador local siguiendo [`docs/runbooks/local-professional-verification.md`](docs/runbooks/local-professional-verification.md).
4. Aprobar la verificación desde la cola administrativa e iniciar sesión nuevamente como psicólogo.
5. Crear una solicitud como paciente, ofertar como psicólogo y aceptar la oferta.
6. Probar conversación, agenda y expediente clínico desde la relación creada.

## Endpoints representativos

| Método | Ruta | Propósito |
|---|---|---|
| `POST` | `/api/v1/auth/register/patient` | registrar paciente |
| `POST` | `/api/v1/auth/register/psychologist` | solicitar cuenta profesional |
| `POST` | `/api/v1/auth/login` | iniciar sesión |
| `GET` | `/api/v1/psychologists` | consultar directorio público |
| `POST` | `/api/v1/service-requests` | crear solicitud autenticada |
| `POST` | `/api/v1/service-requests/:requestId/offers` | crear oferta elegible |
| `GET` | `/api/v1/conversations` | listar conversaciones propias |
| `POST` | `/api/v1/appointments` | reservar cita autorizada |
| `POST` | `/api/v1/clinical/encounters` | registrar encuentro clínico autorizado |

El contrato completo está en [`docs/api/openapi.yaml`](docs/api/openapi.yaml).

## Verificación de calidad

```bash
npm --prefix backend run build
npm --prefix backend test
npm --prefix frontend run typecheck
```

Con una base de pruebas configurada de forma separada:

```bash
TEST_DATABASE_URL=<url_postgresql_de_pruebas> npm --prefix backend run test:integration
```

La evidencia de tercera forma normal está en [`docs/database/normalization-3nf.md`](docs/database/normalization-3nf.md); las reglas de autorización están en [`docs/security/authorization-matrix.md`](docs/security/authorization-matrix.md).

## Seguridad de la demostración

- No confirme archivos `.env`, contraseñas, tokens, evidencias profesionales ni claves de cifrado.
- Active `ENABLE_LOCAL_QA` solo en `development`; el servidor rechaza ese flujo en producción.
- PostgreSQL es la única base conectada por el proceso de aplicación; MENTA y pagos permanecen deshabilitados hasta sus fases seguras.
- Use datos ficticios en la historia clínica y en la evidencia profesional del hackathon.
- El administrador operativo no recibe acceso clínico por su rol.

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulte [LICENSE](LICENSE).
