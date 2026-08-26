# Reglas de negocio

Las reglas se identifican para poder referenciarlas en casos de uso, pruebas, auditorías y contratos. Las expresiones “debe” y “no debe” representan requisitos obligatorios.

## 1. Identidad y cuentas

- **ID-001**. El correo se normaliza con trim y lowercase antes de comparar o persistir.
- **ID-002**. Un correo canónico identifica como máximo una cuenta.
- **ID-003**. La API nunca acepta del cliente el identificador del actor como fuente de autoridad. El actor se obtiene de la sesión.
- **ID-004**. El registro público solo puede solicitar los roles paciente o psicólogo. Los roles administrativos nunca se autoconceden.
- **ID-005**. Una cuenta suspendida no puede crear nuevas sesiones ni usar access tokens existentes una vez que el servidor consulta su estado en una operación sensible.
- **ID-006**. Una cuenta deshabilitada no puede autenticarse. Su eliminación física requiere la política de retención aplicable.
- **ID-007**. Las contraseñas se validan en el servidor y se almacenan mediante un algoritmo de derivación resistente a fuerza bruta.
- **ID-008**. Los mensajes de error de autenticación no revelan si un correo existe.
- **ID-009**. El inicio de sesión exitoso crea una sesión identificable y revocable.
- **ID-010**. Un access token tiene duración corta y contiene como mínimo `sub`, `sid`, `iss`, `aud`, `iat`, `nbf`, `exp` y roles.
- **ID-011**. Un refresh token es aleatorio, opaco, de un solo uso lógico y se almacena únicamente como hash.
- **ID-012**. La rotación de refresh token invalida el valor anterior. Su reutilización revoca la familia de sesión.
- **ID-013**. Cerrar sesión revoca la sesión actual; cerrar todas revoca todas las sesiones del usuario.
- **ID-014**. El cambio de contraseña revoca las demás sesiones.
- **ID-015**. Los secretos y tokens nunca se escriben en logs, respuestas de error o eventos analíticos.

## 2. Perfiles y verificación profesional

- **PR-001**. Un usuario puede tener como máximo un perfil de paciente y uno de psicólogo.
- **PR-002**. Crear un perfil de psicólogo no implica estar verificado.
- **PR-003**. Un psicólogo pendiente o rechazado no aparece en el directorio ni puede ofertar o atender.
- **PR-004**. La licencia se identifica por autoridad y número; esa combinación es única.
- **PR-005**. La verificación requiere evidencia, actor administrativo y marca de tiempo.
- **PR-006**. Un administrador puede verificar o rechazar; no puede alterar el documento original sin dejar auditoría.
- **PR-007**. La expiración, suspensión o revocación de una credencial impide nuevas ofertas y citas. Las citas existentes pasan a revisión operativa.
- **PR-008**. Un psicólogo debe habilitar al menos una modalidad con precio positivo antes de estar disponible.
- **PR-009**. Solo una especialidad puede marcarse como principal.
- **PR-010**. La calificación y cantidad de reseñas se calculan desde reseñas persistidas; el cliente no las envía al crear ofertas.
- **PR-011**. La ubicación pública debe degradarse o agregarse para evitar revelar una dirección precisa salvo necesidad presencial y consentimiento.

## 3. Solicitudes de atención

