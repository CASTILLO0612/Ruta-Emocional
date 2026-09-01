# Verificación de recursos de seguridad por país

**Responsable operativo:** `PRODUCT_SAFETY_OWNER`. Debe existir una persona
titular y una suplente registradas en el sistema de operación, no en el código.

## Calendario

- revisión ordinaria trimestral;
- revisión extraordinaria dentro de 24 horas ante reporte de número/URL
  incorrecto, cambio institucional o incidente;
- prueba antes de cada release productivo que modifique países o recursos;
- escalamiento siete días antes de `reviewDueAt` y bloqueo al vencer.

Cada recurso de `TRIAGE_CRISIS_RESOURCES_JSON` exige `owner`, `verifiedAt` y
`reviewDueAt`. Producción no arranca con responsables vacíos, verificaciones
futuras o revisiones vencidas.

## Evidencia mínima

1. verificar el dato contra una fuente oficial primaria;
2. comprobar que el canal corresponde al propósito mostrado;
3. registrar URL, fecha UTC, responsable y método de comprobación;
4. ejecutar una segunda revisión independiente para cambios de teléfono;
5. actualizar configuración mediante revisión de código;
6. conservar el ticket sin datos de pacientes.

No se realizan llamadas de prueba a líneas de emergencia salvo que la autoridad
publique un procedimiento específico. La comprobación ordinaria se limita a
fuentes oficiales y canales administrativos autorizados.

## País inicial

Nicaragua permanece como único país configurado para el MVP. La próxima fecha
de revisión del ejemplo es 30 de noviembre de 2026. Añadir un país exige su
propio responsable, fuentes oficiales, calendario y aprobación profesional.
