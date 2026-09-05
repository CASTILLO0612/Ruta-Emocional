# Entregable Aficionado / Desarrollo

Este directorio reúne la evidencia verificable de Ruta Emocional para la categoría **Aficionado**, área **Desarrollo**. El alcance se limita deliberadamente a esa rúbrica; no se reclaman entregables de la categoría Avanzado.

## Matriz de cumplimiento

| Requisito de Desarrollo | Evidencia | Estado |
|---|---|---|
| Matriz integral de aceptación | [Trazabilidad de los nueve apartados y compuerta de QA](matriz-cumplimiento-entrega.md) | Completa |
| Planteamiento y comprensión del problema | [Problema, actores, solución, límites y criterios de éxito](planteamiento-y-comprension-del-problema.md) | Completo y trazable al MVP |
| README técnico: descripción, tecnologías, instalación y ejecución | [`README.md` del proyecto](../../../README.md) | Completo |
| Diagrama de base de datos: modelo ER básico y al menos 2FN | [DER conceptual completo](../../../output/pdf/modelo-entidad-relacion-conceptual-ruta-emocional.pdf), [catálogo y criterio](modelo-entidad-relacion-conceptual.md), [decisiones revisadas](revision-decisiones-modelo-conceptual.md), [evidencia 3FN](../../database/normalization-3nf.md) | Completo; supera el mínimo de normalización |
| Interfaces navegables y formularios funcionales | [Evidencia de interfaz y formularios](evidencia-interfaz-y-formularios.md), [evidencia final del refactor visual](evidencia-refactor-visual-final.md) | Completo para el recorrido seleccionado |
| Uso básico de GitHub con commits legibles y operaciones Commit/Push/Pull | [Evidencia de control de versiones](evidencia-control-versiones.md) | Completo al sincronizar esta entrega |
| Código limpio y definición de tres roles o permisos | [Roles y permisos](roles-y-permisos.md), [matriz completa](../../security/authorization-matrix.md) | Completo |
| Ejecución local e instrucciones básicas | [Instalación y ejecución](../../../README.md#instalación) | Completo |
| Video de navegación | Lo prepara el responsable del proyecto, según el alcance acordado | Fuera de esta entrega técnica |

## Entregable principal de base de datos

El archivo [`modelo-entidad-relacion-conceptual-ruta-emocional.pdf`](../../../output/pdf/modelo-entidad-relacion-conceptual-ruta-emocional.pdf) contiene:

- 43 entidades conceptuales con cada atributo declarado en un óvalo propio;
- 72 asociaciones semánticas con cardinalidad y participación;
- una jerarquía `ISA` parcial y superpuesta para Usuario, Paciente y Psicólogo;
- 7 relaciones N:N conservadas explícitamente en el nivel conceptual;
- cobertura trazable de los 58 modelos Prisma vigentes, distinguiendo estructuras lógicas auxiliares;
- separación de su resolución mediante estructuras asociativas en el modelo lógico;
- exclusión explícita de tablas, tipos SQL, llaves foráneas, índices, triggers y detalles del motor.

La representación se mantiene conceptual. El modelo relacional y la demostración de tercera forma normal se documentan por separado para no mezclar niveles de abstracción.

La [`trazabilidad del modelo vigente`](trazabilidad-modelo-vigente.md) clasifica
uno por uno los 58 modelos Prisma como entidad, subtipo, asociación materializada,
catálogo lógico o estructura técnica. Así se demuestra cobertura sin convertir
el DER en una captura del esquema físico.

La [`revisión de decisiones conceptuales`](revision-decisiones-modelo-conceptual.md)
resuelve las 62 observaciones de cardinalidad, temporalidad, autoría, alcance y
catálogos. La alineación del núcleo operativo se implementó mediante una
migración incremental; las extensiones fuera del recorrido se mantienen
delimitadas y no se presentan como funcionalidad terminada.

## Recorrido funcional que se presenta

1. Registrar una cuenta de paciente y otra de psicólogo.
2. Completar el perfil del psicólogo y adjuntar una evidencia de prueba.
3. Aprobar la solicitud desde el administrador local.
4. Crear una solicitud de atención desde el paciente.
5. Presentar y aceptar una oferta.
6. Abrir la conversación autorizada.
7. Reservar o gestionar una cita.
8. Crear un encuentro y una nota clínica con datos ficticios.
9. Completar la orientación MENTA y revisar desde el expediente profesional el
   resultado congelado al aceptar una oferta.
10. Consultar MENTA como agente contextual de paciente o psicólogo con
    herramientas de lectura autorizadas.

Pagos y llamadas no forman parte de este recorrido. El triaje de MENTA usa
reglas deterministas persistidas. Su agente contextual es una capacidad
separada, con conversaciones cifradas y herramientas de lectura autorizadas;
una indisponibilidad del proveedor se presenta como contingencia y no como una
respuesta de IA simulada.

## Comprobación rápida

Desde la raíz del repositorio:

```bash
npm run db:validate
npm run quality:delivery
```

La prueba manual de verificación profesional está descrita en [`docs/runbooks/local-professional-verification.md`](../../runbooks/local-professional-verification.md).