- **SR-001**. Solo un paciente activo puede crear una solicitud para sí mismo.
- **SR-002**. La modalidad debe pertenecer al catálogo cerrado `CHAT`, `CALL` o `IN_PERSON`.
- **SR-003**. El presupuesto debe ser positivo, usar moneda explícita y respetar límites configurables por mercado.
- **SR-004**. Los límites comerciales no se hardcodean en pantallas o controladores; proceden de configuración o catálogo.
- **SR-005**. Una solicitud inmediata tiene vencimiento configurable.
- **SR-006**. Una solicitud programada usa fecha/hora estructurada; nunca concatena el horario dentro de la descripción.
- **SR-007**. La descripción es opcional, se limita en longitud y se trata como dato sensible.
- **SR-008**. La ubicación es opcional y solo se exige para modalidad presencial cuando sea necesaria.
- **SR-009**. La ubicación se conserva con propósito y vencimiento definidos; no se reutiliza como ubicación permanente del paciente.
- **SR-010**. Por defecto, un paciente no mantiene más de una solicitud inmediata abierta. La política puede configurarse sin cambiar el código de dominio.
- **SR-011**. Solo el propietario puede cancelar una solicitud pendiente o en puja.
- **SR-012**. Una solicitud aceptada no puede volver a estado de puja.
- **SR-013**. La expiración o cancelación cierra las ofertas pendientes en la misma transacción o mediante un consumidor idempotente.
- **SR-014**. Los psicólogos solo reciben solicitudes compatibles con su verificación, modalidad y elegibilidad.
- **SR-015**. La identidad y datos públicos del paciente se proyectan desde tablas fuente; no se duplican dentro de la solicitud.

## 4. Ofertas y aceptación

- **OF-001**. Solo un psicólogo verificado puede crear una oferta propia.
- **OF-002**. El psicólogo debe tener habilitada la modalidad solicitada.
- **OF-003**. Existe como máximo una oferta por psicólogo y solicitud.
- **OF-004**. El monto debe ser positivo, utilizar la moneda de la solicitud y respetar límites configurables.
- **OF-005**. Una oferta solo se crea mientras la solicitud está pendiente o en puja y no ha expirado.
- **OF-006**. El psicólogo puede retirar únicamente su oferta pendiente.
- **OF-007**. Solo el paciente propietario puede aceptar una oferta.
- **OF-008**. El precio final se obtiene de la oferta persistida; el cliente no lo decide durante la aceptación.
- **OF-009**. Aceptar una oferta es una única transacción que bloquea la solicitud, valida estados, acepta una oferta, rechaza las demás y crea la relación de atención.
- **OF-010**. La base de datos garantiza como máximo una oferta aceptada por solicitud aun ante concurrencia.
- **OF-011**. Repetir una aceptación con la misma clave de idempotencia devuelve el mismo resultado.
- **OF-012**. Intentar aceptar otra oferta después de una aceptación produce conflicto y no modifica datos.
- **OF-013**. Los eventos de aceptación se publican desde outbox después del commit; el cliente no los fabrica.

## 5. Relación de atención

- **CR-001**. Una relación vincula exactamente un paciente y un psicólogo.
- **CR-002**. Una solicitud aceptada puede originar como máximo una relación.
- **CR-003**. Solo puede existir una relación activa para la misma pareja.
- **CR-004**. La relación puede estar activa, pausada o finalizada.
- **CR-005**. Pausar bloquea nuevas citas y mensajes según la causa, pero no elimina el historial.
- **CR-006**. Finalizar requiere actor, motivo y fecha.
- **CR-007**. Finalizar la relación no elimina obligaciones de conservación ni autoría clínica.
- **CR-008**. La relación habilita acceso operativo; el acceso clínico además depende del propósito, consentimiento y autoría.

## 6. Disponibilidad y citas

- **AP-001**. Cada regla de disponibilidad pertenece a un psicólogo, día de semana y zona horaria IANA.
- **AP-002**. La hora final debe ser posterior a la inicial.
- **AP-003**. Las excepciones prevalecen sobre las reglas semanales.
- **AP-004**. Los espacios disponibles se calculan en el servidor e incluyen duración, buffers y citas existentes.
- **AP-005**. El cliente puede mostrar espacios, pero el servidor debe revalidarlos al reservar.
- **AP-006**. Una cita vincula un paciente, un psicólogo, una modalidad y un intervalo real.
- **AP-007**. La modalidad debe estar habilitada por el psicólogo.
- **AP-008**. Una cita no puede solaparse con otra cita activa del paciente ni del psicólogo.
- **AP-009**. La base de datos mantiene la regla de no solapamiento para evitar carreras.
- **AP-010**. Solo participantes autorizados pueden consultar una cita.
- **AP-011**. La confirmación depende del flujo: automática tras una oferta aceptada o explícita cuando el psicólogo lo requiera.
- **AP-012**. Iniciar requiere cita confirmada, ventana temporal válida y participante autorizado.
- **AP-013**. Completar requiere que la cita estuviera en progreso, salvo corrección administrativa auditada.
- **AP-014**. Cancelar requiere motivo y política de anticipación configurable.
- **AP-015**. La reprogramación es transaccional y conserva una traza del horario anterior.
- **AP-016**. Marcar `NO_SHOW` requiere que la ventana haya finalizado y actor autorizado.
- **AP-017**. Todos los instantes se almacenan en UTC; la zona IANA usada para interpretar la intención también se conserva.

