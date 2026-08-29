# ADR-004 — Historia clínica cifrada, versionada y cerrada por defecto

- **Estado:** aceptado para el MVP técnico
- **Fecha:** 28 de agosto de 2026
- **Alcance:** Fase 7

## Contexto

La historia clínica contiene información de máxima sensibilidad. Un rol de
psicólogo o administrador no es suficiente para justificar acceso, y actualizar
una nota firmada destruiría trazabilidad clínica. El alcance legal de campos,
retención, exportación y acceso del paciente sigue pendiente de aprobación.

## Decisión

1. PostgreSQL es la fuente canónica y el modelo conserva al menos 3FN.
2. Cada encuentro referencia la relación asistencial que justificó el acceso.
3. La vista del profesional solo incluye contenido escrito por él dentro de una
   relación activa; compartir entre profesionales queda cerrado.
4. El contenido y los motivos clínicos se cifran antes de persistir con
   AES-256-GCM. El AAD vincula cada sobre al tipo de recurso, identificador y,
   cuando corresponde, versión para impedir intercambiar ciphertext entre
   registros.
5. El formato `vN.nonce.tag.ciphertext` permite seleccionar una llave de un
   llavero versionado. Solo la versión activa cifra; versiones anteriores pueden
   descifrar durante una rotación controlada.
6. Un borrador se actualiza agregando otra versión. Firmar cambia el estado sin
   reescribir contenido. Corregir una nota firmada agrega una enmienda con motivo.
7. PostgreSQL rechaza `UPDATE` y `DELETE` sobre versiones y eventos clínicos.
8. Todas las lecturas de contenido y mutaciones generan auditoría sin texto ni
   motivos clínicos.
9. Paciente, administrador y profesional ajeno quedan denegados. Exportación,
   diagnóstico, adjuntos y acceso del paciente no se habilitan por inferencia.

## Consecuencias

- comprometer únicamente una copia de la base no revela los textos sin el
  llavero, aunque metadatos relacionales siguen siendo sensibles;
- perder una versión de llave vuelve ilegibles los sobres correspondientes, por
  lo que backup y rotación de KMS son críticos;
- no existe búsqueda de texto completo sobre contenido cifrado;
- las enmiendas aumentan almacenamiento de forma deliberada;
- una relación finalizada cierra el acceso ordinario sin eliminar el expediente;
- la exportación requerirá un proceso separado, autenticación reciente, propósito
  y política legal aprobada.

## Alternativas descartadas

- guardar una historia completa como JSON: rompe relaciones, concurrencia y 3FN;
- cifrar en el cliente móvil: dificulta control de acceso, rotación y auditoría
  del servidor;
- permitir edición directa de una nota firmada: elimina evidencia histórica;
- permitir acceso administrativo global: contradice mínimo privilegio y propósito.
