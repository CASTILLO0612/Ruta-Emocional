# Revisión y decisiones del modelo conceptual

## 1. Objetivo

Este documento cierra las ambigüedades detectadas antes de transformar el DER
de Ruta Emocional al modelo lógico. Las decisiones se apoyan en el MVP, las
reglas de negocio, las máquinas de estado, el esquema PostgreSQL y los casos de
uso implementados. El DER representa el **modelo conceptual objetivo**; cuando
la implementación lógica actual todavía no expresa una decisión, se identifica
como brecha y no se disfraza dentro del diagrama.

Fuentes internas revisadas:

- [`mvp-definition.md`](../../product/mvp-definition.md);
- [`business-rules.md`](../../domain/business-rules.md);
- [`state-machines.md`](../../domain/state-machines.md);
- [`schema.prisma`](../../../backend/prisma/schema.prisma);
- cierres de fases de [solicitudes](../../roadmap/phase-4-service-requests-and-offers.md),
  [mensajería](../../roadmap/phase-5-secure-messaging.md),
  [agenda](../../roadmap/phase-6-secure-agenda.md) e
  [historia clínica](../../roadmap/phase-7-secure-clinical-records.md).

## 2. Decisiones bloqueantes

| Decisión | Resolución para el MVP | Efecto conceptual |
|---|---|---|
| Especialización de usuario | `Paciente` y `Psicólogo` son subtipos de `Usuario`. La especialización es parcial y superpuesta: un usuario puede no tener esos perfiles o tener ambos. | Se representa mediante `ISA`, no mediante dos relaciones ordinarias 1:1. |
| Roles | Todo usuario operativo conserva al menos un rol activo; un rol de catálogo puede existir sin usuarios. | `Usuario 1..N` con `Rol 0..N`; la asignación conserva inicio, finalización y estado. |
| Licencia profesional | El perfil de psicólogo puede crearse antes de registrar licencia. Solo un psicólogo verificado y habilitado necesita al menos una licencia verificada. | `Psicólogo 0..N` licencias; la obligatoriedad es condicional al estado. |
| Modalidad | Es un concepto compartido con identidad de catálogo. Solicitud, cita y triaje no duplican el texto de modalidad. | Relaciones explícitas con `Modalidad de atención`. |
| Oferta aceptada | La oferta aceptada, no solo la solicitud, origina la relación asistencial. | `Oferta 0..1` origina `Relación asistencial 1`. |
| Cita | Aceptar no crea una cita. Toda cita se agenda después y pertenece a una relación asistencial activa. | Se elimina el origen directo `Solicitud-Cita`; `Relación asistencial 0..N` agenda `Cita 1`. |
| Pago | El objeto cobrado es una cita. La oferta aceptada establece la tarifa inicial de la relación, pero no es el único objeto pagable. | `Cita 0..N` genera `Pago 1`; se elimina `Oferta-Pago`. |
| Conversación | La aceptación crea una conversación longitudinal de la relación asistencial. Las citas usan esa conversación y no crean salas paralelas. | `Relación asistencial 1:1 Conversación`; desaparece la ambigüedad solicitud/cita. |
| Expediente clínico | Es único y global por paciente dentro de Ruta Emocional. La autoría y el acceso se delimitan por relación asistencial. | Encuentros, diagnósticos y planes conservan contexto asistencial explícito. |
| Consentimiento | La decisión referencia una versión exacta y, cuando el documento lo exige, una relación asistencial concreta. | Historial append-only con `OTORGADO`, `RECHAZADO` y `RETIRADO`. |

## 3. Resolución completa de observaciones

### 3.1 Identidad, directorio y disponibilidad