## 7. Conversaciones y mensajes

- **MS-001**. Una conversación se crea por un caso de uso del servidor, no por una sala arbitraria enviada por el cliente.
- **MS-002**. Una conversación de solicitud o cita conserva su contexto mediante una relación normalizada.
- **MS-003**. Solo participantes persistidos pueden consultar mensajes o unirse al canal en tiempo real.
- **MS-004**. El remitente se obtiene de la sesión; nombre y rol no se aceptan como autoridad desde el cliente.
- **MS-005**. El servidor persiste el mensaje antes de emitir el evento.
- **MS-006**. Cada envío usa un identificador idempotente del cliente para evitar duplicados por reconexión.
- **MS-007**. El texto debe ser no vacío y respetar longitud máxima configurable.
- **MS-008**. Archivos y audio requieren almacenamiento privado, análisis de malware, tipo permitido, límite y URL temporal firmada.
- **MS-009**. Los mensajes se consultan con paginación por cursor, nunca con una descarga ilimitada.
- **MS-010**. La edición o eliminación, si se habilita, conserva auditoría y aplica una ventana definida.
- **MS-011**. Los WebSockets rechazan conexiones sin sesión y validan autorización en cada unión y evento.
- **MS-012**. Los eventos de dominio parten del servidor; un cliente no puede emitir `offer_accepted` o `request_status_changed` como hecho autorizado.
- **MS-013**. El contenido de mensajes no se escribe en logs.

## 8. Pagos

- **PY-001**. El importe se deriva de la oferta aceptada y la política vigente.
- **PY-002**. El cliente nunca envía el importe definitivo de una captura o devolución.
- **PY-003**. Un pago usa moneda ISO 4217 y decimal exacto.
- **PY-004**. Cada operación externa tiene clave de idempotencia y referencia única.
- **PY-005**. Los webhooks se autentican mediante firma y se procesan de forma idempotente.
- **PY-006**. El estado local solo cambia con evidencia del proveedor o una transición interna válida.
- **PY-007**. Una devolución no supera el importe capturado.
- **PY-008**. Datos de tarjeta completos y CVV nunca atraviesan ni se almacenan en los servidores de Ruta Emocional.
- **PY-009**. Sin proveedor configurado, el módulo se marca como simulación y permanece deshabilitado en producción.

## 9. Historia clínica

- **CL-001**. Cada paciente tiene como máximo un expediente clínico.
- **CL-002**. Un encuentro pertenece a un expediente y tiene un psicólogo responsable.
- **CL-003**. Cuando deriva de una cita, el paciente y psicólogo del encuentro deben coincidir con ella.
- **CL-004**. Un psicólogo solo crea encuentros para pacientes con relación válida y propósito de atención.
- **CL-005**. Una nota en borrador es editable únicamente por su autor o mediante delegación clínica explícita.
- **CL-006**. Firmar una nota requiere contenido, autor, fecha y contexto clínico válido.
- **CL-007**. El contenido de una versión firmada es inmutable.
- **CL-008**. Corregir una nota firmada crea una nueva versión y marca la nota como enmendada sin borrar versiones previas.
- **CL-009**. Los diagnósticos usan un catálogo versionado y guardan estado, autor y fechas.
- **CL-010**. La IA no confirma diagnósticos ni firma notas.
- **CL-011**. Un plan de tratamiento y sus objetivos pertenecen al expediente y al psicólogo responsable.
- **CL-012**. El acceso de un profesional se limita a información necesaria, contexto de la relación y política de compartición.
- **CL-013**. Un administrador técnico no accede al contenido clínico por su rol administrativo.
- **CL-014**. Toda lectura, exportación, firma, enmienda o cambio de diagnóstico genera evento de auditoría.
- **CL-015**. Exportar un expediente requiere autenticación reciente, autorización y registro de propósito.
- **CL-016**. La eliminación física de información clínica no se ejecuta sin resolver conservación legal y solicitudes del titular.

