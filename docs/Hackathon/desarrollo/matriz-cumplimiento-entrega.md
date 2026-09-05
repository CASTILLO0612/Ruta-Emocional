# Matriz de cumplimiento y aceptación de la entrega

## 1. Objetivo

Esta matriz convierte la rúbrica Aficionado / Desarrollo en criterios
verificables. Un apartado se considera cerrado únicamente cuando existe una
fuente de verdad, evidencia rastreable y una forma reproducible de validarlo.

## 2. Cobertura

| # | Apartado | Evidencia principal | Criterio de aceptación | Estado |
|---:|---|---|---|---|
| 1 | Planteamiento y comprensión del problema | [problema, actores, riesgos, solución y límites](planteamiento-y-comprension-del-problema.md) | El problema se explica antes de la tecnología y cada capacidad del MVP responde a un dolor identificado. | Cumple |
| 2 | Arquitectura y estructura | [ADR PostgreSQL y Clean Architecture](../../architecture/ADR-001-postgresql-clean-architecture.md), [README técnico](../../../README.md) | Presentación, aplicación, dominio e infraestructura tienen responsabilidades separadas y las excepciones están documentadas. | Cumple |
| 3 | Evidencia funcional | [interfaces y formularios](evidencia-interfaz-y-formularios.md), [recorrido visual](evidencia-refactor-visual-final.md) | Existe un recorrido navegable con formularios, validación, estados y persistencia PostgreSQL. | Cumple |
| 4 | Seguridad, rendimiento y buenas prácticas | [seguridad y privacidad](../../security/security-and-privacy.md), [modelo de amenazas](../../security/threat-model.md), [matriz de autorización](../../security/authorization-matrix.md) | Autorización del servidor, sesiones seguras, límites, cifrado sensible, idempotencia, índices y consultas acotadas están documentados y probados. | Cumple para el MVP; gates productivos explícitos |
| 5 | Migración y consolidación PostgreSQL | [ADR de migración](../../architecture/ADR-001-postgresql-clean-architecture.md), [23 migraciones inmutables](../../../backend/prisma/migrations) | PostgreSQL es la única fuente transaccional del runtime y todas las migraciones aplican desde una base vacía. | Cumple |
| 6 | Normalización mínima 3FN | [demostración de 3FN](../../database/normalization-3nf.md) | Se documentan dependencias funcionales, claves candidatas, asociaciones y duplicaciones eliminadas. | Cumple; supera 2FN |
| 7 | Entidades, atributos, relaciones y reglas | [catálogo conceptual](modelo-entidad-relacion-conceptual.md), [62 decisiones](revision-decisiones-modelo-conceptual.md) | Cada concepto tiene identificador y atributos; las relaciones incluyen verbo, participación, cardinalidad y reglas de integridad. | Cumple |
| 8 | DER conceptual | [PDF final](../../../output/pdf/modelo-entidad-relacion-conceptual-ruta-emocional.pdf), [trazabilidad de 58 modelos](trazabilidad-modelo-vigente.md) | Usa notación de Chen, conserva ISA y N:N, y excluye tablas, FK, tipos SQL, índices y detalles físicos. | Cumple |
| 9 | Evidencias técnicas para Hackathon | [control de versiones](evidencia-control-versiones.md), [evidencia de QA](evidencia-refactor-visual-final.md) | Comandos, resultados, capturas, restricciones de datos ficticios y alcance de la demo son reproducibles. | Cumple; video a cargo del equipo |

## 3. Consistencia cuantitativa del corte

| Control | Valor vigente | Fuente |
|---|---:|---|
| Modelos Prisma | 58 | `backend/prisma/schema.prisma` |
| Dominios enumerados | 27 | `backend/prisma/schema.prisma` |
| Migraciones versionadas | 23 | `backend/prisma/migrations/` |
| Entidades conceptuales | 43 | DER y catálogo conceptual |
| Relaciones conceptuales | 72 | DER y catálogo conceptual |
| Relaciones N:N conservadas | 7 | DER y sección de transformación lógica |
| Roles de aplicación | 4 | paciente, psicólogo, administrador y auditor clínico |

## 4. Compuerta de aceptación técnica

Desde la raíz, el corte debe aprobar:

```bash
npm run quality:delivery
```

La primera comprobación del comando contrasta automáticamente los 58 modelos
Prisma con la cobertura 3FN y la trazabilidad conceptual, valida los conteos de
migraciones y enumeraciones, comprueba la cabecera del PDF y falla si Git está
rastreando los documentos privados excluidos de la entrega.

La integración HTTP requiere una base PostgreSQL aislada y se ejecuta con:

```bash
TEST_DATABASE_URL=<url_exclusiva_de_pruebas> npm --prefix backend run test:integration
```

No se usa la base de desarrollo para integración destructiva. Antes de entregar
también deben aprobar `git diff --check`, el estado de migraciones y la revisión
visual del PDF renderizado página por página.

## 5. Alcance honesto

La calificación técnica de este paquete no equivale a una declaración de
producción clínica. Proveedores externos, revisión legal, antimalware,
observabilidad externa, backup/restauración ensayados y aceptación completa en
Android real siguen siendo compuertas productivas. Están documentadas para que
el jurado pueda distinguir un MVP sólido de afirmaciones no verificadas.
