# Matriz de autorización

## 1. Modelo

Ruta Emocional combina:

- **RBAC** para capacidades generales por rol;
- **propiedad** para recursos del paciente o psicólogo;
- **relación** para recursos compartidos;
- **estado** para habilitar acciones según el ciclo de vida;
- **propósito y consentimiento** para información clínica;
- **elevación excepcional** para auditorías o soporte autorizado.

Un rol por sí solo nunca concede acceso global a objetos. Cada caso de uso evalúa la política localmente antes de consultar o modificar información sensible.

## 2. Notación

- `Público`: no autenticado.
- `Paciente propio`: paciente dueño del recurso.
- `Psic. pendiente`: perfil profesional no verificado.
- `Psic. vinculado`: psicólogo verificado con relación/cita aplicable.
- `Psic. ajeno`: psicólogo sin relación con el paciente.
- `Admin`: administrador operativo.
- `Auditor`: auditor clínico con propósito aprobado.
- `Sistema`: servicio autenticado con capacidad específica.
- `—`: denegado.
- `Limitado`: solo proyección o campos no sensibles.

## 3. Identidad y perfil

| Operación | Público | Paciente propio | Psic. pendiente | Psic. verificado | Admin | Auditor | Sistema |
|---|---:|---:|---:|---:|---:|---:|---:|
| Registrar paciente | Sí | — | — | — | Sí | — | — |
| Solicitar registro de psicólogo | Sí | — | — | — | Sí | — | — |
| Iniciar/renovar sesión | Sí | Sí | Sí | Sí | Sí | Sí | — |
| Consultar `me` | — | Sí | Sí | Sí | Sí | Sí | — |
| Editar perfil propio | — | Sí | Sí | Sí | Sí propio | Sí propio | — |
| Consultar perfil público de psicólogo | Sí/Limitado | Sí | Sí | Sí | Sí | Sí | — |
| Consultar correo/teléfono ajeno | — | Solo relación y necesidad | — | Solo relación y necesidad | Limitado | Por propósito | — |
| Asignar rol administrativo | — | — | — | — | Admin privilegiado | — | — |
| Suspender cuenta | — | — | — | — | Sí | — | Política automática |
| Deshabilitar cuenta propia | — | Sí | Sí | Sí | Sí | Sí propio | — |

## 4. Credenciales profesionales

| Operación | Paciente | Psic. propietario | Psic. ajeno | Admin | Auditor |
|---|---:|---:|---:|---:|---:|
| Crear/cargar evidencia | — | Sí | — | Sí | — |
| Consultar documento original | — | Sí | — | Sí por función | Por propósito |
| Consultar número/estado público | Limitado | Sí | Limitado | Sí | Sí |
| Verificar/rechazar | — | — | — | Sí | — |
| Cambiar modalidades/precios propios | — | Sí si habilitado | — | Corrección auditada | — |

Un perfil pendiente no obtiene capacidades de marketplace aunque posea el rol `psychologist`.

### Contrato HTTP implementado para verificación

- `psychologist_onboarding:update:self` permite leer y completar únicamente el
  expediente propio, sus especialidades, modalidades, disponibilidad y entregas
  de evidencia.
- `psychologist_verification:manage` permite administrar catálogos, consultar la
  cola pendiente y decidir una entrega.
- La respuesta pública nunca incluye correo, teléfono, número de licencia,
  referencia de evidencia ni coordenadas exactas.
- El repositorio vuelve a comprobar propiedad y estado dentro de la transacción;
  no confía solamente en el middleware HTTP.
- Cada decisión genera auditoría y un evento outbox, pero no concede acceso
  clínico al administrador.

## 5. Solicitudes y ofertas

| Operación | Paciente dueño | Otro paciente | Psic. elegible | Psic. no elegible | Admin | Sistema |
|---|---:|---:|---:|---:|---:|---:|
| Crear solicitud | Sí | — | — | — | Solo soporte excepcional | — |
| Ver detalle completo | Sí | — | Proyección minimizada | — | Limitado | Matching |
| Listar solicitudes abiertas | — | — | Proyección minimizada | — | Sí | Matching |
| Cancelar solicitud | Sí según estado | — | — | Corrección auditada | — | Expirar, no cancelar |
| Crear oferta | — | — | Sí propia | — | — | — |
| Retirar oferta | — | — | Sí propia pendiente | — | — | Expirar |
| Listar ofertas | Sí | — | Solo propia | — | Limitado | — |
| Aceptar oferta | Sí | — | — | — | Corrección excepcional | — |

