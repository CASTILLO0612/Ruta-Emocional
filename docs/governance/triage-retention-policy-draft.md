# Política de retención, revocación y eliminación de MENTA

**Estado:** borrador técnico para revisión legal. `TRIAGE_RETENTION_POLICY_APPROVED`
debe permanecer en `false` hasta recibir aprobación formal.

## Principios implementados

- consentimiento y evaluaciones son históricos y no se sobrescriben;
- retirar consentimiento crea una decisión `WITHDRAWN` con fecha efectiva;
- la revocación bloquea procesamiento profesional y comercial nuevo;
- solicitar eliminación crea una petición `BLOCKED` y un vencimiento de cinco
  días hábiles; no ejecuta un borrado directo;
- la resolución debe evaluar conservación obligatoria, terceros, salud pública,
  disputas, auditoría y backups antes de eliminar o denegar;
- toda decisión se audita sin copiar respuestas ni contenido sensible.

La Ley nicaragüense N.º 787 establece que el consentimiento puede revocarse sin
efectos retroactivos y reconoce derechos de acceso, rectificación, supresión y
cancelación. También fija un plazo de cinco días hábiles para atender la
solicitud y contempla conservación y excepciones que requieren revisión, no un
borrado automático. Fuente primaria: [Ley N.º 787, Asamblea Nacional de
Nicaragua](https://legislacion.asamblea.gob.ni/normaweb.nsf/9e314815a08d4a6206257265005d21f9/e5d37e9b4827fc06062579ed0076ce1d).

La confidencialidad y acceso limitado a personal autorizado también deben
alinearse con la normativa sanitaria aplicable: [Reglamento de la Ley General de
Salud, Asamblea Nacional](https://legislacion.asamblea.gob.ni/Normaweb.nsf/%28%24All%29/0F963CAE75EBD5DC0625715A005C0DC9).

## Matriz propuesta

| Categoría | Estado técnico | Plazo propuesto | Acción al vencer | Excepciones |
|---|---|---:|---|---|
| consentimiento MENTA | append-only | 5 años | revisión/anonimización autorizada | prueba de consentimiento, disputa, obligación legal |
| evaluación estructurada | inmutable | 5 años desde creación | eliminación o anonimización por job autorizado | vínculo clínico, salud pública, litigio, legal hold |
| solicitud de eliminación | append-only | 5 años desde resolución | conservar evidencia mínima | auditoría regulatoria |
| auditoría asociada | append-only | por definir legalmente | ciclo de retención separado | seguridad e investigación |
| copias de seguridad | cifradas | ventana técnica aprobada | expiración criptográfica/ciclo del proveedor | legal hold |

Los `1825` días del ejemplo son una hipótesis de trabajo, no autorización legal.

## Flujo de solicitud

```text
BLOCKED -> UNDER_REVIEW -> RESOLVED
                         -> DENIED
```

`BLOCKED` significa que no se permite una nueva aceptación de oferta ni nueva
lectura profesional de la evaluación. Sólo un proceso de privacidad con rol
separado podrá pasar a `UNDER_REVIEW` y registrar resolución, base aplicada,
actor y fecha. La identidad runtime ordinaria no posee `UPDATE` ni `DELETE`
sobre estas solicitudes.

## Pendientes para aprobar

- confirmar jurisdicción, mayores/menores y representante legal;
- definir si MENTA forma parte del expediente clínico cuando se acepta oferta;
- aprobar plazos de auditoría, backups y solicitudes resueltas;
- definir anonimización verificable y propagación a réplicas/backups;
- definir legal hold, apelación y comunicación al titular;
- asignar responsable de privacidad y mecanismo de autenticación reforzada.
