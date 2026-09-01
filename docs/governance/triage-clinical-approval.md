# Aprobación profesional del protocolo MENTA

**Estado:** pendiente de firma profesional. Este documento define la evidencia;
no constituye una aprobación clínica.

## Alcance inseparable de la aprobación

La persona revisora debe evaluar como un solo artefacto versionado:

- las seis preguntas y todas sus opciones cerradas;
- necesidades, resúmenes deterministas y modalidades;
- las reglas, disparadores y niveles `LOW`, `MODERATE`, `HIGH` y `CRITICAL`;
- el consentimiento exacto que verá el paciente;
- los avisos de automatización, no diagnóstico y no emergencia;
- las acciones de seguridad para riesgo alto y crítico;
- la decisión de no usar un proveedor externo en el MVP.

El backend exporta el artefacto canónico desde PostgreSQL y la configuración:

```powershell
cd backend
npm run triage:protocol-artifact > ../docs/governance/triage-protocol-review.json
```

El archivo contiene `artifactSha256`. La aprobación debe referenciar exactamente
esa huella, `TRIAGE_EVALUATOR_VERSION`, código y versión de consentimiento. En
producción, el servidor vuelve a calcular la huella y rechaza el arranque si el
cuestionario, una regla o un mensaje cambió.

## Lista de revisión profesional

- [ ] El lenguaje es comprensible, neutral y no estigmatizante.
- [ ] Ninguna salida afirma diagnóstico, prescripción o certeza clínica.
- [ ] Cada opción de riesgo tiene una clasificación y respuesta segura.
- [ ] `HIGH` y `CRITICAL` eliminan recomendaciones comerciales.
- [ ] Los mensajes no prometen contacto automático con emergencias.
- [ ] Las acciones permiten buscar ayuda sin depender de MENTA.
- [ ] La minimización de datos es suficiente para el propósito declarado.
- [ ] El consentimiento explica automatización, uso, compartición y límites.
- [ ] Los recursos del país fueron revisados por su responsable operativo.
- [ ] La fecha de expiración obliga a una revisión periódica.

## Registro que debe emitir la persona revisora

| Campo | Valor requerido |
|---|---|
| ID de aprobación | identificador único del expediente de revisión |
| Revisor/a | nombre, profesión y registro verificable |
| Artefacto SHA-256 | 64 caracteres hexadecimales |
| Evaluador | versión exacta |
| Consentimiento | código y versión exactos |
| Decisión | aprobado / requiere cambios / rechazado |
| Fecha de aprobación | instante ISO-8601 |
| Fecha de expiración | instante ISO-8601 posterior |
| Observaciones | riesgos residuales y condiciones |
| Firma | mecanismo institucional aprobado |

Una decisión aprobada se configura mediante `TRIAGE_PROTOCOL_APPROVAL_JSON`.
No se debe establecer `TRIAGE_PROTOCOL_APPROVED=true` sin conservar el registro
firmado fuera del repositorio.

## Invalidación

La aprobación deja de ser válida si cambia cualquiera de estos elementos:
artefacto SHA-256, evaluador, consentimiento, reglas, preguntas, necesidades,
resúmenes o mensajes de seguridad. También expira en la fecha registrada o
cuando se reporta un incidente clínico que afecte el protocolo.
