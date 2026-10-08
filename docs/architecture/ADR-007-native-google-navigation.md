# ADR-007 — Navegación nativa con Google Navigation SDK

## Estado

**Aceptado e implementado el 3 de octubre de 2026.**

Sustituye la decisión cartográfica de la Fase 8.2 para Android. El fallback web
y la salida voluntaria hacia Waze continúan vigentes.

## Contexto

El radar presencial utilizaba teselas públicas de OpenStreetMap desde un
cliente móvil. Ese consumo fue bloqueado con respuestas 403 por incumplir la
política operativa del servidor comunitario. Además, una imagen cartográfica no
resuelve cálculo de rutas, tráfico, desvíos ni guía giro a giro dentro de la
aplicación.

Delegar toda la experiencia a una aplicación externa evitaba mantener un motor
de navegación, pero interrumpía el flujo y no permitía conservar una interfaz
coherente con Ruta Emocional.

## Decisión

- Android integra `@googlemaps/react-native-navigation-sdk` 0.16.3 y usa su
  dependencia compatible de Google Navigation SDK 7.6.1. La actualización a
  una versión posterior requiere una actualización coordinada de React Native
  y Expo, seguida de QA nativo completo.
- Navigation SDK sustituye al Maps SDK nativo y es la única fuente del mapa
  Android, el tráfico y la guía giro a giro.
- La navegación interna se ofrece después de aceptar una propuesta presencial
  con destino válido. No cambia estados de solicitud, oferta, relación o cita.
- La ruta usa conducción, estrategia de mejor ruta y una alternativa. El SDK
  administra tráfico, desvíos y actualización de la guía.
- Waze permanece como alternativa explícita si la sesión nativa, la red, el GPS
  o la cuota no están disponibles.
- Web conserva un mapa embebido de OpenStreetMap y delega la navegación a un
  proveedor externo; no intenta emular guía giro a giro.
- Las condiciones de Google se presentan antes de inicializar la sesión. Perfil
  expone un acceso independiente a las atribuciones y licencias oficiales.

## Seguridad y costos

`GOOGLE_NAVIGATION_API_KEY` se inyecta durante el build nativo y no se conserva
en archivos rastreados por Git. La clave de Android debe restringirse por
paquete, huella SHA-1 y API. Producción debe usar una credencial distinta de QA,
cuota diaria, presupuesto y alertas de facturación.

Las coordenadas del consultorio solo se entregan después de una relación y una
propuesta presencial aceptadas. La clave cartográfica no otorga acceso al
backend, PostgreSQL ni datos clínicos.

## Compatibilidad

- Android mínimo: API 24.
- Android objetivo: API 36.
- Nueva arquitectura de React Native habilitada.
- Android Gradle Plugin 8.13.2.
- Kotlin Gradle Plugin 2.3.0.
- Desugaring `desugar_jdk_libs_nio` 2.1.5.
- Expo Go no es compatible; se requiere una compilación nativa nueva.
- El diagnóstico de Expo excluye expresamente el falso positivo del directorio
  de React Native para Navigation SDK y el plugin Expo de LiveKit. Ambos se
  validan contra sus paquetes oficiales, el config plugin y la compilación
  nativa, no se ignoran las comprobaciones de versiones de Expo.

## Consecuencias

- La experiencia presencial obtiene mapa interactivo, tráfico, progreso,
  instrucciones, voz, vibración, Bluetooth, recálculo y llegada dentro de Ruta
  Emocional.
- Cada cálculo de destino puede generar consumo facturable. La guía y los
  desvíos posteriores se rigen por la política comercial vigente de Google.
- La aplicación depende de Google Play Services, ubicación y conectividad.
- La versión React Native del SDK permanece en beta; cada actualización exige
  repetir build nativo, revisión de notas de versión y QA de dispositivo.
- La validación automatizada no sustituye la prueba de conducción o simulación
  en un Android físico con la clave y firma exactas del artefacto.

## Evidencia exigida

- configuración nativa reproducible mediante config plugin;
- clave ausente del control de versiones;
- compilación ARM64 firmada y verificada;
- bundle Android con atribuciones y licencias;
- ruta presencial con salida, recálculo, llegada, rechazo de permisos y fallback;
- prueba en Android físico con tráfico controlado y sin interacción manual del
  conductor durante el movimiento.
