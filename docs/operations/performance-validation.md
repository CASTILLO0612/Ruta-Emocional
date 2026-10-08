# Validación reproducible de rendimiento

## Objetivo

El rendimiento se acepta con mediciones y umbrales, no por incorporar cachés o
infraestructura sin evidencia. El repositorio incluye una prueba de carga HTTP
de solo lectura, sin dependencias externas ni envío de datos clínicos.

## Ejecución

El backend debe estar activo y el destino debe ser un endpoint `GET` bajo
`/api/v1/`. La prueba no debe apuntarse a producción sin una ventana y una
autorización operativa explícitas.

```powershell
$env:LOAD_BASE_URL = 'http://127.0.0.1:5000'
$env:LOAD_ROUTE = '/api/v1/health/ready'
$env:LOAD_REQUESTS = '200'
$env:LOAD_CONCURRENCY = '20'
$env:LOAD_MAXIMUM_P95_MS = '1000'
npm run quality:load-smoke
```

Para una consulta autenticada de prueba puede definirse `LOAD_ACCESS_TOKEN`. El
script no imprime el token y únicamente emite método `GET`.

## Resultado

La salida incluye:

- distribución de códigos HTTP;
- errores y timeouts;
- latencias mínima, p50, p95, p99 y máxima;
- rendimiento aproximado por segundo;
- umbrales utilizados.

La ejecución falla cuando supera `LOAD_ALLOWED_FAILURES` o
`LOAD_MAXIMUM_P95_MS`. Los resultados deben conservarse con fecha, versión y
características del equipo cuando se usen como evidencia del Hackathon.

## Secuencia de medición

1. readiness sin autenticación;
2. directorio profesional con un dataset representativo;
3. agenda y espacios disponibles;
4. conversaciones paginadas;
5. bootstrap de MENTA.

Las mutaciones, WebSockets y streaming SSE se validan con sus pruebas de
integración específicas; este smoke test no crea cuentas, solicitudes, ofertas,
citas ni contenido clínico.

La ejecución local del 23 de septiembre de 2026 realizó 200 consultas de
readiness con concurrencia 20: cero fallos, p95 de 279.77 ms y 168.32 respuestas
por segundo. El resultado mide el equipo y la base locales; no sustituye una
prueba con el volumen y la topología de producción.

## Renderizado del mapa en Android

El mapa de Google se monta desde la coordenada inicial configurable, sin esperar
al GPS, para las búsquedas por chat, llamada y atención presencial. La ubicación
se solicita en paralelo, centra primero con la última posición conocida y se
refina con la posición actual; permisos/GPS no bloquean el primer frame. La
vista de navegación monta el mapa mientras calcula la ruta.

La verificación funcional está en `CustomMapView.test.tsx`, `RadarScreen.test.tsx`
y `PatientNavigationScreen.test.tsx`. Falta completar la medición de tiempo al
primer frame en dispositivos Android físicos de gama baja/media/alta, con
frío/caliente, red móvil/Wi-Fi y permisos concedidos/denegados. No se declara un
objetivo de latencia cumplido sin esos datos. Repetir el benchmark tras cada
cambio del SDK o de estilos.

## Streaming local de MENTA

El gate de Ollama comprueba que el modelo entregue más de un fragmento nativo,
mide el tiempo al primer fragmento y el tiempo total sin imprimir el contenido
generado. Utiliza un mensaje técnico fijo y no transmite información de usuario.

```powershell
$env:MENTA_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
$env:MENTA_OLLAMA_MODEL = '<modelo-local-instalado>'
$env:MENTA_STREAM_SMOKE_MAXIMUM_FIRST_DELTA_MS = '30000'
npm run quality:menta-stream
```

Por defecto sólo se permite un host local. La ejecución del 23 de septiembre de
2026 en el equipo de desarrollo produjo 17 fragmentos, mostró el primero en
8.96 segundos y finalizó en 11.15 segundos. Es una línea base local, no una
garantía de producción ni una comparación entre modelos.