La proyección para psicólogos no incluye nombre completo, contacto, ubicación exacta ni descripción clínica innecesaria antes de la aceptación.

### Contrato HTTP implementado para solicitudes y ofertas

- `service_request:create` y `service_request:manage:self` pertenecen al paciente
  y el repositorio vuelve a filtrar por `patient_profile.user_id`.
- `service_request:read:eligible` y `offer:create:self` solo se conceden a un
  profesional verificado; la consulta vuelve a exigir cuenta/licencia activas y
  una modalidad compatible.
- `offer:manage:self` permite retirar únicamente la oferta propia pendiente.
- El detalle de una solicitud se revela al dueño, a un profesional con oferta
  propia o a un profesional todavía elegible; en cualquier otro caso responde
  como recurso no encontrado.
- El paciente es el único actor que lista todas las ofertas y acepta una. El
  importe aceptado se obtiene de PostgreSQL y el cuerpo del comando debe estar
  vacío.
- La aceptación usa `Idempotency-Key`; propiedad, estado y consistencia se
  comprueban dentro de la transacción serializable.

## 6. Relaciones y citas

| Operación | Paciente relacionado | Psic. relacionado | Tercero | Admin | Auditor | Sistema |
|---|---:|---:|---:|---:|---:|---:|
| Consultar relación | Sí | Sí | — | Limitado | Por propósito | — |
| Pausar/finalizar | Sí según política | Sí según política | — | Sí auditado | — | — |
| Consultar disponibilidad pública | Sí | Sí propia | Limitado | Sí | — | Sí |
| Editar disponibilidad | — | Sí propia | — | Corrección auditada | — | — |
| Crear cita | Sí según flujo | Sí según flujo | — | Soporte auditado | — | Job autorizado |
| Ver cita | Sí propia | Sí propia | — | Limitado | Por propósito | Recordatorios |
| Confirmar/cancelar | Sí propia | Sí propia | — | Corrección auditada | — | Política automática |
| Marcar completada/no-show | Confirmación limitada | Sí propia | — | Corrección auditada | — | — |

### Contrato implementado para agenda

- `appointment:read:self` y `appointment:manage:self` solo proyectan citas cuya
  relación contiene al actor autenticado.
- `appointment:create:self` permite al paciente reservar sobre una relación
  activa; participantes, duración, fin y zona se derivan en el servidor.
- confirmar, iniciar, completar y marcar inasistencia exigen al psicólogo
  relacionado y verificado; cancelar y reprogramar aplican actor, estado y
  anticipación dentro de la transacción.
- un tercero recibe recurso no encontrado y la posesión de un UUID nunca concede
  acceso.
- eventos Socket.IO se entregan a salas internas por usuario y no modifican el
  estado canónico.

## 7. Conversaciones y comunicación en tiempo real

| Operación | Participante | Usuario ajeno | Admin | Auditor | Sistema |
|---|---:|---:|---:|---:|---:|
| Listar conversaciones | Sí propias | — | Metadatos mínimos | Por propósito | Entrega |
| Consultar mensajes | Sí según relación | — | — por defecto | Por propósito | Moderación autorizada |
| Enviar mensaje | Sí, conversación activa | — | — | — | Mensaje de sistema firmado |
| Unirse a sala WebSocket | Sí, comprobado por servidor | — | Solo canal operativo | Por propósito | Sí, identidad técnica |
| Iniciar señalización RTC | Participantes de cita válida | — | — | — | Proveedor RTC |
| Compartir ubicación | Participante con consentimiento y sesión presencial | — | — | — | Relevo temporal |

La posesión de un `conversationId`, `requestId` o `roomId` no constituye autorización.

### Contrato implementado para mensajería

- `conversation:read:self` lista, consulta, pagina y suscribe únicamente cuando
  el usuario es participante persistido y la relación está activa o pausada.
- `conversation:send:self` vuelve a exigir relación activa dentro de la
  transacción; una relación pausada queda en solo lectura.
