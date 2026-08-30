# Arquitectura de seguridad y privacidad

## 1. Objetivos

Ruta Emocional protege cuatro propiedades:

1. **Confidencialidad**: solo actores autorizados acceden a datos personales, conversaciones y datos clínicos.
2. **Integridad**: estados, precios, citas, pagos y notas no pueden ser manipulados por el cliente ni por carreras concurrentes.
3. **Disponibilidad**: la aplicación falla de forma controlada y puede recuperarse desde backups probados.
4. **Trazabilidad**: las operaciones sensibles pueden atribuirse a un actor, propósito, instante y resultado.

El diseño toma como referencia el OWASP API Security Top 10, las guías de almacenamiento de contraseñas y seguridad REST de OWASP, y las capacidades de almacenamiento seguro documentadas por Expo. Estas referencias no constituyen por sí solas certificación o cumplimiento legal.

## 2. Clasificación de datos

| Clase | Ejemplos | Regla mínima |
|---|---|---|
| Pública | nombre profesional publicado, especialidades, tarifas, modalidades | DTO público explícito; no exponer campos internos |
| Interna | métricas operativas, identificadores de correlación, configuración no secreta | Autenticación y mínimo privilegio |
| Personal | nombre, correo, teléfono, fotografía, dirección IP | Acceso por propósito, cifrado, retención definida |
| Sensible | ubicación precisa, conversaciones, descripción de necesidad, triaje | Acceso por relación, logs sin contenido, cifrado y auditoría |
| Clínica crítica | notas, diagnósticos, planes, consentimientos, expediente | Separación funcional, auditoría de lectura/escritura, exportación controlada |
| Secreto | contraseñas, tokens, claves, credenciales de proveedores | Nunca en texto plano, repositorio, logs o analítica |

La clasificación acompaña a los datos en DTO, logs, backups, exportaciones, colas y proveedores. Una copia no pierde sensibilidad por cambiar de sistema.

## 3. Límites de confianza

```text
Dispositivo no confiable
       │ TLS
       ▼
API / WebSocket ──► casos de uso ──► PostgreSQL
       │                  │               │
       │                  ├──► outbox ────┤
       │                  └──► auditoría  │
       ├──► proveedor de IA
       ├──► proveedor de pagos
       ├──► proveedor RTC
       └──► notificaciones/archivos
```

- La aplicación móvil puede ser modificada, instrumentada o ejecutada en un dispositivo comprometido.
- Todo valor recibido por HTTP o WebSocket es no confiable.
- Los proveedores externos forman límites separados y reciben el mínimo dato necesario.
- El personal interno no obtiene acceso implícito por administrar infraestructura.

## 4. Identidad y sesiones

### Contraseñas

- Preferencia: Argon2id con parámetros calibrados y al menos el mínimo recomendado por OWASP.
- Alternativa aceptable cuando Argon2id no esté disponible en el runtime: scrypt con parámetros documentados y calibrados.
- bcrypt solo se conserva para verificar hashes heredados durante la migración; un inicio de sesión válido actualiza el hash.
- Longitud mínima inicial: 12 caracteres; permitir passphrases y gestores de contraseñas.
- Longitud máxima razonable para prevenir abuso, sin truncamiento silencioso.
- No imponer reglas arbitrarias de símbolos; bloquear contraseñas comprometidas cuando exista un servicio adecuado y privado.
- Nunca registrar contraseñas, incluso en errores de validación.

### Access token

- Duración objetivo: 10–15 minutos.
- Algoritmo permitido fijado en configuración; nunca elegido por el encabezado sin lista cerrada.
- Validar firma, `iss`, `aud`, `exp`, `nbf`, `sub` y `sid`.
- Contener roles, no información clínica ni PII innecesaria.
- Para operaciones de riesgo se comprueba además cuenta/sesión actual en la base.

En el monolito inicial puede usarse HMAC con secreto aleatorio de alta entropía. Antes de que existan múltiples verificadores independientes se debe migrar a claves asimétricas con rotación y `kid`.

### Refresh token

- Token opaco generado con CSPRNG, no JWT de larga duración.
- Formato lógico `sessionId.secret`, donde el secreto se almacena solo como SHA-256 o HMAC.
- Rotación en cada uso mediante transacción.
- Si un token anterior no coincide con el hash activo, se considera posible reutilización y se revoca la sesión.
- Duración absoluta configurable, inicialmente 30 días.
- Cierre de sesión revoca; no depende de eliminar solamente el token del dispositivo.

### Cliente móvil y web

