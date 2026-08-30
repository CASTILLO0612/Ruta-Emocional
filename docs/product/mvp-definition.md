# Definición del MVP

## 1. Propósito

Ruta Emocional conecta pacientes con profesionales de psicología verificados, permite solicitar atención inmediata o programada y conserva la continuidad operativa y clínica de la relación. El producto facilita el acceso; no reemplaza el juicio clínico ni un servicio de emergencia.

## 2. Mercado inicial asumido

El código actual utiliza córdobas, referencias a MINSA y ubicaciones de Nicaragua. Por ello, el diseño asume **Nicaragua como mercado inicial**, sujeto a validación jurídica, clínica y operativa antes de usar datos de personas reales.

La jurisdicción final es una puerta de salida. Deben confirmarse al menos:

- requisitos de consentimiento y mayoría de edad;
- tratamiento de datos de salud y transferencias internacionales;
- validez, autoridad y proceso de verificación de licencias;
- conservación y entrega de expedientes clínicos;
- números y recursos de emergencia vigentes;
- requisitos fiscales y del proveedor de pagos.

Hasta completar esa validación, el entorno se considera demostrativo y no clínico.

## 3. Usuarios y actores

### Paciente

Persona que busca orientación o atención psicológica. Administra sus datos de cuenta, solicita atención, recibe ofertas, agenda citas, participa en conversaciones, administra consentimientos y consulta la información que legalmente le corresponda.

### Psicólogo pendiente

Usuario que solicitó actuar como profesional pero cuya identidad y licencia aún no fueron verificadas. Solo puede completar su expediente profesional y consultar el estado de verificación. No puede aparecer en búsquedas, enviar ofertas, atender sesiones ni acceder a datos de pacientes.

### Psicólogo verificado

Profesional habilitado por el proceso administrativo de Ruta Emocional. Puede configurar modalidades, precios y disponibilidad; atender solicitudes; administrar citas; comunicarse con pacientes vinculados y registrar información clínica dentro del alcance autorizado.

### Administrador

Opera cuentas, catálogos, verificación profesional, incidencias y configuración. No tiene acceso ordinario al contenido de notas clínicas o conversaciones.

### Auditor clínico

Rol excepcional y separado. Accede únicamente cuando existe una finalidad autorizada, un motivo documentado y un registro de auditoría. No modifica el expediente clínico.

### Servicios de sistema

Procesos automáticos que envían notificaciones, expiran solicitudes, ejecutan trabajos programados, entregan eventos o integran proveedores. Cada servicio debe tener identidad y permisos mínimos.

## 4. Propuesta de alcance

### 4.1 MVP obligatorio

#### Identidad y acceso

- Registro e inicio de sesión de pacientes.
- Solicitud de registro de psicólogos.
- Verificación administrativa de licencia e identidad profesional.
- Sesiones revocables con access token corto y refresh token rotativo.
- Cierre de una sesión y cierre de todas las sesiones.
- Perfil propio y cambio controlado de datos.
- Roles y autorización por propiedad y relación.

#### Directorio profesional

- Mostrar únicamente psicólogos verificados y habilitados.
- Filtros por modalidad, especialidad, precio y disponibilidad.
- Geolocalización opcional con precisión y retención mínimas.
- Tarifas por modalidad configuradas por el psicólogo.

#### Solicitud y oferta

- Solicitud inmediata o programada.
- Una solicitud abierta por paciente como valor predeterminado.
- Ofertas de psicólogos elegibles.
- Una oferta por psicólogo y solicitud.
- Aceptación transaccional de una sola oferta.
- Creación de la relación de atención al aceptar.
- Cancelación y expiración con motivos definidos.

#### Agenda

- Disponibilidad semanal y excepciones.
- Citas con zona horaria IANA.
- Confirmación, cancelación y reprogramación controladas.
- Prevención de solapamientos en la base de datos.
- Recordatorios mediante un adaptador de notificaciones.

#### Comunicación

- Una conversación longitudinal por relación de atención, creada al aceptar la oferta.
- Participantes autorizados por el servidor.
- Mensajes de texto con paginación y deduplicación.
- Entrega en tiempo real mediante eventos emitidos por el servidor.
- Bloqueo de acceso al finalizar o suspender la relación, según política de conservación.

#### Historia clínica mínima

- Expediente único por paciente.
- Encuentro clínico vinculado a cita cuando exista.
- Nota en borrador, firma y enmienda versionada.
- Diagnósticos y plan de tratamiento como datos estructurados.
- Consentimientos versionados.
- Auditoría de lectura y escritura de información clínica.

#### MENTA

- Orientación general y derivación a profesionales.
- Clasificación determinista de señales de crisis antes de cualquier modelo externo.
- Respuesta de crisis segura, configurable por país y revisada por personal clínico.
- Consentimiento y transparencia sobre el uso de IA.
- Minimización o desidentificación antes de integrar un proveedor externo.
- Registro separado del expediente clínico, salvo incorporación explícita por un profesional y con fundamento válido.

#### Operación

- Backups y prueba de restauración.
- Logs estructurados sin contenido clínico.
- Auditoría inmutable a nivel de aplicación.
- Métricas, health checks y alertas.
- Migraciones versionadas y despliegue reversible.

### 4.2 Fuera del primer MVP productivo

