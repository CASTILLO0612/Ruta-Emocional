# ADR-005 — Sin proveedor externo para MENTA en el MVP

## Estado

**Aceptado el 31 de agosto de 2026.**

## Decisión

MENTA usa exclusivamente el motor determinista, versionado y auditable durante
el MVP. `TRIAGE_EXTERNAL_PROVIDER_ENABLED` debe permanecer en `false` en
producción y el gate de arranque rechaza lo contrario.

## Motivo

Un proveedor generativo no aporta valor clínico demostrado al cuestionario
cerrado actual. Añadirlo aumentaría variabilidad, transferencia de datos,
contratos, residencia, retención, evaluación clínica y superficie de incidente.
El resumen determinista ya satisface el propósito de orientación sin diagnóstico.

## Consecuencias

- no se envían respuestas ni categorías a terceros;
- no existe costo, indisponibilidad o deriva de modelo externo;
- las reglas y salidas pueden aprobarse como un artefacto exacto;
- la interfaz no afirma usar IA generativa;
- una futura propuesta requiere ADR nuevo, evidencia de beneficio clínico,
  evaluación de privacidad, contrato, residencia, pruebas de seguridad y
  comparación contra el baseline determinista.
