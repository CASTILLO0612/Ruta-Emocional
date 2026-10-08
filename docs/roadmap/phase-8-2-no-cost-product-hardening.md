# Fase 8.2 — Consolidación inicial del producto

**Estado:** implementada; la decisión de mapas fue sustituida por ADR-007
**Corte:** acceso federado, resiliencia móvil, mapas y continuidad multimodal  
**Alcance:** Expo SDK 57, API HTTP, PostgreSQL y Ollama local

## 1. Objetivo

Mejorar la experiencia real del MVP sin debilitar las fronteras de seguridad
existentes. El incremento conserva la arquitectura modular y utiliza
adaptadores por plataforma cuando Android y web requieren comportamientos
distintos.

## 2. Acceso con Google

El login incorpora el identificador multicolor oficial de Google en un botón
neutro y accesible. Web obtiene el ID token mediante Google Identity Services;
Android utiliza el SDK nativo únicamente en una compilación de desarrollo. El
cliente nunca contiene un Client Secret.

El backend verifica criptográficamente el token, exige audiencia y emisor
correctos, crea sesiones revocables y persiste la identidad externa en una tabla
normalizada. No existe vinculación automática por correo. Una cuenta nueva debe
declarar su rol y el psicólogo conserva el proceso de verificación profesional.

## 3. Continuidad frente a conectividad intermitente

- Los borradores de mensajes se conservan cifrados mediante SecureStore en el
  dispositivo y se eliminan después del envío.
- El asistente de solicitudes conserva motivo, modalidad, horario y presupuesto,
  valida de nuevo la política del servidor al recuperarse y elimina el borrador
  después de publicar.
- Web mantiene esos borradores sólo en memoria para no persistir texto sensible
  en almacenamiento accesible al navegador.
- Las cadencias de persistencia están centralizadas para evitar escrituras por
  cada pulsación.

## 4. Mapas y atención presencial

Android utiliza Google Navigation SDK para el mapa, tráfico, cálculo de rutas,
recálculo y guía giro a giro. Web conserva el mapa embebido de OpenStreetMap y
la salida a un proveedor externo. Waze permanece como fallback voluntario. Las
coordenadas exactas continúan privadas y sólo se muestran cuando la relación y
el flujo lo autorizan.

Aceptar una propuesta presencial ya no abre un chat como destino final. Si el
consultorio está definido, la interfaz prioriza cómo llegar. Si aún falta,
prioriza coordinar la ubicación. Las propuestas de llamada y las programadas
dirigen a su acción o agenda correspondiente.

## 5. MENTA local

MENTA conserva Ollama como proveedor local, persistencia PostgreSQL y
autorización por rol. Ollama entrega fragmentos nativos mientras genera y la API
los transmite por SSE; el cliente mantiene una cadencia legible, listas y
jerarquía tipográfica. Si la validación final sustituye una salida, el flujo
reemplaza el contenido parcial por la respuesta segura persistida. El contexto
se obtiene mediante herramientas acotadas; el agente no recibe acceso general a
la base ni escribe automáticamente información clínica.

## 6. Calidad y verificación

- TypeScript estricto aprobado en frontend y backend.
- 57 suites y 148 pruebas de frontend aprobadas.
- 65 pruebas unitarias de backend aprobadas.
- Nueve suites de integración HTTP aprobadas sobre PostgreSQL real.
- Esquema Prisma válido y 27 migraciones aplicadas.
- Validadores de identidad visual y configuración nativa aprobados.
- Exportación web completa aprobada.
- Liveness y readiness aprobados con base de datos, outbox y privacidad en estado
  saludable.
- Auditoría de archivos modificados sin `any`, alertas nativas, comentarios,
  TODO/FIXME ni mensajes técnicos visibles.

## 7. Límites explícitos

1. Google nativo requiere una compilación de desarrollo; no funciona dentro de
   Expo Go porque depende de código nativo.
2. Navigation SDK exige compilación nativa, Google Play Services, una clave
   restringida, facturación habilitada y límites operativos. Web no ofrece guía
   giro a giro integrada.
3. Las notificaciones push, almacenamiento privado con antimalware,
   observabilidad externa y entrega de correo continúan siendo adaptadores de
   infraestructura pendientes.
4. La sincronización implementada protege borradores; no pretende convertir el
   expediente clínico ni las mutaciones críticas en operaciones offline.

Estos límites no bloquean la demostración funcional, pero impiden declarar el
producto listo para producción pública hasta contar con responsables,
proveedores y pruebas operativas formales.