## 10. Consentimientos

- **CO-001**. Cada documento de consentimiento tiene versión y fecha de vigencia.
- **CO-002**. La decisión del paciente referencia la versión exacta aceptada.
- **CO-003**. Retirar un consentimiento no reescribe el pasado; registra una nueva decisión con fecha.
- **CO-004**. Funciones opcionales como ubicación continua, proveedor externo de IA o grabación requieren consentimiento separado cuando corresponda.
- **CO-005**. El consentimiento no sustituye otra base jurídica ni autoriza acceso ilimitado.
- **CO-006**. Los textos de consentimiento deben ser comprensibles y estar disponibles para consulta posterior.

## 11. MENTA y triaje

- **MT-001**. MENTA se identifica siempre como sistema automatizado.
- **MT-002**. MENTA no diagnostica, prescribe, promete resultados ni reemplaza atención profesional.
- **MT-003**. Antes de llamar a un modelo externo se ejecuta detección determinista y versionada de señales de crisis.
- **MT-004**. Un riesgo crítico interrumpe recomendaciones comerciales de modalidad o presupuesto.
- **MT-005**. La respuesta crítica muestra recursos locales configurados y una acción inmediata revisada por profesionales.
- **MT-006**. La aplicación no afirma haber contactado servicios de emergencia si no existe confirmación real.
- **MT-007**. La entrada al proveedor externo se minimiza y no incluye nombre, correo, teléfono, ubicación exacta o identificadores internos.
- **MT-008**. La respuesta externa se valida contra un esquema cerrado, límites y lista de contenido prohibido.
- **MT-009**. La indisponibilidad del proveedor produce un mensaje seguro; no una falsa evaluación clínica.
- **MT-010**. El nivel de riesgo, reglas aplicadas y versión del evaluador pueden auditarse sin registrar texto innecesario.
- **MT-011**. Incorporar un resultado al expediente requiere revisión profesional y trazabilidad de autoría.
- **MT-012**. Los precios sugeridos no se consideran recomendación clínica y deben separarse de la evaluación de necesidad.

## 12. Auditoría y datos

- **AU-001**. Los eventos de auditoría registran actor, acción, recurso, resultado, tiempo, correlación y metadatos no sensibles.
- **AU-002**. Una auditoría no contiene contraseña, token, texto de nota, mensaje o descripción clínica.
- **AU-003**. Los eventos de auditoría no se actualizan ni eliminan por operaciones ordinarias.
- **AU-004**. Acceso excepcional requiere motivo y referencia de autorización.
- **AU-005**. Las operaciones de negocio y su evento outbox se confirman en la misma transacción.
- **AU-006**. Los consumidores de outbox son idempotentes y registran intentos.
- **AU-007**. Los identificadores de MongoDB se conservan únicamente como `legacy_id` durante migración y reconciliación.
- **AU-008**. Ningún documento MongoDB se copia sin validar relaciones, tipos, duplicados y reglas de 3FN.

## 13. Configuración y feature flags

- **CF-001**. Límites de precio, duraciones, expiraciones, ventanas de cancelación y recursos de crisis se configuran fuera del código de interfaz.
- **CF-002**. Los secretos se inyectan desde un almacén de secretos o variables seguras; nunca usan fallback conocido.
- **CF-003**. Pagos, RTC, MENTA externa y ubicación en vivo tienen feature flags independientes por entorno.
- **CF-004**. Desactivar una integración debe dejar una experiencia explícita y segura, no datos simulados presentados como reales.
