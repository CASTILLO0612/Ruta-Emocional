# Ruta Emocional

Ruta Emocional es una aplicación móvil en evolución para conectar pacientes con profesionales de psicología verificados. El repositorio contiene un prototipo funcional y la base de una nueva arquitectura productiva sobre PostgreSQL. Las funciones clínicas, pagos, MENTA y llamadas permanecen sujetas a las puertas de seguridad descritas en [`docs/`](docs/README.md).

---

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Características Principales](#características-principales)
- [Arquitectura y Tecnologías](#arquitectura-y-tecnologías)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Requisitos Previos](#requisitos-previos)
- [Instalación y Configuración](#instalación-y-configuración)
- [Variables de Entorno](#variables-de-entorno)
- [Ejecución](#ejecución)
- [Licencia](#licencia)

---

## Descripción General

El objetivo de Ruta Emocional es democratizar y agilizar el acceso a servicios de psicología clínica, eliminando barreras burocráticas y facilitando la negociación transparente de presupuestos entre el paciente y el especialista. Mediante un radar de geolocalización e inteligencia artificial para análisis preliminar de síntomas, la plataforma optimiza el tiempo de respuesta en situaciones de necesidad emocional inmediata o programada.

---

## Estado de capacidades

| Capacidad | Prototipo actual | Objetivo MVP |
|---|---|---|
| Identidad | flujo básico heredado | sesiones revocables PostgreSQL; primer flujo v1 implementado |
| Directorio/geolocalización | demostración y datos fallback | solo profesionales verificados, PostGIS y privacidad de ubicación |
| Solicitudes/ofertas | REST/Socket.IO heredado | transacciones, autorización por objeto, idempotencia y outbox |
| Mensajería | demostración | conversación autorizada, persistencia previa al evento y cursores |
| Agenda | interfaz parcial | disponibilidad, citas y no solapamiento PostgreSQL |
| Historia clínica | no disponible en UI | expediente mínimo versionado y auditado |
| MENTA | demostración sin protocolo clínico completo | orientación con salvaguardas y revisión clínica |
| Pagos | simulación | deshabilitados hasta elegir proveedor y webhooks firmados |
| Audio/video | señalización visual, no media RTC real | deshabilitado hasta proveedor/arquitectura aprobados |

No deben presentarse las simulaciones como servicios reales o clínicamente validados.

---

## Arquitectura y Tecnologías

La aplicación está construida bajo una arquitectura modular desacoplada utilizando el patrón Repository, Zustand para la gestión de estado global y comunicación bidireccional en tiempo real mediante WebSockets.

### Frontend (App Móvil)
- **Framework Móvil actual**: React Native con Expo SDK 54
- **Objetivo de migración**: Expo SDK 57 en una fase aislada y verificable
- **Lenguaje**: TypeScript
- **Gestión de Estado**: Zustand
- **Navegación**: React Navigation (Native Stack & Bottom Tabs)
- **Componentes UI y Animaciones**:
  - React Native Reanimated
  - Gorhom Bottom Sheet
  - Expo Vector Icons
- **Servicios de Mapas**: React Native Maps (Google Maps Provider & Web iframe Fallback)
- **Comunicación en Tiempo Real**: Socket.io Client (eventos bidireccionales con autenticación JWT)

### Backend (API REST + WebSockets)
- **Runtime**: Node.js con Express
- **Base de datos objetivo**: PostgreSQL en tercera forma normal con PostGIS
- **Acceso a datos objetivo**: Prisma y SQL versionado para capacidades avanzadas
- **Base heredada temporal**: MongoDB Atlas, conservada solo mientras se migra
- **Autenticación v1**: access token corto, refresh token opaco y rotativo, sesiones PostgreSQL y scrypt; bcrypt se admite solo para rehash de datos heredados
- **Tiempo Real**: Socket.io Server (señalización de llamadas, bidding, chat, geolocalización)
- **Inteligencia Artificial**: Google Gemini API (`gemini-1.5-flash`) procesada de forma segura desde el servidor

---

## Estructura del Proyecto

```text
Ruta Emocional/
├── frontend/                # Aplicación React Native/Expo
├── backend/                 # API REST, Socket.IO y migración PostgreSQL
│   ├── prisma/
│   │   ├── schema.prisma    # Modelo relacional canónico
│   │   └── migrations/      # Migraciones SQL inmutables
│   ├── tests/               # Pruebas unitarias e integración PostgreSQL
│   └── src/                 # Monolito modular TypeScript
├── docs/
│   ├── product/             # Alcance y puertas del MVP
│   ├── domain/              # Reglas y máquinas de estado
│   ├── security/            # Autorización, privacidad y amenazas
│   ├── api/                 # Contratos HTTP/WebSocket y OpenAPI
│   ├── operations/          # Rendimiento y confiabilidad
│   ├── roadmap/             # Ejecución incremental
│   ├── architecture/        # ADR y decisiones técnicas
│   └── database/            # Evidencia y reglas de normalización
├── compose.yaml             # PostgreSQL/PostGIS local
└── package.json             # Scripts de coordinación del monorepo
```

---

## Requisitos Previos

Asegúrese de contar con los siguientes entornos en su sistema antes de continuar:

- **Node.js**: v22.13.0 o superior, requerido por el objetivo Expo SDK 57
- **npm**: compatible con la versión instalada de Node.js
- **PostgreSQL/PostGIS**: disponible localmente o mediante Docker
- **Expo CLI**: Incluido en la ejecución mediante `npx`
- **Dispositivo Físico o Emulador**:
  - Expo Go (Android / iOS)
  - Android Studio (Emulador Android) o Xcode (Simulador iOS para macOS)

---

## Instalación y Configuración

1. **Clonar el repositorio:**

   ```bash
   git clone https://github.com/tu-usuario/ruta-emocional.git
   cd "ruta-emocional"
   ```

2. **Instalar dependencias:**

   ```bash
   npm --prefix frontend ci
   npm --prefix backend ci
   ```

3. **Preparar PostgreSQL:**

   ```bash
   docker compose up -d postgres
   npm run db:migrate:deploy
   ```

---

## Variables de Entorno

Cree `.env` a partir de `.env.example` en la raíz y en `backend/`. Los
archivos reales no deben confirmarse en Git.

```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/ruta_emocional?schema=public
JWT_ACCESS_SECRET=<secreto-aleatorio>
PASSWORD_PEPPER=<otro-secreto-aleatorio>
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_DAYS=30
GEMINI_API_KEY=<api-key>
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

---

## Ejecución

Para iniciar cada aplicación desde la raíz:

```bash
npm run start:backend
npm run start:frontend
```

Para comprobar el modelo PostgreSQL:

```bash
npm run db:validate
```

Para verificar el primer flujo de identidad:

```bash
npm --prefix backend test
TEST_DATABASE_URL=<url-postgresql-de-pruebas> npm --prefix backend run test:integration
```

La documentación normativa comienza en [`docs/README.md`](docs/README.md). La arquitectura base está en [`ADR-001`](docs/architecture/ADR-001-postgresql-clean-architecture.md) y la evidencia de normalización en [`normalization-3nf.md`](docs/database/normalization-3nf.md).

---

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulte el archivo [LICENSE](LICENSE) para obtener más información.
