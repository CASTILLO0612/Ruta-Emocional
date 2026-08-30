# Modelo entidad-relación conceptual de Ruta Emocional

## 1. Propósito

Este documento consolida el significado de la información manejada por Ruta
Emocional. El diagrama asociado es un **modelo entidad-relación conceptual**:
describe los conceptos del dominio, sus características, las asociaciones del
negocio, la cardinalidad y la participación. No es una captura de tablas.

La fuente canónica del dominio es la
[`revisión de decisiones conceptuales`](revision-decisiones-modelo-conceptual.md),
contrastada con reglas de negocio, casos de uso y
[`backend/prisma/schema.prisma`](../../../backend/prisma/schema.prisma). El DER
representa el objetivo conceptual aprobado; las brechas con el modelo lógico
vigente se mantienen documentadas para una migración incremental posterior.
`spatial_ref_sys`, tabla técnica de PostGIS, no pertenece al dominio y se
excluye.

## 2. Criterio de modelado

Peter Chen propuso el modelo ER para representar semántica del mundo real antes
de convertirla a una estructura de almacenamiento. IBM distingue el modelo
conceptual del lógico y del físico; Oracle separa explícitamente las entidades y
relaciones de las tablas, columnas, índices y objetos del motor.

Por ello, el DER utiliza:

- rectángulo: tipo de entidad;
- rombo: relación nombrada con un verbo;
- óvalo: atributo conceptual;
- atributo subrayado: identificador conceptual;
- `(mínimo, máximo)`: participación y cardinalidad;
- `1:1`, `1:N` o `N:N` dentro del rombo: tipo global de relación;
- triángulo `ISA`: generalización/especialización;
- la anotación `parcial, superpuesta`: un `Usuario` puede no pertenecer a esos
  subtipos o pertenecer simultáneamente a `Paciente` y `Psicólogo`.

Cada atributo se dibuja en su propio óvalo. Los atributos de una relación se
conectan al rombo correspondiente. Una relación `N:N` no se sustituye por una
entidad asociativa en el DER: su resolución se realiza posteriormente al
transformar el modelo conceptual al modelo lógico.

No se incluyen tipos SQL, longitudes, columnas foráneas, nombres `snake_case`,
índices, triggers, políticas de borrado, cifrado ni detalles de Prisma. Esos
elementos pertenecen al modelo relacional o físico y se documentan por separado
en [`normalization-3nf.md`](../../database/normalization-3nf.md).

Fuentes metodológicas:

