# Modelo entidad-relación conceptual de Ruta Emocional

## 1. Propósito

Este documento consolida el significado de la información manejada por Ruta
Emocional. El diagrama asociado es un **modelo entidad-relación conceptual**:
describe los conceptos del dominio, sus características, las asociaciones del
negocio, la cardinalidad y la participación. No es una captura de tablas.

La fuente canónica usada para comprobar la cobertura es
[`backend/prisma/schema.prisma`](../../../backend/prisma/schema.prisma), con 48
modelos de aplicación y 18 migraciones aplicadas. PostgreSQL también contiene
`spatial_ref_sys`, tabla técnica administrada por PostGIS que no pertenece al
dominio y se excluye del DER.

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
- la especialización de `Usuario` en `Paciente` y `Psicólogo` se expresa como
  una asociación conceptual con cardinalidad uno a cero-o-uno.

No se incluyen tipos SQL, longitudes, columnas foráneas, nombres `snake_case`,
índices, triggers, políticas de borrado, cifrado ni detalles de Prisma. Esos
elementos pertenecen al modelo relacional o físico y se documentan por separado
en [`normalization-3nf.md`](../../database/normalization-3nf.md).

Fuentes metodológicas:

- [Peter P. Chen, The Entity-Relationship Model (ACM, 1976)](https://doi.org/10.1145/320434.320440)
- [IBM, What is data modeling?](https://www.ibm.com/think/topics/data-modeling)
- [Oracle, Data Modeler Concepts and Usage](https://docs.oracle.com/en/database/oracle/sql-developer-data-modeler/20.3/dmdug/data-modeler-concepts-usage.html)

## 3. Resultado de la consolidación

Los 48 modelos persistidos se expresan como:

- **38 tipos de entidad conceptual** con identidad o ciclo de vida propio;
- **10 relaciones conceptuales** que PostgreSQL implementa mediante tablas de
  asociación para preservar 3FN;
- **56 asociaciones semánticas** con cardinalidad y participación definidas;
- **20 dominios de estado o clasificación**, representados como atributos y no
  como entidades artificiales.

## 4. Catálogo de entidades conceptuales

Los identificadores enumerados son conceptuales. No implican que el DER esté
exponiendo una llave primaria física.

| Área | Entidad | Identificador | Atributos significativos |
|---|---|---|---|
| Identidad | Usuario | Identificador de usuario | correo, nombre visible, foto, teléfono, estado, alta, actualización |
| Identidad | Rol | Código de rol | nombre, descripción |
| Identidad | Sesión | Identificador de sesión | credencial de renovación protegida, dispositivo, dirección de red, agente, expiración, revocación, creación |
| Identidad | Paciente | Identificador de paciente | fecha de nacimiento, alta, actualización |
| Identidad | Psicólogo | Identificador de psicólogo | estado de verificación, presentación, ubicación aproximada, alta, actualización |
| Directorio | Licencia profesional | Autoridad + número | estado, referencia de evidencia, fecha de verificación, creación |
| Directorio | Especialidad | Código de especialidad | nombre, vigencia |
| Directorio | Configuración de modalidad | Psicólogo + modalidad | precio por hora, moneda, habilitación |
| Verificación | Solicitud de verificación | Identificador de solicitud | referencia privada de evidencia, fecha de envío |
| Verificación | Decisión de verificación | Identificador de decisión | resultado, motivo público, motivo interno, fecha |
| Disponibilidad | Regla de disponibilidad | Identificador de regla | día, hora inicial, hora final, zona horaria, vigencia, estado |
| Disponibilidad | Excepción de disponibilidad | Identificador de excepción | inicio, fin, tipo, motivo |
| Atención | Solicitud de atención | Identificador de solicitud | modalidad, necesidad, descripción, presupuesto, moneda, estado, programación, vencimiento, ubicación temporal, fechas |
| Atención | Oferta | Identificador de oferta | importe, mensaje, estado, fechas |
| Atención | Relación asistencial | Identificador de relación | estado, inicio, finalización |
| Agenda | Cita | Identificador de cita | modalidad, inicio, fin, zona horaria, estado, motivo de cancelación, fechas |
| Agenda | Evento de cita | Identificador de evento | tipo, estado anterior, estado nuevo, intervalo anterior, motivo, fecha |
| Reputación | Reseña | Identificador de reseña | puntuación, comentario, fecha |
| Mensajería | Conversación | Identificador de conversación | fecha de creación |
| Mensajería | Participación | Identificador de participación | ingreso, salida |
| Mensajería | Mensaje | Identificador de mensaje | identificador del cliente, tipo, contenido, envío, edición |
| Clínica | Expediente clínico | Identificador de expediente | estado, apertura, cierre |
| Clínica | Encuentro clínico | Identificador de encuentro | inicio, fin, motivo, creación |
| Clínica | Nota clínica | Identificador de nota | estado, firma, creación, actualización |
| Clínica | Versión de nota | Nota + número de versión | contenido, motivo de enmienda, creación |
| Clínica | Evento de nota | Identificador de evento | tipo, estado anterior, estado nuevo, versión, fecha |
| Clínica | Concepto diagnóstico | Sistema de código + código | nombre |
| Clínica | Diagnóstico clínico | Identificador de diagnóstico | estado, observaciones, fecha |
| Clínica | Plan de tratamiento | Identificador de plan | estado, resumen, inicio, fin, fechas |
| Clínica | Objetivo terapéutico | Identificador de objetivo | descripción, fecha meta, estado |
| Consentimiento | Documento de consentimiento | Código + versión | título, huella del contenido, publicación |
| Consentimiento | Decisión de consentimiento | Identificador de decisión | decisión, fecha, dirección de red |
| Orientación | Evaluación de triaje | Identificador de evaluación | proveedor, modelo, versión de reglas, necesidad, modalidad sugerida, rango presupuestario, resumen, riesgo, revisión, creación |
| Pagos | Pago | Identificador de pago | importe, moneda, método referenciado, transacción, estado, fechas |
| Pagos | Evento de pago | Identificador de evento | estado anterior, estado nuevo, referencia externa, fecha |
| Plataforma | Evento de auditoría | Identificador de evento | acción, tipo y referencia del recurso, petición, dirección de red, metadatos, fecha |
| Plataforma | Evento de salida | Identificador de evento | agregado referenciado, tipo, contenido técnico, disponibilidad, publicación, intentos, error |
| Plataforma | Registro de idempotencia | Actor + operación + clave | huella de petición, recurso resultante, creación, expiración |

## 5. Catálogo de relaciones y cardinalidades

La columna `B por cada A` indica cuántas instancias de B pueden relacionarse con
una instancia de A. `A por cada B` expresa la dirección inversa.

### 5.1 Identidad, perfiles y directorio

| Entidad A | Relación | Entidad B | B por cada A | A por cada B |
|---|---|---|---:|---:|
| Usuario | tiene asignado | Rol | 1..N | 0..N |
| Usuario | mantiene | Sesión | 0..N | 1 |
| Usuario | se especializa como | Paciente | 0..1 | 1 |
| Usuario | se especializa como | Psicólogo | 0..1 | 1 |
| Psicólogo | acredita | Licencia profesional | 1..N | 1 |
| Psicólogo | ejerce en | Especialidad | 0..N | 0..N |
| Psicólogo | configura | Configuración de modalidad | 0..N | 1 |
| Licencia profesional | recibe | Solicitud de verificación | 0..N | 1 |
| Solicitud de verificación | se resuelve mediante | Decisión de verificación | 0..1 | 1 |
| Usuario | revisa | Decisión de verificación | 0..N | 1 |
| Psicólogo | define | Regla de disponibilidad | 0..N | 1 |
| Psicólogo | registra | Excepción de disponibilidad | 0..N | 1 |

Las especializaciones de `Usuario` son parciales y solapables en el modelo
actual: un administrador puede no tener perfil y la base no impone que Paciente
y Psicólogo sean excluyentes.

### 5.2 Atención, agenda, pagos y reputación

| Entidad A | Relación | Entidad B | B por cada A | A por cada B |
|---|---|---|---:|---:|
| Paciente | crea | Solicitud de atención | 0..N | 1 |
| Solicitud de atención | recibe | Oferta | 0..N | 1 |
| Psicólogo | presenta | Oferta | 0..N | 1 |
| Paciente | participa en | Relación asistencial | 0..N | 1 |
| Psicólogo | participa en | Relación asistencial | 0..N | 1 |
| Solicitud de atención | origina | Relación asistencial | 0..1 | 0..1 |
| Paciente | agenda | Cita | 0..N | 1 |
| Psicólogo | atiende | Cita | 0..N | 1 |
| Solicitud de atención | origina | Cita | 0..1 | 0..1 |
| Relación asistencial | contextualiza | Cita | 0..N | 0..1 |
| Cita | registra | Evento de cita | 1..N | 1 |
| Usuario | ejecuta | Evento de cita | 0..N | 1 |
| Cita | recibe | Reseña | 0..1 | 1 |
| Oferta | genera | Pago | 0..1 | 1 |
| Pago | registra | Evento de pago | 0..N | 1 |

### 5.3 Conversaciones y mensajes

| Entidad A | Relación | Entidad B | B por cada A | A por cada B |
|---|---|---|---:|---:|
| Solicitud de atención | abre | Conversación | 0..1 | 0..1 |
| Cita | dispone de | Conversación | 0..1 | 0..1 |
| Conversación | incluye | Participación | 2..N | 1 |
| Usuario | asume | Participación | 0..N | 1 |
| Participación | envía | Mensaje | 0..N | 1 |

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
| Usuario | redacta | Versión de nota | 0..N | 1 |
| Nota clínica | registra | Evento de nota | 1..N | 1 |
| Usuario | ejecuta | Evento de nota | 0..N | 1 |
| Expediente clínico | contiene | Diagnóstico clínico | 0..N | 1 |
| Concepto diagnóstico | clasifica | Diagnóstico clínico | 0..N | 1 |
| Psicólogo | formula | Diagnóstico clínico | 0..N | 1 |
| Encuentro clínico | sustenta | Diagnóstico clínico | 0..N | 0..1 |
| Expediente clínico | organiza | Plan de tratamiento | 0..N | 1 |
| Psicólogo | dirige | Plan de tratamiento | 0..N | 1 |
| Plan de tratamiento | define | Objetivo terapéutico | 1..N | 1 |

### 5.5 Consentimiento, orientación y plataforma

| Entidad A | Relación | Entidad B | B por cada A | A por cada B |
|---|---|---|---:|---:|
| Paciente | expresa | Decisión de consentimiento | 0..N | 1 |
| Documento de consentimiento | fundamenta | Decisión de consentimiento | 0..N | 1 |
| Paciente | recibe | Evaluación de triaje | 0..N | 1 |
| Psicólogo | revisa | Evaluación de triaje | 0..N | 0..1 |
| Evaluación de triaje | informa | Solicitud de atención | 0..1 | 0..N |
| Usuario | origina | Evento de auditoría | 0..N | 0..1 |
| Usuario | delimita | Registro de idempotencia | 0..N | 1 |

`Evento de salida` conserva una referencia polimórfica al agregado que originó
el evento. No se dibuja una relación ficticia con todas las entidades porque no
existe una asociación única de dominio ni una llave foránea correspondiente.

## 6. Tablas de asociación que vuelven a ser relaciones

Esta tabla demuestra por qué el DER no es una copia del modelo relacional.

| Modelo Prisma | Representación conceptual | Atributo propio de la relación |
|---|---|---|
| `UserRole` | Usuario tiene asignado Rol | fecha de asignación |
| `PsychologistSpecialty` | Psicólogo ejerce en Especialidad | indicador de especialidad principal |
| `CareRelationshipSource` | Solicitud origina Relación asistencial | ninguno |
| `AppointmentRequest` | Solicitud origina Cita | ninguno |
| `AppointmentCareRelationship` | Relación asistencial contextualiza Cita | ninguno |
| `ClinicalEncounterAppointment` | Cita se materializa como Encuentro | ninguno |
| `ClinicalDiagnosisSource` | Encuentro sustenta Diagnóstico | ninguno |
| `RequestConversation` | Solicitud abre Conversación | ninguno |
| `AppointmentConversation` | Cita dispone de Conversación | ninguno |
| `RequestTriageAssessment` | Evaluación de triaje informa Solicitud | ninguno |

## 7. Reglas de integridad visibles en el DER

1. Una sesión siempre pertenece a un único usuario.
2. Una oferta pertenece a una solicitud y al psicólogo que la presenta.
3. Una relación asistencial siempre vincula exactamente un paciente y un
   psicólogo.
4. Una cita siempre tiene paciente y psicólogo; su solicitud y relación de
   origen son opcionales.
5. Una conversación de atención se vincula como máximo a una solicitud o a una
   cita según su contexto.
6. Un expediente pertenece a un solo paciente y un paciente tiene como máximo
   un expediente.
7. Las versiones y eventos nunca sustituyen el contenido histórico de una nota.
8. Un encuentro nuevo requiere la relación asistencial que autoriza al
   psicólogo a atender ese expediente.
9. Una decisión de consentimiento siempre referencia la versión exacta del
   documento aceptado o retirado.
10. Auditoría, outbox e idempotencia son registros técnicos; no se convierten en
    fuentes duplicadas de los agregados del negocio.

## 8. Trazabilidad y 3FN

La normalización pertenece al modelo relacional, no al DER conceptual. La
traducción mantiene 3FN porque cada atributo no clave depende del identificador
de su entidad o de la relación completa, no de otra propiedad descriptiva. Los
nombres, perfiles y estados canónicos no se duplican en solicitudes, ofertas,
citas, conversaciones o historia clínica.

La demostración detallada se encuentra en
[`docs/database/normalization-3nf.md`](../../database/normalization-3nf.md). El
DER y ese documento deben entregarse juntos: uno explica la semántica y el otro
demuestra su implementación relacional normalizada.
