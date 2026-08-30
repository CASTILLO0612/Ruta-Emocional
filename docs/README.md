# Documentación técnica de Ruta Emocional

Este directorio es la fuente de verdad para las decisiones funcionales y técnicas del MVP. Si el comportamiento del código contradice estos documentos, debe corregirse el código o registrarse una nueva decisión arquitectónica antes de cambiar la regla.

## Orden de lectura

1. [Definición del MVP](product/mvp-definition.md)
2. [Reglas de negocio](domain/business-rules.md)
3. [Máquinas de estado](domain/state-machines.md)
4. [Matriz de autorización](security/authorization-matrix.md)
5. [Arquitectura de seguridad y privacidad](security/security-and-privacy.md)
6. [Modelo de amenazas](security/threat-model.md)
7. [Convenciones de API](api/api-guidelines.md)
8. [Requisitos no funcionales](operations/non-functional-requirements.md)
9. [Plan de ejecución del MVP](roadmap/mvp-execution-plan.md)
10. [Cierre de la Fase 3](roadmap/phase-3-professional-directory.md)
11. [Cierre de la Fase 4](roadmap/phase-4-service-requests-and-offers.md)
12. [Cierre de la Fase 5](roadmap/phase-5-secure-messaging.md)
13. [Cierre de la Fase 6](roadmap/phase-6-secure-agenda.md)
14. [Cierre de la Fase 7](roadmap/phase-7-secure-clinical-records.md)
15. [Consolidación de la Fase 7.5](roadmap/phase-7-5-consolidation.md)
16. [Alineación conceptual–lógica](database/conceptual-logical-alignment.md)
17. [Gates de preparación productiva](operations/production-gates.md)
18. [Backup y restauración PostgreSQL](operations/postgresql-backup-restore.md)
19. [ADR propuesto de objetos y secretos](architecture/ADR-002-object-storage-and-secrets-provider.md)
20. [ADR de agenda segura](architecture/ADR-003-secure-appointment-agenda.md)
21. [ADR de historia clínica segura](architecture/ADR-004-secure-clinical-records.md)
22. [Entregable Hackathon Aficionado / Desarrollo](Hackathon/desarrollo/README.md)

## Decisiones vigentes

- PostgreSQL y PostGIS son la fuente de verdad transaccional.
- El esquema debe cumplir al menos tercera forma normal.
- La aplicación se implementa como monolito modular con límites de dominio explícitos.
- El backend es la única autoridad para identidad, permisos, precios, estados y acceso clínico.
- El frontend actual se conserva y se integra por flujos verticales.
- MongoDB no forma parte del runtime. Una reconciliación histórica solo puede
  ejecutarse offline, de forma controlada e idempotente.
- La información clínica y de triaje se considera altamente sensible.
- MENTA orienta y deriva; no diagnostica, prescribe ni sustituye atención profesional o de emergencia.

## Estado documental

Los documentos distinguen entre:

- **MVP obligatorio**: debe existir antes de una prueba con usuarios reales.
- **Posterior al MVP**: se diseña ahora, pero no bloquea el primer lanzamiento.
- **Puerta de salida**: decisión que debe resolverse antes de producción, como jurisdicción, proveedor de pagos o proveedor de llamadas.
