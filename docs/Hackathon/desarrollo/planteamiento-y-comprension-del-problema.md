# Planteamiento y comprensión del problema

## 1. Problema que aborda Ruta Emocional

Buscar acompañamiento psicológico puede convertirse en un proceso fragmentado:
la persona debe identificar profesionales, comprobar que sean legítimos,
explicar qué tipo de atención necesita, coordinar disponibilidad y conservar la
continuidad de sus citas y conversaciones. Al mismo tiempo, el profesional
necesita recibir solicitudes compatibles, proteger la información sensible y
documentar la atención sin depender de canales dispersos.

Ruta Emocional parte de una hipótesis de producto concreta: una plataforma
única, con profesionales verificados y reglas transparentes, puede reducir esa
fricción operativa sin sustituir el criterio clínico. El mercado inicial asumido
es Nicaragua; esa decisión se refleja en referencias a MINSA, precios en
córdobas, recursos locales y verificación por país. Antes de utilizar datos de
personas reales todavía se requiere validación jurídica, clínica y operativa.

## 2. Personas y necesidades

| Actor | Necesidad principal | Riesgo que debe evitarse |
|---|---|---|
| Paciente | Encontrar atención compatible, solicitarla y mantener continuidad | Exposición de información sensible, profesionales no verificados o decisiones clínicas automatizadas |
| Psicólogo pendiente | Crear su cuenta y demostrar sus credenciales | Aparecer públicamente o acceder a pacientes antes de la aprobación |
| Psicólogo verificado | Gestionar solicitudes, agenda, comunicación e historia clínica autorizada | Acceder a personas sin relación asistencial o perder trazabilidad clínica |
| Administrador | Verificar credenciales y operar el sistema | Obtener acceso clínico implícito por su rol administrativo |
| Auditor clínico | Revisar información bajo una finalidad aprobada | Acceso permanente, indiscriminado o sin auditoría |

## 3. Propuesta de solución

El recorrido demostrable integra:

1. registro e inicio de sesión;
2. incorporación y verificación profesional;
3. directorio de psicólogos habilitados;
4. solicitudes y ofertas transparentes;
5. creación de una relación asistencial al aceptar una oferta;
6. conversación longitudinal autorizada;
7. agenda con prevención de solapamientos;
8. expediente y notas clínicas versionadas;
9. MENTA como agente contextual de apoyo, separado del triaje determinista.

PostgreSQL es la fuente de verdad. El backend decide identidad, autorización,
estados, precios y acceso clínico; el frontend presenta esas decisiones y no
otorga permisos por sí mismo.

## 4. Límites deliberados

Ruta Emocional facilita el acceso y la continuidad, pero:

- no reemplaza al psicólogo ni a los servicios de emergencia;
- no diagnostica ni prescribe mediante inteligencia artificial;
- no habilita pagos ni llamadas reales hasta seleccionar y validar proveedores;
- no utiliza información clínica para publicidad o posicionamiento comercial;
- no se presenta como producto clínico listo para producción mientras existan
  gates jurídicos, clínicos, operativos y de infraestructura abiertos.

Estos límites evitan que una demostración tecnológica prometa capacidades que
el sistema aún no puede sostener.

## 5. Criterios de éxito del entregable

El corte Aficionado / Desarrollo se considera comprobable cuando:

- una instalación nueva puede seguir el README y ejecutar frontend, API y
  PostgreSQL;
- paciente, psicólogo y administrador completan el recorrido seleccionado con
  datos ficticios;
- las validaciones y permisos se aplican también en el servidor;
- las relaciones críticas permanecen protegidas por claves, transacciones y
  restricciones PostgreSQL;
- el DER conceptual explica el dominio sin mostrar tablas o detalles físicos;
- la transformación lógica demuestra al menos tercera forma normal;
- pruebas, capturas, documentación y control de versiones corresponden al mismo
  commit de entrega.

## 6. Trazabilidad

- Alcance funcional completo: [`docs/product/mvp-definition.md`](../../product/mvp-definition.md).
- Reglas de negocio: [`docs/domain/business-rules.md`](../../domain/business-rules.md).
- Arquitectura: [`ADR-001`](../../architecture/ADR-001-postgresql-clean-architecture.md).
- Seguridad: [`security-and-privacy.md`](../../security/security-and-privacy.md).
- Evidencia del Hackathon: [`README.md`](README.md).

