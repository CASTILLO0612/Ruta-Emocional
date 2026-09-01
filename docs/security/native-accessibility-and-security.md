# Gate nativo de accesibilidad y seguridad

## Controles automatizados incorporados

- Expo `~57.0.18` y `expo-font ~57.0.2`, compatibles según `expo install --check`;
- tokens de sesión persistente sólo en `expo-secure-store` para iOS/Android;
- `WHEN_UNLOCKED_THIS_DEVICE_ONLY` y exclusión de backup Android administrada
  por el plugin;
- API obligatoriamente HTTPS fuera de desarrollo;
- clave de Google Maps inyectada al build como `GOOGLE_MAPS_API_KEY`, nunca como
  variable JS `EXPO_PUBLIC_*`;
- perfiles EAS separados para development, preview y production;
- botones comunes con rol, etiqueta y estados disabled/busy;
- MENTA con radiogroups, radios, checkbox, alertas, live regions, enlaces y
  confirmaciones accesibles;
- validación CI que rechaza placeholders, versiones incompatibles, secretos
  públicos prohibidos y emojis en el código de interfaz.

## Matriz manual obligatoria antes del release

| Prueba | Android | iOS | Evidencia |
|---|---:|---:|---|
| TalkBack/VoiceOver, orden y nombres | pendiente | pendiente | grabación + checklist |
| tamaño de fuente máximo | pendiente | pendiente | capturas sin recorte |
| contraste normal/error/disabled | pendiente | pendiente | reporte de contraste |
| teclado y foco en formularios | pendiente | pendiente | casos ejecutados |
| rotación/bloqueo/background | pendiente | pendiente | sesión no expuesta |
| almacenamiento seguro tras reinicio | pendiente | pendiente | prueba dispositivo |
| tráfico HTTPS y rechazo HTTP | pendiente | pendiente | proxy de prueba |
| deeplinks/URLs de recursos | pendiente | pendiente | esquema/host permitidos |
| build release sin menú dev | pendiente | pendiente | artefacto EAS firmado |
| SAST/DAST y dependencias | pendiente | pendiente | reporte release |

Las filas no pueden marcarse correctas con una revisión web. Se requiere al
menos un dispositivo o emulador por plataforma y el artefacto release que se
presentará.