| # | Decisión cerrada | Consecuencia |
|---:|---|---|
| 1 | Un usuario debe conservar `1..N` roles activos; un rol puede tener `0..N` usuarios. | Se corrige la participación mínima de ambos extremos. |
| 2 | La asignación de rol conserva fecha de asignación, fecha de finalización y estado. Retirar el último rol activo está prohibido. | La asociación lógica debe identificar cada episodio de asignación para permitir retirar y reasignar sin perder historial; la clave actual Usuario+Rol no basta para ciclos repetidos. |
| 3 | Paciente y psicólogo son especializaciones `ISA` de Usuario. | El DER usa generalización, no relaciones ordinarias. |
| 4 | La especialización es superpuesta y parcial. Un profesional puede recibir atención como paciente sin mezclar permisos ni contextos. | Los controles de acceso siguen el rol y el propósito de cada operación. |
| 5 | Un psicólogo pendiente puede tener `0..N` licencias. Para pasar a verificado necesita al menos una licencia verificada. | La obligatoriedad se expresa como restricción condicional. |
| 6 | Siempre hay como máximo una especialidad principal; un psicólogo habilitado debe tener exactamente una principal activa. | La asociación conserva `es principal` y una restricción de unicidad condicional. |
| 7 | Precio por hora, moneda y habilitación dependen de la pareja Psicólogo-Modalidad. | Permanecen como atributos de la relación N:N. |
| 8 | Solicitud, cita y evaluación de triaje se relacionan con Modalidad de atención. | `modalidad` deja de repetirse como atributo conceptual. |
| 9 | Una excepción actúa sobre el calendario completo del psicólogo, puede bloquear varias reglas o añadir disponibilidad extraordinaria. | Permanece independiente de una regla semanal concreta. |

### 3.2 Solicitudes, ofertas, agenda, reseñas y pagos

| # | Decisión cerrada | Consecuencia |
|---:|---|---|
| 10 | Una solicitud aceptada tiene exactamente una oferta aceptada. | Estado y restricción de unicidad identifican la ganadora. |
| 11 | La oferta aceptada origina directamente la relación asistencial. | Se evita inferir la oferta ganadora solo desde la solicitud. |
| 12 | La aceptación no crea automáticamente una cita; la primera y las siguientes se agendan dentro de la relación. | No existe relación conceptual directa Oferta-Cita ni Solicitud-Cita. |
| 13 | Existe como máximo una oferta por Solicitud-Psicólogo. En el MVP no hay versiones; retirar no permite sustituirla silenciosamente. | La pareja es una unicidad natural del futuro modelo lógico. |
| 14 | En el marketplace MVP una relación asistencial nace de una oferta aceptada. Altas administrativas quedan fuera de alcance hasta modelar su fuente. | La relación tiene un origen obligatorio. |
| 15 | Una cita no necesita relación directa con la solicitud; su contexto se obtiene mediante la relación y la oferta de origen. | Las citas posteriores no inventan solicitudes nuevas. |
| 16 | Toda cita requiere exactamente una relación asistencial activa al crearla. | No se modelan citas clínicas huérfanas para urgencias o triaje. |
| 17 | Puede haber varias relaciones históricas para una pareja, pero como máximo una activa. | La unicidad es condicional al estado `ACTIVA`. |
| 18 | El paciente de la cita es quien escribe la reseña. | Se añade la autoría explícita Paciente-Reseña. |
| 19 | La reseña califica una cita completada. El psicólogo evaluado se deriva de esa cita. | Se conserva máximo una reseña por cita. |
| 20 | Un pago corresponde a una cita; la tarifa inicial se deriva de la oferta aceptada y queda fijada para el cobro. | Se elimina la dependencia exclusiva Pago-Oferta. |
| 21 | Una cita admite `0..N` pagos para intentos, pagos parciales o ajustes. Los pagos reales siguen condicionados a proveedor y conciliación. | El futuro lógico no debe imponer una relación 1:1 con oferta. |
| 22 | La relación Pago-Cita es obligatoria desde Pago. | Cada movimiento financiero tiene objeto de negocio identificable. |
| 23 | Cita y Pago crean su primer evento en la misma transacción que el agregado. | Ambos conservan `1..N` eventos durante su ciclo de vida. |
| 24 | Un evento de cita puede tener usuario actor o ser automático. El origen siempre se registra. | Usuario-Evento de cita es opcional desde el evento. |

### 3.3 Mensajería e historia clínica I