- Prescripción médica o farmacológica.
- Diagnóstico automático por IA.
- Atención de emergencias como sustituto de servicios locales.
- Tratamiento de menores sin un modelo legal de representantes y consentimiento.
- Integración con aseguradoras.
- Facturación clínica avanzada.
- Marketplace de múltiples países o monedas.
- Analítica clínica agregada sin un proceso formal de privacidad.

### 4.3 Funciones condicionadas a proveedor

#### Pagos reales

El código actual simula retención, cobro y devolución. Esta simulación solo es válida para demostraciones. Antes de habilitar pagos reales se requiere:

- proveedor definido;
- tokenización del medio de pago;
- webhooks firmados;
- idempotencia;
- conciliación;
- política de cancelación y reembolso;
- revisión fiscal y contractual.

Ruta Emocional nunca almacenará PAN completo, CVV ni credenciales bancarias.

#### Audio y video

Socket.IO solo puede transportar señalización y eventos; no constituye una llamada segura de audio o video. Esta función requiere un proveedor RTC o infraestructura WebRTC revisada, TURN, control de acceso, política de grabación y evaluación de privacidad.

Hasta entonces, la interfaz debe describirse como demostración o la función debe permanecer deshabilitada mediante feature flag.

## 5. Viajes principales

### Paciente solicita atención inmediata

1. El paciente autenticado selecciona modalidad, necesidad y presupuesto.
2. El servidor obtiene la identidad desde la sesión; ignora identificadores de paciente enviados por el cliente.
3. Se crea una solicitud pendiente.
4. El servidor notifica únicamente a psicólogos verificados y elegibles.
5. Los psicólogos envían ofertas dentro de sus modalidades habilitadas.
6. El paciente consulta ofertas de su propia solicitud.
7. Al aceptar una oferta, una transacción acepta una, rechaza las demás, crea la relación de atención y su conversación longitudinal.
8. Los eventos de tiempo real se publican después de confirmar la transacción.

La cita se agenda posteriormente dentro de la relación activa. Aceptar una
oferta no reserva un horario de manera implícita.

### Paciente programa atención

1. El paciente consulta espacios calculados por el servidor.
2. Selecciona un espacio y modalidad compatibles con el psicólogo.
3. El servidor vuelve a validar disponibilidad dentro de la transacción.
4. Se crea la cita en estado programado o confirmado, según la regla de confirmación.
5. La restricción de exclusión de PostgreSQL resuelve cualquier carrera concurrente.

### Psicólogo registra una sesión

1. El psicólogo verificado abre una cita propia.
2. El servidor valida relación de atención y autorización.
3. Se inicia o completa un encuentro clínico.
4. La nota se guarda como borrador editable.
5. Al firmar, el contenido se vuelve inmutable.
6. Una corrección crea una nueva versión y conserva la anterior.
7. Cada lectura o cambio sensible genera auditoría.

### Usuario conversa con MENTA

1. Se muestra que MENTA es IA y no un profesional ni un servicio de emergencia.
2. El mensaje pasa primero por controles locales de crisis y abuso.
3. Si hay riesgo crítico, se detiene el flujo comercial y se presenta el protocolo de crisis.
4. En otro caso, se minimiza el contenido y se solicita orientación al proveedor configurado.
5. La respuesta se valida contra un esquema cerrado y reglas de seguridad.
6. El usuario decide si desea crear una solicitud; MENTA no crea ni acepta una automáticamente.

## 6. Principios de producto

- La seguridad prevalece sobre la conveniencia cuando exista riesgo clínico o de privacidad.
- El frontend representa estado; el backend determina estado.
- No se afirma “100% confidencial” si la arquitectura, contratos y operación no pueden sostener esa afirmación.
- Ninguna recomendación de IA se presenta como diagnóstico.
- Las decisiones financieras se derivan de datos persistidos y eventos del proveedor, no del cliente.
- Los valores monetarios se manejan como decimal y moneda explícita, nunca como punto flotante.
- Las fechas se almacenan en UTC y se muestran en la zona horaria del usuario.
- La ubicación se comparte por consentimiento, propósito y tiempo limitados.
- La información clínica no se utiliza para publicidad ni ranking comercial.
- Las funcionalidades incompletas se ocultan mediante feature flags en producción.

## 7. Métricas del MVP

### Producto

- porcentaje de registros completados;
- tiempo hasta recibir la primera oferta;
- porcentaje de solicitudes que llegan a una cita;
- cancelaciones y no presentación;
- tiempo de verificación profesional;
- sesiones con errores de entrega de mensajes.

### Seguridad y confiabilidad

- intentos de autenticación bloqueados;
- accesos denegados por autorización;
- sesiones revocadas y reutilización de refresh token detectada;
- accesos clínicos auditados;
- incidentes de datos sensibles en logs, con objetivo cero;
- disponibilidad y latencia de endpoints críticos;
- éxito de backups y restauraciones.

Las métricas no deben incluir texto clínico, mensajes ni descripciones libres.

## 8. Puertas de salida a producción

No se habilitarán usuarios reales hasta completar:

- revisión clínica de MENTA y protocolo de crisis;
- revisión jurídica de privacidad, consentimiento y expediente clínico;
- verificación de credenciales profesionales con fuente autorizada;
- matriz de permisos automatizada en pruebas;
- prueba de restauración de backups;
- pruebas de carga y seguridad del API;
- TLS y gestión de secretos en el entorno final;
- política de soporte e incidentes;
- eliminación de datos mock y fallbacks engañosos;
- confirmación de proveedores de pagos y RTC, o desactivación explícita.
