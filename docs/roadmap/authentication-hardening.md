# Consolidación de acceso y recuperación de cuenta

**Estado:** implementada y validada localmente  
**Corte:** RV-7D ampliado  
**Alcance:** Expo SDK 57, API HTTP y PostgreSQL

## 1. Objetivo

Convertir el acceso existente en una experiencia de autenticación clara,
minimalista y coherente con la identidad de Ruta Emocional, sin debilitar las
reglas de identidad ya implementadas. El corte agrega recuperación segura de
contraseña, acceso federado con Google y el proceso real de verificación
profesional.

## 2. Decisiones de experiencia

- La firma horizontal negativa identifica las pantallas públicas sobre el azul
  institucional `#253A82`.
- El encabezado ocupa sólo el espacio necesario para marca y contexto; el
  formulario se presenta directamente sobre el fondo del producto, sin una
  tarjeta decorativa sobredimensionada.
- Login, registro, recuperación e información legal comparten un único
  contenedor responsive.
- Los campos exponen estados neutral, foco, válido, error y deshabilitado, con
  mensajes que explican cómo corregir la entrada.
- Todos los controles principales conservan un objetivo táctil mínimo de 44
  puntos y semántica accesible.
- Paciente y psicólogo son opciones de radio con propósito explícito. Elegir
  psicólogo revela el registro MINSA y anticipa la revisión profesional.
- Los estados de carga bloquean el doble envío y mantienen el ancho de la acción.
- El acceso con Google usa el identificador multicolor oficial sobre una
  superficie neutra, con una etiqueta directa y sin alterar la jerarquía del
  formulario principal.
- Los errores se traducen a lenguaje útil. Ninguna respuesta visible presenta
  códigos HTTP, nombres de host ni mensajes internos.
- Privacidad, términos y ayuda están disponibles desde todo el flujo público.
  El contenido local se identifica como información del MVP pendiente de
  aprobación legal; no se presenta como política jurídica definitiva.

## 3. Arquitectura de frontend

La navegación pública se separó de la navegación autenticada. `App.tsx`
rehidrata la sesión una sola vez y selecciona el árbol correspondiente. Esto
evita mezclar pantallas públicas con rutas que requieren capacidades del
usuario.

Los componentes `AuthShell`, `AuthField`, `AuthLegalLinks` y
`PasswordStrength` centralizan estructura, estados, espaciado y accesibilidad.
Las rutas públicas aceptan enlaces profundos mediante el esquema
`rutaemocional://`, incluida la recepción del token de recuperación.

## 4. Recuperación segura

El flujo implementa dos comandos HTTP:

- `POST /api/v1/auth/password-reset/request`;
- `POST /api/v1/auth/password-reset/complete`.

La solicitud responde de forma genérica exista o no la cuenta. El token se
genera con entropía criptográfica, sólo se conserva su hash SHA-256, expira y
puede consumirse una única vez. Solicitar un token nuevo revoca los anteriores.
Al completar el cambio se revocan todas las sesiones activas y los demás tokens
de recuperación del usuario.

Los intentos se limitan por dirección IP y correo normalizado. La creación,
revocación y finalización dejan eventos de auditoría. Los valores de token y
contraseña no se registran ni se devuelven fuera del modo de QA local
explícitamente habilitado.

## 5. Persistencia y 3FN

`PasswordResetToken` posee identidad propia y referencia a un único usuario. El
modelo conserva exclusivamente los atributos que dependen de ese token:
hash, expiración, consumo, revocación, origen y fecha de solicitud. No duplica
correo, nombre, roles ni datos de perfil, por lo que mantiene la tercera forma
normal del esquema.

La migración `20260903001000_secure_password_recovery` añade la tabla,
restricciones temporales, clave foránea e índices de ciclo de vida. El rol de
runtime recibe sólo `SELECT`, `INSERT` y `UPDATE`; `DELETE` permanece denegado.

`ExternalIdentity` conserva el proveedor y el identificador estable emitido por
Google sin duplicar correo, nombre, roles o perfiles. Las restricciones únicas
impiden que una identidad externa pertenezca a dos cuentas o que una cuenta
registre dos identidades del mismo proveedor. El sistema nunca vincula por
coincidencia de correo una cuenta que ya utiliza contraseña.

## 6. Acceso federado con Google

- Web utiliza Google Identity Services y obtiene únicamente un ID token.
- Android utiliza el SDK nativo desde una compilación de desarrollo; Expo Go no
  expone el módulo nativo y muestra una explicación comprensible.
- El Client ID público se configura por entorno. Ningún secreto OAuth se
  incorpora al paquete móvil o web.
- El backend valida firma, emisor, audiencia, expiración y correo verificado con
  las claves públicas de Google antes de crear una sesión propia revocable.
- Una cuenta nueva debe elegir explícitamente paciente o psicólogo. La cuenta
  profesional continúa pendiente hasta completar la verificación real.
- La migración `20260919002000_google_federated_identity` permite cuentas sin
  contraseña local y añade identidades externas normalizadas y auditables.

## 7. Entrega por entorno

- Desarrollo controlado: puede exponer el token únicamente cuando
  `ENABLE_LOCAL_QA` y `LOCAL_QA_EXPOSE_PASSWORD_RESET_TOKEN` están activos.
- Producción: exige proveedor Resend, remitente, clave y URL de recuperación.
  La comprobación de preparación productiva falla si falta cualquiera de ellos.
- El frontend nunca recibe credenciales del proveedor. El envío se ejecuta
  exclusivamente desde infraestructura backend con tiempo máximo configurable.

## 8. Verificación ejecutada

- 57 suites y 148 pruebas de frontend aprobadas sin advertencias de React.
- 65 pruebas unitarias de backend aprobadas.
- Nueve suites de integración HTTP aprobadas contra PostgreSQL, sin regresiones
  en directorio, solicitudes, mensajería, agenda, clínica, triaje ni MENTA.
- Flujo HTTP de autenticación aprobado contra PostgreSQL: registro, consulta de
  sesión, rotación, detección de reutilización, logout, recuperación, cambio de
  contraseña, invalidación del secreto anterior, consumo único y alta de
  psicólogo pendiente de verificación.
- TypeScript de frontend y backend sin errores.
- Esquema Prisma válido y 27 migraciones aplicadas.
- Validadores de identidad visual y configuración nativa aprobados.
- Exportación de Expo Web aprobada con 5.037 módulos y todos los recursos de
  marca incluidos.
- Liveness y readiness aprobados con PostgreSQL, outbox y solicitudes de
  privacidad disponibles.
- Revisión visual aprobada en escritorio y viewport móvil de 360/390 px.
- Semántica de labels, alertas, radios, links y estado válido comprobada en el
  árbol de accesibilidad web.

## 9. Gates productivos abiertos

1. Configurar y verificar dominio/remitente del proveedor de correo.
2. Definir la URL HTTPS universal/app link definitiva para recuperación.
3. Aprobar y versionar la política legal de privacidad y los términos.
4. Ejecutar el recorrido con TalkBack, fuente máxima y teclado abierto en un
   dispositivo Android físico.
5. Incorporar pruebas automatizadas de entrega de correo en un entorno de
   staging sin exponer tokens.
6. Validar Google nativo en una compilación de desarrollo firmada; Expo Go no
   puede cargar el módulo de autenticación nativo.

Estos gates impiden declarar el flujo listo para producción, pero no bloquean
la demostración local controlada ni el cumplimiento funcional del Hackathon.