- [Peter P. Chen, The Entity-Relationship Model (ACM, 1976)](https://doi.org/10.1145/320434.320440)
- [IBM, What is data modeling?](https://www.ibm.com/think/topics/data-modeling)
- [Oracle, Data Modeler Concepts and Usage](https://docs.oracle.com/en/database/oracle/sql-developer-data-modeler/20.3/dmdug/data-modeler-concepts-usage.html)

## 3. Resultado de la consolidación

La revisión de las 62 observaciones produce:

- **38 tipos de entidad conceptual** con identidad o ciclo de vida propio;
- **64 asociaciones semánticas** con cardinalidad y participación definidas;
- **1 jerarquía ISA** parcial y superpuesta;
- **7 relaciones N:N explícitas**, todavía sin resolver en el DER;
- **20 dominios de estado o clasificación**, representados como atributos y no
  como entidades artificiales.

Los modelos Prisma se usan para comprobar trazabilidad, no para dictar la
semántica. Su transformación relacional no se dibuja dentro del DER.

## 4. Catálogo de entidades conceptuales

Los identificadores enumerados son conceptuales. No implican que el DER esté
exponiendo una llave primaria física.

| Área | Entidad | Identificador | Atributos significativos |
|---|---|---|---|
| Identidad | Usuario | Identificador de usuario | correo, nombre visible, teléfono, estado, creación |
| Identidad | Rol | Código de rol | nombre, descripción |
| Identidad | Sesión | Identificador de sesión | credencial de renovación protegida, dispositivo, dirección de red, agente, expiración, revocación, creación |
| Identidad | Paciente | Identificador de paciente | fecha de nacimiento, creación, actualización |
| Identidad | Psicólogo | Identificador de psicólogo | estado de verificación, presentación, ubicación pública aproximada, creación, actualización |
| Directorio | Licencia profesional | Autoridad + número | estado, evidencia referenciada, verificada en, creación |
| Directorio | Especialidad | Código de especialidad | nombre, estado de catálogo, creación, actualización |
| Directorio | Modalidad de atención | Código de modalidad | nombre, estado de catálogo |
| Verificación | Solicitud de verificación | Identificador de solicitud | referencia privada de evidencia, fecha de envío |
| Verificación | Decisión de verificación | Identificador de decisión | resultado, motivo público, motivo interno, decidida en |
| Disponibilidad | Regla de disponibilidad | Identificador de regla | día, hora inicial, hora final, zona horaria IANA, vigente desde, vigente hasta, estado |
| Disponibilidad | Excepción de disponibilidad | Identificador de excepción | inicio, fin, tipo, motivo |
| Atención | Solicitud de atención | Identificador de solicitud | necesidad, presupuesto, moneda, estado, programada para, vence en, ubicación temporal, vencimiento de ubicación |
| Atención | Oferta | Identificador de oferta | importe, mensaje, estado, creación, actualización |
| Atención | Relación asistencial | Identificador de relación | estado, iniciada en, finalizada en |
| Agenda | Cita | Identificador de cita | inicio, fin, zona horaria IANA, estado, motivo de cancelación, creación |
| Agenda | Evento de cita | Identificador de evento | tipo, estados anterior/nuevo, inicio/fin anterior, motivo, ocurrencia, origen |
| Reputación | Reseña | Identificador de reseña | puntuación, comentario, creación |
| Mensajería | Conversación | Identificador de conversación | fecha de creación |
| Mensajería | Mensaje | Identificador de mensaje | identificador del cliente, tipo, contenido, enviado en, editado en, origen |
| Clínica | Expediente clínico | Identificador de expediente | estado, abierto en, cerrado en |
| Clínica | Encuentro clínico | Identificador de encuentro | inicio, fin, motivo, creación |
| Clínica | Nota clínica | Identificador de nota | estado, firmada en, creación, actualización |
| Clínica | Versión de nota | Nota + número de versión | contenido, motivo de enmienda, creación |
| Clínica | Evento de nota | Identificador de evento | tipo, estado anterior, estado nuevo, ocurrencia |
| Clínica | Concepto diagnóstico | Sistema de código + código | nombre |
| Clínica | Diagnóstico clínico | Identificador de diagnóstico | estado, observaciones, diagnosticado en |
| Clínica | Plan de tratamiento | Identificador de plan | estado, resumen, inicio, fin, creación, actualización |
| Clínica | Objetivo terapéutico | Identificador de objetivo | descripción, fecha meta, estado |
| Consentimiento | Documento de consentimiento | Código + versión | título, huella del contenido, alcance, publicación |
| Consentimiento | Decisión de consentimiento | Identificador de decisión | decisión, ocurrencia, dirección de red |
| Orientación | Evaluación de triaje | Identificador de evaluación | proveedor, modelo, versión del evaluador, necesidad, orientación, resultado del proveedor, país, riesgo, revisión, creación |
| Orientación | Regla de triaje | Código + versión | nombre, nivel de riesgo, vigente desde, vigente hasta, estado |
| Pagos | Pago | Identificador de pago | importe, moneda, método, referencia de transacción, estado, creación |
| Pagos | Evento de pago | Identificador de evento | estados anterior/nuevo, referencia externa, ocurrencia, origen |
| Plataforma | Evento de auditoría | Identificador de evento | acción, recurso, resultado, correlación, dirección de red, metadatos, ocurrencia, origen |
| Plataforma | Evento de salida | Identificador de evento | agregado, tipo, ocurrencia, disponibilidad, publicación, intentos, último error |
| Plataforma | Registro de idempotencia | Usuario + operación + clave | huella de petición, recurso resultante, creación, expiración |

## 5. Catálogo de relaciones y cardinalidades

La columna `B por cada A` indica cuántas instancias de B pueden relacionarse con
una instancia de A. `A por cada B` expresa la dirección inversa.

### 5.1 Identidad, perfiles y directorio

| Entidad A | Relación | Entidad B | B por cada A | A por cada B |
|---|---|---|---:|---:|
| Usuario | tiene asignado | Rol | 1..N | 0..N |
| Usuario | mantiene | Sesión | 0..N | 1 |
| Psicólogo | acredita | Licencia profesional | 0..N | 1 |
| Psicólogo | ejerce en | Especialidad | 0..N | 0..N |
| Psicólogo | ofrece | Modalidad de atención | 0..N | 0..N |
| Licencia profesional | recibe | Solicitud de verificación | 0..N | 1 |
| Solicitud de verificación | se resuelve mediante | Decisión de verificación | 0..1 | 1 |
| Usuario | revisa | Decisión de verificación | 0..N | 1 |
| Psicólogo | define | Regla de disponibilidad | 0..N | 1 |
| Psicólogo | registra | Excepción de disponibilidad | 0..N | 1 |

`Paciente` y `Psicólogo` forman una jerarquía `ISA` con `Usuario` como
supertipo. Es parcial porque una cuenta administrativa puede no pertenecer a
ninguno de esos subtipos, y es superpuesta porque un psicólogo puede usar la
plataforma como paciente. Un perfil profesional pendiente puede existir sin
licencia; la licencia verificada es obligatoria para habilitar actividad
profesional, no para crear el perfil.

### 5.2 Atención, agenda, pagos y reputación

| Entidad A | Relación | Entidad B | B por cada A | A por cada B |
|---|---|---|---:|---:|
| Paciente | crea | Solicitud de atención | 0..N | 1 |
| Solicitud de atención | requiere | Modalidad de atención | 1 | 0..N |
| Solicitud de atención | recibe | Oferta | 0..N | 1 |
| Psicólogo | presenta | Oferta | 0..N | 1 |
| Oferta | origina | Relación asistencial | 0..1 | 1 |
| Paciente | participa en | Relación asistencial | 0..N | 1 |
| Psicólogo | participa en | Relación asistencial | 0..N | 1 |
| Paciente | agenda | Cita | 0..N | 1 |
| Psicólogo | atiende | Cita | 0..N | 1 |
| Relación asistencial | agenda | Cita | 0..N | 1 |
| Cita | usa | Modalidad de atención | 1 | 0..N |
| Cita | registra | Evento de cita | 1..N | 1 |
| Usuario | ejecuta | Evento de cita | 0..N | 0..1 |
| Cita | recibe | Reseña | 0..1 | 1 |
| Paciente | escribe | Reseña | 0..N | 1 |
| Cita | genera | Pago | 0..N | 1 |
| Pago | registra | Evento de pago | 1..N | 1 |

La oferta solo origina una relación cuando está aceptada. Toda cita se crea en
una relación activa, incluida la primera; las citas posteriores no requieren
otra solicitud. El pago corresponde a una cita y admite varios intentos o
movimientos. Los pagos reales permanecen condicionados al proveedor.

### 5.3 Conversaciones y mensajes

| Entidad A | Relación | Entidad B | B por cada A | A por cada B |
|---|---|---|---:|---:|
| Relación asistencial | mantiene | Conversación | 1 | 1 |
| Usuario | participa en | Conversación | 0..N | 2 |
| Conversación | contiene | Mensaje | 0..N | 1 |
| Usuario | envía | Mensaje | 0..N | 0..1 |

La conversación es longitudinal a la relación asistencial y tiene exactamente
dos participantes en el MVP. Un mensaje sin usuario emisor es un mensaje de
sistema explícito; nunca se crea un usuario ficticio para representarlo.

### 5.4 Historia clínica

| Entidad A | Relación | Entidad B | B por cada A | A por cada B |
|---|---|---|---:|---:|
| Paciente | posee | Expediente clínico | 0..1 | 1 |
| Expediente clínico | agrupa | Encuentro clínico | 0..N | 1 |
| Psicólogo | realiza | Encuentro clínico | 0..N | 1 |
| Relación asistencial | autoriza | Encuentro clínico | 0..N | 1 |
| Cita | se materializa como | Encuentro clínico | 0..1 | 0..1 |
| Encuentro clínico | contiene | Nota clínica | 1..N | 1 |
| Nota clínica | conserva | Versión de nota | 1..N | 1 |
| Psicólogo | redacta | Versión de nota | 0..N | 1 |
| Nota clínica | registra | Evento de nota | 1..N | 1 |
| Psicólogo | ejecuta | Evento de nota | 0..N | 1 |
| Versión de nota | es afectada por | Evento de nota | 1..N | 1 |
| Expediente clínico | contiene | Diagnóstico clínico | 0..N | 1 |
| Concepto diagnóstico | clasifica | Diagnóstico clínico | 0..N | 1 |
| Psicólogo | formula | Diagnóstico clínico | 0..N | 1 |
| Encuentro clínico | sustenta | Diagnóstico clínico | 0..N | 0..1 |
| Relación asistencial | contextualiza | Diagnóstico clínico | 0..N | 1 |
| Expediente clínico | organiza | Plan de tratamiento | 0..N | 1 |
| Psicólogo | dirige | Plan de tratamiento | 0..N | 1 |
| Relación asistencial | contextualiza | Plan de tratamiento | 0..N | 1 |
| Plan de tratamiento | aborda | Diagnóstico clínico | 0..N | 0..N |
| Plan de tratamiento | define | Objetivo terapéutico | 1..N | 1 |

El expediente es global por paciente, pero diagnóstico y plan conservan la
relación que autorizó su creación. Crear un encuentro genera al menos una nota
y su primera versión dentro de la misma operación atómica.

### 5.5 Consentimiento, orientación y plataforma

| Entidad A | Relación | Entidad B | B por cada A | A por cada B |
|---|---|---|---:|---:|
| Paciente | expresa | Decisión de consentimiento | 0..N | 1 |
| Documento de consentimiento | fundamenta | Decisión de consentimiento | 0..N | 1 |
| Relación asistencial | contextualiza | Decisión de consentimiento | 0..N | 0..1 |
| Decisión de consentimiento | autoriza | Evaluación de triaje | 0..N | 1 |
| Paciente | recibe | Evaluación de triaje | 0..N | 1 |
| Psicólogo | revisa | Evaluación de triaje | 0..N | 0..1 |
| Evaluación de triaje | informa | Solicitud de atención | 0..1 | 0..N |
| Relación asistencial | conserva como origen | Evaluación de triaje | 0..1 | 0..1 |
| Evaluación de triaje | recomienda | Modalidad de atención | 0..N | 0..N |
| Evaluación de triaje | aplica | Regla de triaje | 1..N | 0..N |
| Usuario | origina | Evento de auditoría | 0..N | 0..1 |
| Usuario | delimita | Registro de idempotencia | 0..N | 1 |

`Evento de salida` conserva una referencia polimórfica al agregado que originó
el evento. No se dibuja una relación ficticia con todas las entidades porque no
existe una asociación única de dominio ni una llave foránea correspondiente.

## 6. Relaciones N:N y transformación lógica posterior

El DER conserva las siete relaciones muchos-a-muchos como rombos. Sus
atributos pertenecen a la relación, no a una tabla conceptual inventada.

| Entidad A | Relación N:N | Entidad B | Atributos de la relación |
|---|---|---|---|
| Usuario | tiene asignado | Rol | asignada en, finalizada en, estado |
| Psicólogo | ejerce en | Especialidad | indicador de especialidad principal |
| Psicólogo | ofrece | Modalidad de atención | precio por hora, moneda, habilitación |
| Usuario | participa en | Conversación | ingreso, salida |
| Plan de tratamiento | aborda | Diagnóstico clínico | ninguno |
| Evaluación de triaje | recomienda | Modalidad de atención | prioridad |
| Evaluación de triaje | aplica | Regla de triaje | resultado, evidencia minimizada |

Al derivar el modelo lógico, cada N:N se resuelve mediante una estructura
asociativa que contiene las referencias de ambos extremos y los atributos de la
relación. Seis ya tienen transformación en PostgreSQL: Usuario-Rol,
Psicólogo-Especialidad, Psicólogo-Modalidad, Usuario-Conversación,
Evaluación-Modalidad y Evaluación-Regla. Plan-Diagnóstico permanece diferida
hasta aprobar ese caso de uso. Los nombres de implementación no aparecen en el
DER conceptual.

Las demás asociaciones implementadas mediante modelos auxiliares, como
`AppointmentRequest` o `ClinicalEncounterAppointment`, no son problemas N:N:
materializan asociaciones opcionales 1:1 o 1:N y tampoco deben confundirse con
entidades conceptuales.

## 7. Reglas de integridad visibles en el DER

1. Todo usuario operativo conserva al menos un rol activo; un rol de catálogo
   puede existir antes de su primera asignación.
2. Paciente y Psicólogo son subtipos parciales y superpuestos de Usuario.
3. Un psicólogo pendiente puede no tener licencia; uno habilitado tiene al menos
   una licencia verificada y exactamente una especialidad principal activa.
4. Solicitud, cita y triaje referencian la modalidad común mediante relaciones,
   no mediante copias textuales.
5. La oferta aceptada origina exactamente una relación asistencial; como máximo
   una relación de la misma pareja permanece activa.
6. Toda cita pertenece a una relación asistencial y crea su evento inicial en la
   misma transacción.
7. Una reseña es escrita por el paciente de una cita completada y existe como
   máximo una por cita.
8. Todo pago corresponde a una cita y conserva al menos un evento.
9. Cada relación asistencial mantiene una conversación longitudinal con dos
   participantes en el MVP.
10. Un mensaje o evento automático no usa un usuario ficticio; el origen del
    sistema queda explícito.
11. Un expediente pertenece a un solo paciente; encuentros, diagnósticos y
    planes conservan la relación asistencial que autoriza el acceso.
12. Crear encuentro, nota y versión inicial es una operación atómica; firmar o
    enmendar requiere actor clínico.
13. Cada evento de nota referencia la versión afectada.
14. Una decisión de consentimiento referencia la versión exacta y, cuando el
    alcance lo exige, la relación asistencial concreta.
15. Las reglas de triaje son versionadas y cada evaluación conserva los
    resultados aplicados. Una evaluación de riesgo alto o crítico no recomienda
    modalidades comerciales; por eso la participación mínima es cero.
16. Cada evaluación referencia la decisión exacta que autorizó el tratamiento
    de sus respuestas. Si una oferta se acepta, la relación puede congelar como
    origen una única evaluación anterior a esa aceptación.
17. Auditoría, outbox e idempotencia forman un bloque conceptual de plataforma,
    separado del dominio clínico y comercial.

## 8. Trazabilidad y 3FN

La normalización pertenece al modelo relacional, no al DER conceptual. La
transformación objetivo mantiene 3FN porque cada atributo no clave dependerá
del identificador completo de su entidad o relación, no de otra propiedad
descriptiva. Los nombres, perfiles, modalidades y estados canónicos no se
duplican en solicitudes, ofertas, citas, conversaciones o historia clínica.

El núcleo operativo ya implementa las decisiones necesarias para roles,
procedencia de la oferta aceptada, relación asistencial, conversación, cita,
contexto clínico, consentimiento y reglas estructuradas de triaje. Las
extensiones de pagos, actores automáticos y planes por diagnóstico están delimitadas en
[`revision-decisiones-modelo-conceptual.md`](revision-decisiones-modelo-conceptual.md)
y permanecen fuera de los módulos habilitados hasta su fase correspondiente.

La demostración detallada se encuentra en
[`docs/database/normalization-3nf.md`](../../database/normalization-3nf.md). El
DER y ese documento deben entregarse juntos: uno explica la semántica y el otro
demuestra su implementación relacional normalizada.
