# Llamadas de audio y video

## Alcance de la primera entrega

Las llamadas son sesiones WebRTC entre dos miembros de una conversación activa
cuya solicitud aceptada usa la modalidad `CALL`. La app permite iniciar audio o
video, aceptar o rechazar una invitación, silenciar el micrófono y finalizar.
No se graban llamadas ni se incluyen agentes, salas grupales, PSTN o una
integración de emergencia.

El backend autoriza participantes, crea la sesión durable, audita las
transiciones y emite eventos mediante outbox. El cliente nunca recibe claves de
administración. Sólo recibe un token efímero, limitado a una sala y a publicar
las pistas permitidas para el tipo de llamada.

## Configuración privada

1. Crear un proyecto de medios en LiveKit Cloud o desplegar un servidor
   compatible con LiveKit.
2. Obtener del proyecto el endpoint seguro `wss://…`, API key y API secret.
3. Definirlos únicamente en el entorno privado del backend (`backend/.env` en
   desarrollo local o el gestor de secretos del entorno desplegado):

   ```dotenv
   CALL_PROVIDER=LIVEKIT
   LIVEKIT_URL=wss://<endpoint-del-proyecto>
   LIVEKIT_API_KEY=<api-key>
   LIVEKIT_API_SECRET=<api-secret>
   CALL_ACCESS_TOKEN_TTL_SECONDS=600
   CALL_RINGING_TIMEOUT_SECONDS=45
   CALL_MAXIMUM_DURATION_SECONDS=7200
   ```

   No poner estas credenciales en `frontend/.env`, `EXPO_PUBLIC_*`, EAS
   variables públicas, código fuente ni mensajes. El cliente sólo recibe el
   `serverUrl` y un access token breve firmado por el servidor.

4. Aplicar las migraciones del backend al ambiente elegido después de comprobar
   la URL de base de datos: `npm run db:migrate:deploy` desde la raíz. No usar
   datos clínicos reales para la primera validación.
5. Instalar las dependencias y generar una compilación Android nativa nueva.
   Las dependencias de WebRTC/LiveKit no están incluidas en Expo Go; el APK
   existente no puede incorporar estos módulos mediante una actualización JS.

Si `CALL_PROVIDER=DISABLED` (valor seguro por defecto), la app mantiene el resto
de funciones y devuelve un error genérico de servicio no disponible al intentar
llamar.

## Contrato HTTP

- `POST /api/v1/conversations/{conversationId}/calls` — inicia una llamada;
  cuerpo `{ "mediaType": "AUDIO" | "VIDEO" }`.
- `GET /api/v1/calls/{callId}` — consulta el estado para un participante.
- `POST /api/v1/calls/{callId}/join` — acepta y obtiene credenciales de sala.
- `POST /api/v1/calls/{callId}/decline` — rechaza una llamada entrante.
- `POST /api/v1/calls/{callId}/end` — finaliza una sesión.

Todas las operaciones exigen autenticación. El repositorio verifica que el
usuario siga siendo miembro activo de la conversación y que la relación de
atención esté activa. El token nunca incluye permisos de grabación ni
administración de sala. Los eventos de push no incluyen texto clínico; en
foreground el estado se sincroniza por Socket.IO.

## Límites que deben probarse en QA

- Probar dos dispositivos Android reales: audio, vídeo, rechazar, cancelar,
  pérdida de red y reconexión.
- Verificar invitación con app abierta y con app en segundo plano/cerrada. En
  segundo plano se entrega una notificación para abrir la app; esta entrega no
  equivale todavía a una experiencia de llamada de sistema con pantalla
  completa/CallKit.
- Denegar micrófono/cámara y comprobar que la interfaz ofrece recuperación sin
  exponer stack traces ni secretos.
- Validar el límite de cuota/costo del proveedor antes de una prueba extendida.
  Los planes gratuitos de LiveKit Cloud operan con cuotas tope; una cuota
  agotada puede impedir iniciar nuevas sesiones.