- En Android/iOS, los tokens pequeños se guardan con `expo-secure-store`, no con AsyncStorage ni almacenamiento propio en memoria/localStorage.
- El access token puede mantenerse en memoria y reconstruirse mediante refresh cuando sea viable.
- En web, la estrategia preferida es refresh token en cookie `HttpOnly`, `Secure`, `SameSite` y protección CSRF; no se asume equivalencia con SecureStore.
- El perfil persistido del cliente es una caché no autoritativa y se revalida con `/auth/me`.
- Cerrar sesión elimina almacenamiento local y revoca la sesión del servidor.

## 5. Autorización

- Cada endpoint y evento ejecuta una política de autorización.
- La política combina rol, propiedad, relación, estado, propósito y, cuando aplica, consentimiento.
- Los identificadores de usuario enviados por el cliente se ignoran cuando representan al actor.
- Las consultas sensibles incluyen el filtro de autorización en el repositorio; no cargan todos los datos para filtrarlos en memoria.
- Los DTO evitan exposición excesiva y mass assignment.
- Las rutas administrativas y clínicas usan permisos diferentes.
- Una autorización negativa no se compensa con lógica de UI.

La matriz normativa se encuentra en [authorization-matrix.md](authorization-matrix.md).

## 6. API HTTP

- Solo HTTPS en entornos compartidos y producción.
- API versionada bajo `/api/v1`.
- CORS con allowlist exacta; nunca `*` junto a credenciales.
- Límite global de body y límites menores por endpoint.
- Validación estructural, semántica y de longitud antes del caso de uso.
- `Content-Type` permitido de forma explícita.
- Security headers mediante middleware mantenido.
- Rate limits diferenciados para login, registro, MENTA, búsqueda y mutaciones.
- Timeouts y cancelación en dependencias externas.
- Errores con código estable y `requestId`; sin stack, SQL ni mensajes del proveedor.
- Paginación por cursor en colecciones crecientes.
- `Idempotency-Key` para aceptación, citas, pagos y envíos reintentables.

## 7. WebSockets

- El handshake requiere access token válido; conexiones anónimas son rechazadas.
- La sesión se revalida al conectar y en eventos sensibles o de larga duración.
- Las salas se derivan de conversaciones/citas persistidas.
- `join_room` no acepta una sala arbitraria sin comprobar participación.
- El cliente envía comandos, no hechos de dominio. Por ejemplo, no emite `offer_accepted`; llama la API y recibe el evento confirmado.
- Cada evento tiene esquema, tamaño máximo, rate limit y ACK con error tipado.
- Los mensajes se persisten primero y se publican desde el servidor.
- La ubicación se transmite solo en una cita presencial activa, con consentimiento y TTL.
- La desconexión o pérdida de eventos se reconcilia mediante cursor HTTP.

## 8. PostgreSQL

### Roles de base de datos

- `ruta_emocional_owner`: dueño de objetos; no usado por la aplicación.
- `ruta_emocional_migrator`: aplica migraciones en despliegue controlado.
- `ruta_emocional_app`: operaciones mínimas necesarias para el runtime.
- `ruta_emocional_readonly`: soporte/analítica sobre vistas desidentificadas, si se aprueba.

El backend no usa el superusuario `postgres`.

### Controles

- Conexiones TLS cuando la base no esté en el mismo límite privado.
- Pool limitado y timeouts de statement/transacción.
- Restricciones, claves foráneas, índices únicos y exclusión como defensa de integridad.
- Transacciones breves para operaciones multiagregado.
- Migraciones hacia adelante; cambios destructivos requieren expandir–migrar–contraer.
- Backups cifrados, con acceso separado y restauración probada.
- Auditoría y outbox sin permisos ordinarios de actualización/eliminación para el rol de aplicación cuando sea operacionalmente viable.

RLS puede incorporarse como defensa adicional para tablas clínicas después de establecer variables de sesión seguras y pruebas con el pool. No sustituye las políticas de aplicación y no se habilitará de forma parcial o improvisada.

## 9. Cifrado y llaves

- Cifrado en tránsito con TLS moderno.
- Cifrado de discos, snapshots y backups en el proveedor de infraestructura.
- Para campos clínicos que requieran aislamiento adicional, cifrado de aplicación con envelope encryption y llaves en KMS/HSM; no se guardan llaves junto a ciphertext.
- Rotación de secretos y llaves con versión.
- Los hashes de búsqueda o blind indexes se evalúan solo si se necesita consultar campos cifrados.
- No construir criptografía propia.

El cifrado de campos es una puerta de arquitectura previa a producción clínica porque afecta búsqueda, backup, soporte y rotación.

## 10. Archivos

