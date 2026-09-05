# Evidencia de interfaz y formularios funcionales

## 1. Navegación implementada

La raíz de navegación está en [`frontend/src/navigation/AppNavigator.tsx`](../../../frontend/src/navigation/AppNavigator.tsx). La sesión y las capacidades devueltas por el backend determinan el espacio visible; el cliente no concede acceso por esconder o mostrar una pantalla.

| Actor | Pantalla o flujo | Archivo principal | Operación demostrable |
|---|---|---|---|
| Público | acceso, registro, recuperación y legal | [`AuthNavigator.tsx`](../../../frontend/src/navigation/AuthNavigator.tsx), [`AuthScreens.tsx`](../../../frontend/src/screens/auth/AuthScreens.tsx), [`PasswordRecoveryScreens.tsx`](../../../frontend/src/screens/auth/PasswordRecoveryScreens.tsx) | registrar paciente/psicólogo, iniciar sesión, solicitar/restablecer acceso y consultar términos/privacidad |
| Paciente | inicio y solicitud | [`HomeScreen.tsx`](../../../frontend/src/screens/patient/HomeScreen.tsx) | consultar profesionales y crear una solicitud con presupuesto |
| Paciente | radar y ofertas | [`RadarScreen.tsx`](../../../frontend/src/screens/patient/RadarScreen.tsx) | seguir la solicitud, revisar ofertas, aceptar o cancelar |
| Paciente | orientación MENTA | [`MentaScreen.tsx`](../../../frontend/src/screens/patient/MentaScreen.tsx) | responder opciones cerradas, consentir y obtener orientación sin presupuesto |
| Usuario autenticado | agente contextual MENTA | [`MentaAgentScreen.tsx`](../../../frontend/src/screens/shared/MentaAgentScreen.tsx) | consultar contexto autorizado según rol sin sustituir agenda, directorio ni expediente |
| Psicólogo pendiente | incorporación y evidencia | [`VerificationScreen.tsx`](../../../frontend/src/screens/psychologist/VerificationScreen.tsx) | completar presentación, especialidad, modalidad, disponibilidad y evidencia |
| Administrador | cola de verificación | [`VerificationQueueScreen.tsx`](../../../frontend/src/screens/admin/VerificationQueueScreen.tsx) | aprobar o rechazar una solicitud y registrar la decisión |
| Psicólogo verificado | solicitudes elegibles | [`DashboardScreen.tsx`](../../../frontend/src/screens/psychologist/DashboardScreen.tsx) | consultar solicitudes y presentar o retirar oferta |
| Participante | bandeja y conversación | [`InboxScreen.tsx`](../../../frontend/src/screens/shared/InboxScreen.tsx), [`ConversationScreen.tsx`](../../../frontend/src/screens/shared/ConversationScreen.tsx) | listar conversaciones, paginar y enviar mensajes |
| Participante | agenda | [`AgendaScreen.tsx`](../../../frontend/src/screens/shared/AgendaScreen.tsx) | consultar disponibilidad, crear, confirmar, cancelar o reprogramar cita según el actor |
| Psicólogo autorizado | pacientes y expediente | [`ClinicalRecordsScreen.tsx`](../../../frontend/src/screens/psychologist/ClinicalRecordsScreen.tsx) | revisar MENTA vinculada, crear encuentros, editar/firmar/enmendar notas y gestionar planes |
| Usuario autenticado | perfil | [`ProfileScreen.tsx`](../../../frontend/src/screens/shared/ProfileScreen.tsx) | consultar sesión y cerrar sesión |

## 2. Formularios y validación

Los formularios relevantes tienen estados de carga y error, deshabilitan envíos inválidos y no confían únicamente en la validación visual. El backend vuelve a validar campos permitidos, formato, longitud, estado, propiedad y relación.

| Formulario | Validación del cliente | Validación y autorización del servidor |
|---|---|---|
| registro/acceso/recuperación | correo, contraseña, tipo de cuenta, licencia cuando aplica y coincidencia del restablecimiento | [`identityValidation.ts`](../../../backend/src/modules/identity/presentation/identityValidation.ts), token opaco de un solo uso y límites por endpoint |
| incorporación profesional | presentación, catálogo activo, importe, horario y archivo seleccionado | [`professionalDirectoryValidation.ts`](../../../backend/src/modules/professional-directory/presentation/professionalDirectoryValidation.ts) y propiedad dentro de transacción |
| solicitud/oferta | necesidad, modalidad, presupuesto, mensaje e importe | [`serviceRequestValidation.ts`](../../../backend/src/modules/service-request/presentation/serviceRequestValidation.ts), reglas comerciales e idempotencia |
| mensaje | texto no vacío, límite de caracteres y reintento visual | [`messagingValidation.ts`](../../../backend/src/modules/messaging/presentation/messagingValidation.ts) y participación persistida |
| cita | intervalo, estado y motivo cuando corresponde | [`appointmentValidation.ts`](../../../backend/src/modules/appointment/presentation/appointmentValidation.ts), relación activa y exclusión de solapamientos |
| historia clínica | contenido, fechas, motivo de enmienda y objetivos | [`clinicalRecordValidation.ts`](../../../backend/src/modules/clinical-record/presentation/clinicalRecordValidation.ts), autoría, relación y estado |
| MENTA | todas las preguntas requeridas y consentimiento vigente | [`triageValidation.ts`](../../../backend/src/modules/triage/presentation/triageValidation.ts), catálogo cerrado, propiedad, relación e idempotencia |

## 3. Criterio visual

- Navegación inferior consistente para paciente y psicólogo.
- Jerarquía mediante tipografía, espaciado, superficies y estados; no mediante decoración excesiva.
- Iconografía estática profesional de Lucide y microinteracciones puntuales de MorphIcons a través del límite seguro `AppMorphIcon`; no se usan emojis como sustituto visual.
- Acciones destructivas o irreversibles separadas de acciones primarias y sujetas a confirmación.
- Mensajes de vacío, carga, error y reintento en los flujos de datos remotos.
- Sin emojis como sustituto de iconos de interfaz.

## 4. Lista de comprobación manual

| Paso | Resultado esperado |
|---|---|
| abrir sin sesión | se muestran acceso y registro |
| solicitar recuperación con correo existente o inexistente | se muestra la misma respuesta genérica y no se enumera la cuenta |
| usar dos veces el mismo enlace de recuperación | el segundo intento se rechaza sin revelar datos técnicos |
| registrar psicólogo pendiente | se abre incorporación, no el panel profesional |
| intentar guardar un formulario incompleto | el envío permanece deshabilitado o aparece validación |
| aprobar la evidencia y renovar la sesión | se habilita automáticamente el panel profesional |
| crear y aceptar oferta | aparece la relación y la conversación para ambos participantes |
| usar un identificador ajeno | el backend no revela el recurso |
| reservar dos citas solapadas | PostgreSQL rechaza el conflicto |
| firmar una nota clínica | el contenido firmado queda inmutable; el cambio posterior requiere enmienda |
| completar MENTA con peligro inmediato | aparecen acciones/recursos; no se muestra presupuesto ni modalidad comercial |
| abrir MENTA desde un psicólogo ajeno | el backend responde como recurso no encontrado |
| consultar MENTA contextual | solo aparecen datos que las herramientas autorizadas permiten al usuario y rol actuales |

Para una demostración reproducible, use únicamente datos ficticios y siga el [runbook de verificación local](../../runbooks/local-professional-verification.md).