| # | Decisión cerrada | Consecuencia |
|---:|---|---|
| 25 | La conversación creada al aceptar continúa durante la relación asistencial. | No se crean conversaciones distintas por solicitud y cita. |
| 26 | Una conversación clínica-operativa pertenece a una sola relación asistencial. | Se elimina la doble vinculación independiente. |
| 27 | La relación asistencial posee exactamente una conversación longitudinal en el MVP. | La autorización se deriva directamente de la relación. |
| 28 | La conversación del MVP tiene dos participantes persistidos y un único intervalo de pertenencia por usuario. Salir y reingresar varias veces queda fuera del MVP. | Si se habilitan grupos o reingresos, se modelará `Episodio de participación` con identidad propia. |
| 29 | Un mensaje puede ser enviado por un usuario o por el sistema. Los mensajes automáticos se identifican por origen y tipo, nunca con un usuario ficticio. | Usuario-Mensaje es opcional desde Mensaje. |
| 30 | El expediente es global para toda la plataforma y existe como máximo uno por paciente. | El acceso profesional se filtra por relación, autoría, propósito y consentimiento. |
| 31 | Todo encuentro clínico requiere exactamente una relación asistencial válida. | La relación deja de ser opcional conceptualmente. |
| 32 | Una cita puede no producir encuentro y un encuentro autorizado puede ser asincrónico, sin cita. | Cita-Encuentro permanece `0..1` en ambos extremos. |
| 33 | Crear encuentro y primera nota ocurre atómicamente; por ello todo encuentro conserva `1..N` notas. | No existe un estado persistido de encuentro sin nota. |
| 34 | Crear una nota crea su versión 1 en la misma transacción. | Nota-Versión conserva `1..N`. |
| 35 | Solo el psicólogo responsable o un profesional con delegación clínica explícita redacta versiones. | Se reemplaza la autoría conceptual genérica de Usuario por Psicólogo. |
| 36 | Cada evento de nota referencia explícitamente la versión afectada. | `versión` deja de ser un atributo suelto. |
| 37 | Firmar, enmendar y actualizar una nota siempre exige actor clínico. Los procesos automáticos usan auditoría/outbox y no actúan como autores. | Psicólogo-Evento de nota permanece obligatorio desde el evento. |

### 3.4 Historia clínica II

| # | Decisión cerrada | Consecuencia |
|---:|---|---|
| 38 | Todo diagnóstico conserva la relación asistencial que autorizó su creación, además del expediente y autor. | Se añade Relación asistencial-Diagnóstico. |
| 39 | Las transiciones diagnósticas son inmutables y auditadas. Para el MVP se usa auditoría append-only; un historial clínico especializado será una ampliación posterior. | No se inventa una entidad adicional sin requisitos clínicos aprobados. |
| 40 | Todo plan pertenece a una relación asistencial concreta. | Se añade Relación asistencial-Plan de tratamiento. |
| 41 | Un plan puede abordar varios diagnósticos y un diagnóstico puede ser abordado por varios planes sucesivos. | Se añade una relación N:N Plan-Diagnóstico. |
| 42 | El comando de creación exige al menos un objetivo y los crea atómicamente con el plan. | Plan-Objetivo conserva `1..N`. |

### 3.5 Consentimiento y triaje

| # | Decisión cerrada | Consecuencia |
|---:|---|---|
| 43 | El documento declara su alcance; una decisión puede contextualizarse en una relación asistencial cuando el alcance sea clínico. | Se añade relación opcional Relación asistencial-Decisión y atributo de alcance en Documento. |
| 44 | Las decisiones permitidas son otorgado, rechazado y retirado. La vigente es la última decisión válida para paciente, documento, versión y contexto. | El historial nunca se sobrescribe; retirar exige una concesión previa vigente. |
| 45 | Toda decisión referencia exactamente la versión presentada al paciente. | Código y versión identifican el documento conceptual. |
| 46 | Una solicitud puede conservar varias evaluaciones inmutables. La más reciente antes de aceptar es la vigente para orientación; aceptar congela su referencia histórica. | Se mantiene `0..N` triajes por solicitud con criterio temporal explícito. |
| 47 | El sistema automatizado produce la evaluación con proveedor, modelo y versión; un psicólogo puede revisarla sin reemplazarla. | Revisor y fecha de revisión son opcionales. |
| 48 | Las reglas son objetos versionados. Una evaluación aplica varias reglas y registra el resultado de cada una. | Se crea `Regla de triaje` y una relación N:N con Evaluación. |