- El paciente y el profesional verificado reciben capacidades de conversación;
  un profesional pendiente no las recibe.
- Un identificador ajeno devuelve recurso no encontrado y no revela existencia.
- El handshake autentica, cada suscripción autoriza y la sesión se revalida
  periódicamente; el nombre real de la sala es interno al servidor.
- El worker outbox es el único publicador de `message.created`; el comando y su
  confirmación primaria permanecen en HTTP.

## 8. Historia clínica

| Operación | Paciente | Psic. autor/vinculado | Psic. ajeno | Admin | Auditor clínico | Sistema |
|---|---:|---:|---:|---:|---:|---:|
| Ver resumen de expediente | Según política y jurisdicción | Necesidad y relación | — | — | Propósito aprobado | — |
| Crear encuentro | — | Sí, relación válida | — | — | — | — |
| Crear/editar borrador | — | Autor | — | — | — | — |
| Firmar/enmendar nota | — | Autor autorizado | — | — | — | — |
| Leer nota propia | Según política de acceso del paciente | Autor | — | — | Propósito aprobado | — |
| Leer nota de otro profesional | Según política | Solo consentimiento/transferencia explícita | — | — | Propósito aprobado | — |
| Registrar diagnóstico | — | Profesional autorizado | — | — | — | — |
| Exportar expediente | Sí con autenticación reciente | Solo alcance autorizado | — | — | Propósito aprobado | Generador autorizado |
| Eliminar registro | Solicitar, no ejecutar directo | — | — | Flujo legal separado | — | Retención programada |

El administrador de plataforma no hereda acceso clínico. La autorización clínica debe resolver campos permitidos, no solo filas.

## 9. MENTA y triaje

| Operación | Paciente | Psic. vinculado | Admin | Auditor | Proveedor IA | Sistema de crisis |
|---|---:|---:|---:|---:|---:|---:|
| Iniciar orientación | Sí propia | — | — | — | — | — |
| Ver texto original | Sí | Solo si se comparte explícitamente | — | Por propósito | Solo entrada minimizada | Solo si imprescindible |
| Ver nivel de riesgo | Sí | Con relación/consentimiento | Metadato agregado | Por propósito | No requiere identidad | Sí |
| Revisar evaluación | — | Sí, profesional responsable | — | Sí | — | — |
| Incorporar a expediente | Autoriza compartir | Sí, con autoría profesional | — | — | — | — |

## 10. Pagos

| Operación | Paciente pagador | Psic. beneficiario | Admin financiero | Otro usuario | Proveedor |
|---|---:|---:|---:|---:|---:|
| Crear intento | Sí, desde oferta propia aceptada | — | Soporte | — | Sí |
| Ver estado | Sí propio | Sí, proyección necesaria | Sí | — | Sí |
| Capturar | — | — | Política autorizada | — | Confirmación firmada |
| Reembolsar | Solicitar según política | — | Sí | — | Ejecutar/confirmar |
| Ver método completo | — | — | — | — | Sí; Ruta Emocional solo ve token/metadatos |

## 11. Reglas para controladores y repositorios

1. El controlador autentica y convierte el transporte a un comando tipado.
2. El caso de uso carga el sujeto y recursos mínimos necesarios.
3. Una política de autorización devuelve permitir/denegar y, para lecturas, el alcance de campos.
4. El repositorio aplica filtros por propietario/relación como defensa adicional.
5. La respuesta usa un DTO explícito; nunca serializa directamente un modelo Prisma.
6. Una denegación devuelve `403`; para recursos sensibles se puede devolver `404` si revelar existencia crea riesgo.
7. Toda denegación sensible se registra sin contenido clínico.

## 12. Pruebas obligatorias

Para cada permiso positivo debe existir al menos una prueba negativa:

- paciente A no lee solicitud, oferta, cita o conversación de paciente B;
- psicólogo pendiente no aparece ni oferta;
- psicólogo verificado no se une a una conversación ajena;
- psicólogo relacionado no ve automáticamente notas de otro profesional;
- administrador no lee texto clínico;
- token revocado no usa API ni WebSocket;
- identificador manipulado no cambia el actor;
- un evento WebSocket fabricado no modifica estado persistido.
