# Ruta Emocional

Ruta Emocional es una plataforma móvil orientada a conectar de manera directa y en tiempo real a pacientes que requieren atención psicológica con profesionales de la salud mental verificados. La solución integra un sistema de subasta inversa (bidding), geolocalización en tiempo real, triaje asistido por inteligencia artificial y canales de consulta multimodal (chat, llamada de voz, videollamada y consulta presencial).

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

## Características Principales

### Para Pacientes
- **Triaje Emocional con IA (MENTA)**: Asistente conversacional fundamentado en modelos de lenguaje (Google Gemini API) que analiza el estado emocional del usuario y sugiere modalidades de atención e intervalos presupuestarios recomendados.
- **Radar de Geolocalización en Tiempo Real**: Visualización interactiva de psicólogos disponibles cercanos sobre un mapa con marcadores personalizados.
- **Sistema de Subasta Inversa (Bidding)**: Envío de solicitudes definiendo modalidad, horario (inmediato o fecha de calendario) y propuesta económica inicial, recibiendo contraofertas en tiempo real.
- **Sala de Consulta Multimodal**: Espacio virtual seguro que permite alternar entre chat de texto, llamada de audio y videollamada con contador de duración e indicador de cifrado.
- **Seguimiento de Ruta Presencial**: Mapa satelital interactivo con tiempo estimado de llegada (ETA) para consultas a domicilio.
- **Perfil y Métodos de Pago**: Configuración de PIN de seguridad, administración de tarjetas de pago, historial terapéutico y soporte técnico.

### Para Psicólogos
- **Panel de Solicitudes (Dashboard)**: Monitoreo en tiempo real de peticiones entrantes de pacientes dentro del radio de atención.
- **Gestión de Tarifas**: Aceptación directa del presupuesto propuesto o emisión de contraofertas personalizadas.
- **Métricas de Rendimiento**: Resumen de ganancias acumuladas, conteo de sesiones realizadas y calificación promedio.

---

## Arquitectura y Tecnologías

La aplicación está construida bajo una arquitectura modular desacoplada utilizando el patrón Repository y Zustand para la gestión de estado global.

- **Framework Móvil**: React Native con Expo (v54)
- **Lenguaje**: TypeScript
- **Gestión de Estado**: Zustand
- **Navegación**: React Navigation (Native Stack & Bottom Tabs)
- **Componentes UI y Animaciones**:
  - React Native Reanimated
  - Gorhom Bottom Sheet
  - Expo Vector Icons
- **Servicios de Mapas**: React Native Maps (Google Maps Provider & Web iframe Fallback)
- **Backend y Base de Datos**: Firebase (Authentication, Firestore / Realtime Database)
- **Inteligencia Artificial**: Google Gemini API (`gemini-1.5-flash`)

---

## Estructura del Proyecto

```text
Ruta Emocional/
├── assets/                  # Recursos gráficos (íconos, splash screens)
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── common/          # Botones, alertas, mapas, calificaciones
│   │   ├── patient/         # Selectores de presupuesto, modalidad y tarjetas de oferta
│   │   └── psychologist/    # Tarjetas de solicitudes entrantes
│   ├── models/              # Interfaces y modelos de dominio (User, Offer, ActiveRequest, Psychologist)
│   ├── navigation/          # Configuración de rutas y navegadores
│   ├── repositories/        # Capa de acceso a datos y repositorios de Firebase
│   ├── screens/             # Pantallas divididas por flujo
│   │   ├── auth/            # Inicios de sesión y registro por rol
│   │   ├── patient/         # Inicio (Home) y Radar de búsqueda
│   │   ├── psychologist/    # Dashboard de solicitudes y recepción de ofertas
│   │   └── shared/          # MENTA AI, Consulta, Historial, Mensajería y Perfil
│   ├── scripts/             # Scripts utilitarios y sembrado de datos de prueba
│   ├── services/            # Clientes de servicios externos (AuthService, GeminiService)
│   ├── store/               # Tiendas de estado global (Zustand)
│   ├── theme/               # Sistema de diseño (colores, tipografía, espaciados)
│   └── utils/               # Funciones auxiliares y formateadores
├── App.tsx                  # Punto de entrada de React Native
├── app.json                 # Configuración de Expo
├── babel.config.js          # Configuración de Babel
├── firebase.config.ts       # Inicialización de servicios Firebase
├── index.ts                 # Registro del componente principal
└── package.json             # Manifest de dependencias y scripts
```

---

## Requisitos Previos

Asegúrese de contar con los siguientes entornos en su sistema antes de continuar:

- **Node.js**: v18.0.0 o superior
- **npm**: v9.0.0 o superior
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
   npm install
   ```

---

## Variables de Entorno

Cree un archivo `.env` en la raíz del proyecto basado en el siguiente esquema:

```env
# Configuración de Firebase
FIREBASE_API_KEY=tu_firebase_api_key
FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
FIREBASE_PROJECT_ID=tu_proyecto_id
FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
FIREBASE_APP_ID=tu_app_id

# Configuración de Google Gemini API
GEMINI_API_KEY=tu_gemini_api_key

# Configuración de Google Maps (Android / iOS)
GOOGLE_MAPS_API_KEY=tu_google_maps_api_key
```

---

## Ejecución

Para iniciar el servidor de desarrollo de Expo:

```bash
npm start
```

### Opciones de ejecución:

- **Android**: Ejecute `npm run android` o presione `a` en la consola de Expo.
- **iOS**: Ejecute `npm run ios` o presione `i` en la consola de Expo (requiere macOS).
- **Web**: Ejecute `npm run web` o presione `w` en la consola de Expo.

---

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulte el archivo [LICENSE](LICENSE) para obtener más información.