- Object storage privado fuera de la base.
- Nombre de objeto aleatorio; el nombre original es metadato sanitizado.
- Allowlist de MIME y validación por contenido.
- Límite de tamaño por categoría.
- Carga mediante URL firmada de corta duración.
- Estado de cuarentena hasta análisis de malware.
- Descarga mediante autorización y URL temporal.
- Documentos profesionales y clínicos en prefijos/buckets separados.
- Borrado sujeto a retención y auditoría.

## 11. MENTA e integraciones de IA

- Mostrar aviso claro de que MENTA es IA.
- Ejecutar reglas de crisis antes del modelo externo.
- El comando actual no admite texto libre: solo códigos de preguntas y opciones
  pertenecientes al catálogo activo.
- Si una fase futura admite texto, se tratará como dato no confiable separado de
  instrucciones y deberá superar pruebas de inyección.
- No incluir PII ni contexto completo por comodidad.
- Fijar proveedor/modelo mediante configuración y contrato de tratamiento de datos.
- Deshabilitar entrenamiento/retención del proveedor cuando la oferta lo permita y el contrato lo exija.
- Validar salida con esquema y reglas clínicas; no confiar en JSON solo porque parsea.
- Timeouts, circuit breaker y presupuesto de consumo.
- El fallback determinista usa un resumen aprobado de la necesidad; nunca
  inventa diagnóstico ni afirma haber contactado servicios de emergencia.
- Conservar versión de reglas/modelo y resultado estructurado mínimo para auditoría.
- Mantener la evaluación inmutable y registrar la revisión profesional como
  metadatos append-only.

## 12. Pagos e integraciones externas

- Validar TLS y dominio de destino.
- Credenciales con permisos mínimos y por entorno.
- Webhooks con firma, timestamp y protección de replay.
- Respuesta externa tratada como no confiable.
- Idempotencia y reconciliación diaria.
- Circuit breaker y cola de reintento para fallos transitorios.
- Nunca construir URLs arbitrarias desde entrada del usuario, para reducir SSRF.

## 13. Logging, métricas y auditoría

### Log operativo

Campos recomendados:

```text
timestamp, level, service, environment, requestId, traceId,
routeTemplate, method, statusCode, durationMs, actorIdHash, errorCode
```

Campos prohibidos:

```text
password, accessToken, refreshToken, Authorization, cookie,
texto de mensaje, descripción clínica, nota, diagnóstico libre,
ubicación precisa, payload completo, clave de proveedor
```

- El `actorId` puede registrarse como identificador interno o hash según el acceso al sistema de logs.
- Las excepciones se serializan mediante allowlist.
- El log de desarrollo no justifica exponer secretos.

### Auditoría

- Separada del log operativo.
- Registra accesos y cambios sensibles, incluido el resultado denegado.
- Conservación y acceso definidos por política.
- Escritura append-only y exportación protegida.
- Alertas para acceso masivo, acceso excepcional o patrón fuera de horario cuando exista suficiente madurez operacional.

## 14. Secretos y configuración

- Variables públicas de Expo (`EXPO_PUBLIC_*`) nunca contienen secretos; quedan incluidas en el bundle.
- Los secretos de backend se almacenan fuera del repositorio.
- No existen secretos fallback.
- El arranque falla si falta una variable obligatoria o tiene formato inseguro.
- Configuración por entorno: desarrollo, pruebas, staging y producción.
- Rotación documentada para DB, JWT, IA, pagos, almacenamiento y notificaciones.
- La contraseña de desarrollo compartida durante la preparación debe rotarse antes de continuar con credenciales persistentes.

## 15. Ciclo de desarrollo seguro

- Threat modeling actualizado por módulo.
- Revisión de dependencias y lockfile.
- Secret scanning y SAST en CI.
- Pruebas unitarias de política y transiciones.
- Pruebas de integración contra PostgreSQL real.
- Casos negativos de autorización y mass assignment.
- Pruebas DAST en staging.
- Revisión manual antes de habilitar clinical, MENTA, pagos o RTC.
- Imágenes/artefactos con versionado y procedencia.
- Rollback ensayado.

## 16. Respuesta a incidentes

El runbook debe cubrir:

1. detección y clasificación;
2. contención de sesiones, claves o integración afectada;
3. preservación de evidencia;
4. determinación de datos y personas afectadas;
5. recuperación y rotación;
6. notificación según jurisdicción y contrato;
7. retrospectiva y controles preventivos.

Debe ser posible revocar todas las sesiones, desactivar una integración por feature flag y rotar secretos sin desplegar código funcional nuevo.

## 17. Fuentes técnicas

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