### 3.6 Plataforma e infraestructura

| # | Decisión cerrada | Consecuencia |
|---:|---|---|
| 49 | Auditoría, outbox e idempotencia se conservan por trazabilidad, pero en un bloque de plataforma separado del DER de dominio. | No se confunden con entidades clínicas o comerciales. |
| 50 | Auditoría admite usuario opcional porque también registra acciones automáticas. | Ausencia de usuario significa actor de sistema, no actor desconocido. |
| 51 | El registro de idempotencia del API se delimita por usuario autenticado. Jobs e integraciones usan deduplicación técnica propia. | La relación Usuario-Idempotencia es obligatoria desde el registro. |
| 52 | El identificador conceptual es Usuario + operación + clave. | Se elimina el término ambiguo `Actor` mientras no exista un supertipo de actores técnicos. |

### 3.7 Atributos, dominios y unicidades

| # | Decisión cerrada | Consecuencia |
|---:|---|---|
| 53 | No se usa el atributo genérico `fechas`. | Se declaran creación, actualización, verificación, cierre, envío o publicación según cada entidad. |
| 54 | `intervalo` se descompone conceptualmente en inicio y fin. | Disponibilidad, excepción, cita, encuentro y plan muestran ambos extremos. |
| 55 | `vigencia` significa desde/hasta y se complementa con estado activo cuando corresponde. | No se mezcla periodo con estado. |
| 56 | `zona` significa zona horaria IANA. | La misma semántica se usa en reglas y citas; los instantes se conservan en UTC. |
| 57 | La ubicación pública del psicólogo es aproximada. La ubicación precisa solo pertenece a una solicitud presencial, con propósito y vencimiento. | No se reutiliza como domicilio del paciente. |
| 58 | Cada agregado usa un dominio de estados cerrado documentado en `state-machines.md`. | Los estados no son texto libre ni entidades artificiales. |
| 59 | Solo comandos de negocio ejecutan transiciones permitidas. | No existe actualización genérica de estado. |
| 60 | Se validan los identificadores compuestos Autoridad+Número, Nota+Número, Sistema+Código, Código+Versión y Usuario+Operación+Clave. | Cada componente participa en la identificación completa. |
| 61 | Son únicas las claves naturales: correo canónico, código de rol, código y nombre de especialidad, autoridad+número de licencia, sistema+código diagnóstico y código+versión de consentimiento. | Estas reglas guiarán claves candidatas del modelo lógico. |
| 62 | Son entidades/catálogos Rol, Especialidad, Modalidad, Concepto diagnóstico, Documento de consentimiento y Regla de triaje. Moneda ISO, zona IANA, estados, tipos de evento y método de pago permanecen dominios controlados mientras no tengan metadatos propios. | Se evita convertir cada enumeración en una entidad artificial. |

## 4. Brechas con el modelo lógico actual

Estas decisiones no autorizan a editar migraciones históricas. La futura
transformación lógica debe incorporarse mediante migraciones incrementales y
pruebas de regresión. Las brechas principales son:

1. historial temporal de asignaciones de rol;
2. relación directa Oferta-Relación asistencial;
3. sustitución de los vínculos Solicitud-Cita y Oferta-Pago por
   Relación-Cita y Cita-Pago;
4. conversación asociada directamente a la relación asistencial;
5. actor opcional para eventos automáticos y mensajes de sistema;
6. contexto asistencial de diagnósticos, planes y consentimientos;
7. relación N:N entre planes y diagnósticos;
8. reglas de triaje versionadas y estructuradas;
9. decisión de consentimiento `RECHAZADO` y alcance contextual.

Hasta ejecutar esas migraciones, el DER se considera la especificación
conceptual objetivo y `schema.prisma` la implementación lógica vigente. La
diferencia queda registrada deliberadamente para que no se presente una
inconsistencia como si estuviera terminada.
