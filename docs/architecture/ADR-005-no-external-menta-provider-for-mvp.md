# ADR-005 — Sin proveedor externo para MENTA en el MVP

## Estado

**Reemplazado parcialmente el 1 de septiembre de 2026 por ADR-006.**

La decisión continúa vigente para el cuestionario de triaje: su clasificación,
reglas y mensajes de crisis permanecen deterministas. La prohibición general de
un agente contextual externo fue reemplazada después de aclarar el alcance de
producto y establecer límites técnicos separados.

## Decisión

El triaje de MENTA usa exclusivamente el motor determinista, versionado y
auditable durante el MVP. `TRIAGE_EXTERNAL_PROVIDER_ENABLED` debe permanecer en
`false` en producción y el gate de arranque rechaza lo contrario.

## Motivo

Un proveedor generativo no aporta valor clínico demostrado al cuestionario
cerrado actual. Añadirlo aumentaría variabilidad, transferencia de datos,
contratos, residencia, retención, evaluación clínica y superficie de incidente.
El resumen determinista ya satisface el propósito de orientación sin diagnóstico.

## Consecuencias

- no se envían respuestas ni categorías a terceros;
- no existe costo, indisponibilidad o deriva de modelo externo;
- las reglas y salidas pueden aprobarse como un artefacto exacto;
- la interfaz de triaje no afirma usar IA generativa;
- una propuesta de agente contextual requiere ADR nuevo, evidencia de valor,
  evaluación de privacidad, contrato, residencia, pruebas de seguridad y
  comparación contra el baseline determinista.
