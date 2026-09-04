# Informe rector 10/10 — Refactor visual y de experiencia de Ruta Emocional

**Versión:** 2.0<br>
**Estado:** Aprobado como plan de ejecución, sujeto a los gates definidos<br>
**Alcance:** Frontend móvil/web, navegación, experiencia de solicitudes, ofertas, aceptación, MENTA contextual y paneles por rol<br>
**Objetivo:** Convertir la experiencia actual en una interfaz limpia, profesional, coherente y demostrable, sin inventar capacidades que todavía no existan en el backend.

> Este informe sustituye el plan anterior. Corrige sus contradicciones y establece criterios objetivos para que el resultado pueda considerarse 10/10, no solamente desde el punto de vista visual, sino también en arquitectura, seguridad, rendimiento, accesibilidad, mantenibilidad y correspondencia con PostgreSQL.

---

## 1. Resumen ejecutivo

La dirección visual propuesta es correcta:

- Cuatro pestañas principales por rol.
- Menor saturación.
- Solicitudes divididas en pasos.
- MENTA integrada de manera contextual.
- Contraofertas claras.
- Navegación posterior a la aceptación basada en la modalidad.
- Uso profesional de componentes, iconos y jerarquía visual.

Sin embargo, el plan original asumía capacidades que actualmente no forman parte de los contratos existentes:

- Una oferta no contiene horario alternativo ni duración.
- Aceptar una oferta no crea automáticamente una cita.
- El resultado de aceptación no contiene dirección.
- No existe todavía una sesión RTC que permita afirmar que una llamada está lista.
- El frontend no puede presentar una ubicación o ruta exacta si el backend no dispone de una ubicación profesional verificada.

El plan 10/10 mantiene la intención visual, pero elimina esas inconsistencias. La interfaz siempre reflejará el estado real del sistema.

---

## 2. Principios no negociables

### 2.1 Veracidad funcional

La interfaz no mostrará estados que no estén confirmados por el backend.

Ejemplos:
- Se mostrará «Oferta aceptada» cuando la aceptación haya sido confirmada.
- Se mostrará «Cita confirmada» solamente si existe una cita persistida.
- Se mostrará una dirección únicamente cuando exista una ubicación profesional verificada.
- Se habilitará «Iniciar llamada» únicamente cuando exista una sesión RTC válida.
- MENTA no afirmará que un profesional está disponible si no dispone de información actualizada que lo demuestre.

### 2.2 Backend como fuente de verdad

El frontend nunca determinará por sí solo:

- Si una oferta sigue vigente.
- Si una solicitud puede aceptarse.
- Si una relación asistencial está activa.
- Si un usuario tiene acceso a una conversación.
- Si un psicólogo está autorizado.
- Si una cita está confirmada.
- Si una acción es idempotente.

El frontend presenta, orienta y previene errores de interacción. El backend valida y decide.

### 2.3 Sin hardcodeados de negocio

No se introducirán directamente en las pantallas:

- Monedas, rangos presupuestarios, duraciones, límites de texto, anticipaciones mínimas.
- Estados del dominio, modalidades admitidas, horarios predeterminados.
- Direcciones, mensajes clínicos, recomendaciones de MENTA.

Los valores deberán proceder de políticas entregadas por el backend, configuración centralizada, catálogos del dominio, tokens del sistema visual o funciones de traducción/presentación.

### 2.4 Código limpio y reutilizable

Se evitará:
- Duplicación de encabezados.
- Condicionales de navegación repartidos entre varias pantallas.
- Estilos visuales literales repetidos.
- Lógica de validación dentro del JSX.
- Transformaciones de API dentro de componentes visuales.
- Pantallas distintas que solamente cambien un título o un icono.
- Dependencia directa de componentes sobre detalles de infraestructura.

### 2.5 Privacidad por diseño

- No se registrarán necesidades emocionales, mensajes, diagnósticos o datos clínicos en `console.log`.
- Los borradores sensibles no se persistirán sin justificación explícita.
- No se incluirá información clínica completa en parámetros de navegación.
- Las rutas transportarán identificadores y metadatos mínimos.
- La ubicación exacta no se utilizará sin consentimiento y finalidad definida.
- MENTA accederá solamente al contexto autorizado para el rol y el caso de uso.

### 2.6 Sin simulaciones disfrazadas de funcionalidad

No se presentarán como terminadas capacidades inexistentes:
- Llamadas falsas, pagos falsos, mapas con direcciones inventadas.
- Citas no persistidas, disponibilidad simulada.
- Recomendaciones generadas con datos inexistentes.
- Mensajes de éxito antes de recibir confirmación del servidor.

---

## 3. Estado técnico comprobado

### Lo que devuelve `acceptOffer` actualmente

```ts
export interface AcceptedOfferResult {
  readonly offer: Offer;               // Importe, moneda, mensaje, estado
  readonly careRelationshipId: string; // Relación asistencial creada/recuperada
  readonly conversationId: string;     // Conversación autorizada
  readonly replayed: boolean;          // Idempotencia
}
```

**No contiene:** `appointmentId`, dirección, coordenadas, duración, sesión RTC, enlace de llamada, horario modificado por el psicólogo.

### Lo que contiene una oferta

- Profesional (nombre, foto, especialidad, valoración).
- Importe y moneda.
- Mensaje opcional.
- Estado.
- Fecha de creación.

### Lo que contiene la solicitud activa

- Modalidad, necesidad principal, descripción.
- Presupuesto propuesto y moneda.
- Estado.
- Horario solicitado (`scheduledFor`).
- Fechas de vigencia.

### Distinción obligatoria

| Entidad | Descripción |
|---|---|
| Datos de la solicitud | Condiciones propuestas por el paciente |
| Datos de la oferta | Condiciones propuestas por el psicólogo |
| Resultado de aceptación | `careRelationshipId` + `conversationId` |
| Cita real | Solo cuando `appointmentId` existe en el backend |
| Conversación | Siempre disponible tras aceptación |
| Relación asistencial | Siempre creada tras aceptación |

---

## 4. Objetivos medibles

El resultado se considerará exitoso cuando:

- Cada rol tenga exactamente cuatro destinos principales.
- Cada pantalla tenga una acción primaria inequívoca.
- El usuario comprenda la pantalla principal en menos de cinco segundos.
- Ningún dato crítico se presente sin respaldo del backend.
- No existan rutas inaccesibles después de retirar pestañas.
- El formulario de solicitud se complete progresivamente.
- No sea posible enviar accidentalmente dos veces la misma solicitud o aceptación.
- Todas las operaciones de red presenten estado de carga, éxito y error.
- La experiencia sea utilizable con tamaños de fuente ampliados.
- Los botones tengan áreas táctiles adecuadas.
- No existan emojis como iconos.
- Colores, tipografías, espaciado, radios e iconos procedan del sistema visual.
- `typecheck`, `validate:design` y `validate:native-config` permanezcan en verde.
- Los flujos funcionen en un dispositivo Android real.

---

## 5. Arquitectura de navegación definitiva

### 5.1 Paciente — 4 Pestañas

| Pestaña | Responsabilidad |
|---|---|
| **Inicio** | Resumen contextual y próximas acciones |
| **Buscar** | Crear solicitud y buscar acompañamiento |
| **Citas** | Agenda y estados de atención |
| **Perfil** | Datos personales, preferencias y configuración |

Estructura recomendada:
```
PatientMain
├── Inicio
├── Buscar
│   └── SearchFlow
│       ├── RequestWizard
│       └── Radar
├── Citas
└── Perfil
```

Destinos secundarios del stack:
`MentaAgent · Inbox · Conversation · PsychologistProfile · AcceptedOffer · AppointmentDetail`

### 5.2 Psicólogo — 4 Pestañas

| Pestaña actual | Pestaña nueva |
|---|---|
| Dashboard | **Solicitudes** |
| History/Agenda | **Agenda** |
| Clinical | **Pacientes** |
| Profile | **Perfil** |
| Menta | → Destino secundario |
| Messages | → Destino secundario |

### 5.3 MENTA y Mensajes

Dejan de ser pestañas. Acceso desde el **encabezado autenticado compartido** (componente único, no copiado en cada pantalla):
- Botón MENTA.
- Botón Mensajes con indicador de no leídos (solo cuando haya datos reales).

### 5.4 Seguridad de navegación

- Paciente no accede a pantallas del psicólogo.
- Psicólogo no accede a expedientes no relacionados.
- Psicólogo sin verificación no accede al panel profesional.
- Conversación solo abre si el backend autoriza la participación.
- Retroceder después de cerrar sesión no revela pantallas protegidas.
- Deep links respetan autenticación, rol y estado de verificación.

---

## 6. Sistema visual definitivo

### 6.1 Tokens

Nunca se usará `#253A82` directamente en pantallas. Solo `Colors.primary`. Aplica para todo: fondos, texto, bordes, estados, espaciado, radios, sombras, iconos, tipografía.

Fuentes únicas: `Colors · Spacing · BorderRadius · Shadow · FontFamily · Typography · FontSize · IconSize · IconStroke`.

### 6.2 Tipografía

- **Poppins:** Encabezados, títulos, importes destacados, acciones principales.
- **Inter:** Párrafos, ayudas, etiquetas, estados, contenido de lectura.

Reglas: máx. tres niveles tipográficos dominantes por pantalla; sin mayúsculas completas en textos largos; texto escalable sin truncar información crítica; importes con moneda y formato regional consistente.

### 6.3 Iconografía

| Biblioteca | Uso |
|---|---|
| **Lucide** | Navegación, acciones estáticas, estados, semántica funcional |
| **MorphIcons** | Acceso a MENTA, evolución de solicitud, confirmación de acción importante |

MorphIcons **no** se usa en todos los iconos, como decoración sin significado, en acciones destructivas, para reemplazar el tab bar, ni cerca de contenido clínico.

Cero emojis como elementos de interfaz.

### 6.4 Espaciado y densidad

- Un solo CTA visualmente dominante.
- Máximo dos niveles de tarjetas anidadas.
- Máximo tres acciones simultáneas con el mismo peso.
- Acción principal dentro de zona alcanzable con el pulgar.

### 6.5 Movimiento

Las animaciones deben ser breves, predecibles, reversibles, compatibles con `prefers-reduced-motion`. No bloquear una operación real esperando que termine una animación.

---

## 7. Catálogo de componentes reutilizables

| Componente | Responsabilidad |
|---|---|
| `AppHeader` | Identidad, título, MENTA, bandeja y acciones contextuales |
| `ScreenContainer` | Safe area, fondo, scroll y espaciado |
| `SectionHeader` | Título, descripción y acción secundaria |
| `PrimaryActionCard` | Acción dominante de una pantalla |
| `ContextSuggestionCard` | Sugerencia verificable de MENTA |
| `ProfessionalCompactCard` | Vista resumida de un profesional |
| `AsyncState` | Carga, vacío, error y reintento |
| `WizardScaffold` | Estructura común de los cinco pasos |
| `StepProgress` | Progreso accesible |
| `ModalitySelector` | Selección de modalidad |
| `BudgetInput` | Captura y validación de importe |
| `RequestSummary` | Revisión previa a la publicación |
| `OfferComparisonSheet` | Comparación válida entre propuesta y oferta |
| `AcceptedOfferSummary` | Resultado real de una aceptación |
| `MentaHeaderAction` | Entrada consistente hacia MENTA |
| `InboxHeaderAction` | Entrada a mensajes e indicador pendiente |

Los componentes visuales no llamarán directamente a endpoints. Recibirán propiedades y emitirán eventos.

---

## 8. Inicio del paciente

### 8.1 Jerarquía dinámica

El orden depende de la existencia y urgencia de cada elemento:

1. Encabezado.
2. Saludo contextual.
3. Acción urgente o pendiente.
4. Próxima cita real.
5. Buscar acompañamiento.
6. Sugerencia verificable de MENTA.
7. Directorio resumido.

Ejemplo con oferta pendiente:
```
→ Oferta pendiente
→ Próxima cita
→ Buscar acompañamiento
→ Sugerencia MENTA
→ Profesionales
```

Ejemplo sin actividad:
```
→ Buscar acompañamiento
→ Sugerencia general válida
→ Profesionales
```

### 8.2 Próxima cita

Solo aparece si existe una cita real. Muestra profesional, fecha, hora con zona horaria, modalidad, estado y acción válida. No se deriva únicamente de `scheduledFor` de una solicitud.

### 8.3 Directorio

Máximo tres profesionales. Cada tarjeta muestra **una sola señal contextual relevante** (valoración, modalidad, disponibilidad o distancia aproximada). No todas simultáneamente.

La distancia solo si: la modalidad presencial es pertinente + hay permiso de ubicación + fue calculada realmente + se comunica como aproximada.

---

## 9. MENTA ambiental

### 9.1 Sugerencias permitidas vs. prohibidas

| ✅ Permitidas | ❌ Prohibidas |
|---|---|
| Recordar cita real | Inventar disponibilidad |
| Mostrar disponibilidad realmente consultada | Recomendar «el mejor» sin criterios |
| Sugerir revisar oferta pendiente | Emitir diagnósticos |
| Facilitar acción existente | Prometer resultados terapéuticos |
| Organizar información autorizada | Usar información clínica sin autorización |

### 9.2 Trazabilidad de sugerencias

Una recomendación debe conocer: qué información la originó, cuándo se actualizó, qué usuario puede verla, qué acción permite realizar, qué ocurre si la información dejó de estar vigente.

### 9.3 Propuestas clínicas

Son borradores. El psicólogo conserva la responsabilidad de revisar, modificar y aprobar.

---

## 10. Wizard de solicitud

### 10.1 Pasos

| Paso | Objetivo |
|---|---|
| 1 | Necesidad principal y contexto opcional |
| 2 | Modalidad |
| 3 | Momento solicitado |
| 4 | Presupuesto propuesto |
| 5 | Revisión y publicación |

### 10.2 Máquina de estados de presentación

```
NEED → MODALITY → TIMING → BUDGET → REVIEW → SUBMITTING → PUBLISHED
```

Estados alternativos: `CANCELLED · VALIDATION_ERROR · SUBMISSION_ERROR`

Reglas:
- No avanzar si el paso actual es inválido.
- No retroceder mientras se está enviando.
- No ejecutar dos envíos simultáneos.
- Un error de red no elimina el borrador.
- Un envío exitoso limpia el borrador.
- Cancelar requiere confirmación cuando hay datos.
- Volver desde Radar no debe publicar nuevamente la misma solicitud.

### 10.3 Datos del borrador

```ts
interface WizardDraft {
  readonly primaryNeed?: string;
  readonly description?: string;
  readonly modality?: Modality;
  readonly timing: 'immediate' | 'scheduled' | null;
  readonly scheduledFor?: Date;
  readonly proposedBudgetInput: string;  // texto durante edición
  readonly currencyCode?: string;
  readonly approximateLocation?: ExistingLocationType;
}
```

El importe se convierte una sola vez al formato del repositorio. `immediate` se transforma en ausencia de `scheduledFor`. No se pasa el borrador completo mediante navegación.

### 10.4 Reglas del backend (sin hardcodeados)

El wizard usa la política existente para: monedas admitidas, presupuesto mínimo/máximo, anticipación mínima, límite de programación, longitud de texto, modalidades permitidas.

Los chips de importe se generan a partir del rango permitido. **No quedan fijados globalmente** a valores literales.

### 10.5 Vocabulario del presupuesto

✅ «Presupuesto propuesto» · «Oferta enviada»<br>
❌ «Comprar» · «Pagar ahora» · «Sesión adquirida» · «Monto cobrado»

---

## 11. Radar y contraofertas

### 11.1 Lo que es realmente negociable

Con el contrato actual, el profesional contraoferta únicamente:
- **Importe.**
- **Mensaje opcional.**

La comparación principal del Bottom Sheet:

| Tu propuesta | Oferta del profesional |
|---|---|
| C$ 500 | C$ 600 |

La modalidad y el horario se muestran separadamente bajo **«Condiciones de tu solicitud»**, no como modificaciones del psicólogo. No se muestra duración mientras no exista en el dominio.

### 11.2 Contenido del Bottom Sheet

- Identidad del profesional, verificación, especialidad, valoración.
- Presupuesto del paciente vs. importe ofrecido (diferencia formateada, moneda explícita).
- Mensaje del profesional.
- Modalidad y horario de la solicitud (separados).
- «Ver perfil completo».
- «Aceptar oferta».
- «Ahora no» o «Cerrar» *(solo «Rechazar» si existe endpoint real para rechazar oferta individual)*.

### 11.3 Concurrencia y vigencia

Al aceptar: botón deshabilitado inmediatamente + progreso visible + misma clave de idempotencia para el mismo intento. El backend revalida vigencia. `replayed: true` se trata como éxito recuperado. Oferta expirada cierra o actualiza el sheet. No se navega hasta recibir confirmación.

### 11.4 Accesibilidad del Bottom Sheet

Debe: mover foco al abrir, anunciar título e importe, mantener foco dentro, permitir cierre accesible, no depender únicamente de gestos, restaurar foco al origen, manejar teclado y texto ampliado.

---

## 12. Flujo posterior a aceptar una oferta

### 12.1 Regla principal

Aceptar una oferta crea **relación asistencial** y **conversación**, pero **no equivale automáticamente a crear una cita**.

La pantalla principal será **`AcceptedOfferScreen`**. Título: **«Oferta aceptada»**, no «Cita confirmada».

### 12.2 Matriz de navegación

| Modalidad | Momento | Destino |
|---|---|---|
| Chat | Inmediato | Conversación autorizada |
| Chat | Programado | AcceptedOfferScreen + acceso al chat |
| Llamada | Inmediato | AcceptedOfferScreen; coordinación disponible |
| Llamada | Programado | AcceptedOfferScreen; horario solicitado |
| Presencial | Inmediato | AcceptedOfferScreen; coordinación disponible |
| Presencial | Programado | AcceptedOfferScreen; horario solicitado |

Cuando existan capacidades reales, la pantalla evoluciona:

| Capacidad real disponible | Experiencia |
|---|---|
| `appointmentId` confirmado | «Cita confirmada» |
| Ubicación profesional verificada | «Ver indicaciones» |
| Sesión RTC válida | «Iniciar llamada» |
| Conversación autorizada | «Abrir conversación» |

### 12.3 Resolución centralizada

```ts
resolveAcceptedOfferDestination(input: {
  modality: Modality;
  scheduledFor?: Date;
  appointmentId?: string;
  hasRtcSession: boolean;
  hasVerifiedLocation: boolean;
  conversationId: string;
}): NavigationDestination
```

Función pura con switch exhaustivo y pruebas unitarias. La lógica de enrutamiento no se reparte entre pantallas.

### 12.4 Ubicación presencial

Mientras no exista dirección verificada: no se muestra ruta, no se abre mapa con coordenadas inventadas, no se llama «consultorio» a una ubicación aproximada. El chat es el mecanismo secundario de coordinación.

### 12.5 Llamadas

Mientras RTC no esté integrado: «Atención por llamada aceptada». No «Tu llamada está lista». No «Iniciar llamada».

---

## 13. Experiencia del psicólogo

### 13.1 Solicitudes

Prioridad: compatibilidad, modalidad, momento, necesidad resumida, presupuesto, estado, acción principal. No todas las métricas simultáneamente. Sin doble envío.

### 13.2 Agenda

Diferencia: próximas citas, pendientes de confirmar, completadas, canceladas. No presenta solicitudes aceptadas como citas si no existe entidad de cita.

### 13.3 Pacientes

Solo pacientes con relación asistencial autorizada. No muestra diagnósticos o notas sensibles en la tarjeta resumida.

### 13.4 Acceso a MENTA

Desde el encabezado. Acciones contextuales: «Preparar borrador», «Resumir contexto autorizado», «Organizar notas», «Consultar agenda». Abren MENTA con contexto mínimo autorizado.

---

## 14. Estados obligatorios de cada pantalla

`Idle · Loading · Refreshing · Success · Empty · Partial · Recoverable error · Terminal error · Offline · Stale · Submitting`

No se usará un spinner permanente como única respuesta.

---

## 15. Seguridad y privacidad

### 15.1 Datos sensibles — prohibido registrar en logs

Texto de notas clínicas, mensajes privados, necesidad emocional completa, tokens, contraseñas, documentos profesionales, direcciones exactas, respuestas clínicas de MENTA, payloads de autenticación.

### 15.2 Parámetros de navegación

Solo: identificadores, modalidad, estado estrictamente necesario, metadatos no sensibles. No se transportan notas clínicas ni descripciones completas en el estado de navegación.

### 15.3 Borradores

Efímeros por defecto. Se eliminan al publicar, al cerrar sesión, al cancelar explícitamente o al cambiar de usuario.

### 15.4 Errores al usuario

No revelan detalles internos, SQL, nombres de tablas ni respuestas crudas. Indican si se puede reintentar. Distinguen validación, expiración, autorización y conexión.

---

## 16. Rendimiento

- Listas virtualizadas para directorios, ofertas y pacientes.
- Máximo de tres profesionales en preview de Inicio.
- Memorizar tarjetas donde exista evidencia de rerender innecesario.
- Cancelar solicitudes de red cuando la pantalla se desmonta.
- Imágenes con placeholders estables y dimensiones conocidas.
- Retroalimentación visual inmediata antes de confirmar con el servidor.

---

## 17. Accesibilidad — parte del Definition of Done

- Área táctil mínima adecuada.
- Contraste WCAG AA.
- Texto escalable sin truncar información crítica.
- Etiquetas para lector de pantalla.
- No depender únicamente del color.
- Errores asociados con su campo.
- Foco correcto en modales y bottom sheets.
- Soporte para reducción de movimiento.
- Progreso del wizard anunciado como «Paso 3 de 5».
- Importes leídos con moneda y valor.

---

## 18. Bloques de implementación (RV-0 a RV-8)

### RV-0 — Línea base
**Entregables:** Inventario de pantallas, capturas del estado anterior, mapa de navegación actual, matriz de funcionalidades por rol, lista de rutas y contratos existentes.<br>
**Gate:** Todos los flujos actuales documentados. No se comienza el refactor basándose en suposiciones.

### RV-1 — Fundamentos visuales
**Entregables:** Revisión de tokens, componentes base, encabezado compartido, reglas de iconografía, estados comunes, eliminación de literales visuales relevantes.<br>
**Gate:** `typecheck` y `validate:design` en verde. Ninguna pantalla funcional cambia de comportamiento.

### RV-2 — Navegación
**Entregables:** 4 pestañas para paciente, 4 pestañas para psicólogo, MENTA e Inbox como destinos secundarios, rutas tipadas, guards por rol, comportamiento de retroceso documentado.<br>
**Gate:** Sin pantallas huérfanas. Mensajes y MENTA accesibles. Cerrar sesión elimina el historial protegido.

### RV-3 — Inicio del paciente
**Entregables:** Jerarquía contextual, próxima cita real, CTA dominante, decisiones pendientes, MENTA ambiental, directorio resumido.<br>
**Gate:** Ningún bloque vacío ocupa espacio. Máximo 3 profesionales en preview. Una sola acción primaria.

### RV-4 — Wizard
**Entregables:** 5 pasos, validación por paso, uso de políticas reales, borrador efímero, prevención de doble envío, resumen editable, manejo completo de errores.<br>
**Gate:** El payload final es equivalente al flujo anterior. Sin montos ni monedas hardcodeados. Sin capacidades perdidas.

### RV-5 — Radar y oferta
**Entregables:** Bottom Sheet profesional, comparación monetaria correcta, contexto de solicitud separado, perfil profesional, vigencia y concurrencia, accesibilidad del modal.<br>
**Gate:** Sin horario ni duración como parte de la contraoferta. Oferta expirada no aceptable. Sin duplicación de operaciones.

### RV-6 — Postaceptación
**Entregables:** Eliminación de redirección automática incorrecta, `resolveAcceptedOfferDestination()` centralizado, `AcceptedOfferScreen`, próxima acción según capacidad real, manejo de `replayed`.<br>
**Gate:** Presencial no abre automáticamente chat. Llamada no simula RTC. Programación no simula cita. Chat inmediato abre conversación real.

### RV-7 — Panel del psicólogo
**Entregables:** Solicitudes, Agenda, Pacientes y Perfil, encabezado compartido, MENTA contextual, reducción de densidad, estados vacíos y de error.<br>
**Gate:** Psicólogo verificado mantiene todas sus capacidades. Psicólogo pendiente continúa bloqueado. Sin información clínica en tarjetas resumidas.

### RV-8 — Estabilización
**Entregables:** Pruebas completas, correcciones de regresiones, capturas finales, matriz de accesibilidad, informe de rendimiento, documentación técnica actualizada.<br>
**Gate:** Todos los criterios del Definition of Done aprobados. Sin simulaciones. Sin errores TypeScript. Pruebas críticas en dispositivo real.

---

## 19. Estrategia de pruebas

### 19.1 Unitarias
- Validación de cada paso del wizard.
- Generación de chips de presupuesto desde política.
- Transformación del borrador al payload.
- Formato monetario.
- Priorización de bloques en Inicio.
- `resolveAcceptedOfferDestination()` con todos los casos.
- Mapeo de estados de API.
- Manejo de `replayed`.

### 19.2 Componentes
- 4 pestañas visibles por rol.
- MENTA accesible desde encabezado.
- Inbox accesible.
- CTA deshabilitado correctamente.
- Resumen editable.
- Bottom Sheet con campos permitidos.
- Error de oferta expirada.
- Estados de carga, vacío y error.
- Texto ampliado.
- Etiquetas accesibles.

### 19.3 Integración
- Publicación de solicitud: inmediata, programada, presencial.
- Recepción de oferta.
- Aceptación de oferta de chat → conversación.
- Aceptación presencial → sin redirección automática al chat.
- Aceptación de llamada → sin simular RTC.
- Repetición idempotente (`replayed: true`).
- Pérdida de conexión y recuperación.
- Cambio de rol.
- Psicólogo verificado y no verificado.

### 19.4 Dispositivo real
Android físico con Expo Go: pantalla pequeña, pantalla grande, orientación vertical, teclado abierto, texto ampliado, conexión lenta, pérdida de red, retorno desde segundo plano, back button físico.

### 19.5 Regresión crítica

| Flujo | Resultado esperado |
|---|---|
| Paciente inicia sesión | 4 pestañas |
| Psicólogo pendiente | Continúa en verificación |
| Psicólogo aprobado | Panel profesional |
| Crear solicitud | Se persiste una sola solicitud |
| Recibir oferta | Aparece en Radar |
| Aceptar chat inmediato | Conversación autorizada |
| Aceptar presencial | AcceptedOfferScreen |
| Aceptar llamada | Sin simular RTC |
| Oferta expirada | Bloquea aceptación |
| Cerrar sesión | Elimina navegación protegida |
| MENTA | Solo contexto autorizado |

---

## 20. Riesgos y mitigaciones

| Riesgo | Nivel | Mitigación |
|---|---|---|
| Mostrar cita inexistente | Crítico | Usar «Oferta aceptada» hasta disponer de `appointmentId` |
| Presentar datos no incluidos en la oferta | Crítico | Comparar solo monto y mensaje |
| MENTA inventa contexto | Crítico | Recomendaciones condicionadas a fuentes reales |
| Acceso cruzado entre roles | Crítico | Guards visuales + autorización backend |
| Doble aceptación | Alto | Bloqueo local + idempotencia + manejo de `replayed` |
| Oferta expira con sheet abierto | Alto | Revalidación y estado de expiración |
| Mensajes quedan ocultos | Alto | Encabezado, badge y accesos contextuales |
| Borrador sensible persistido | Alto | Memoria efímera y limpieza al salir |
| Dirección inexacta | Crítico | No mostrar rutas sin ubicación verificada |
| Botón de llamada ficticio | Crítico | Gate explícito de RTC |
| Regresión en teléfonos pequeños | Alto | Pruebas de teclado, safe area y texto ampliado |

---

## 21. Fuera del alcance inmediato

Las siguientes capacidades **no deben mezclarse silenciosamente** con el refactor:

- Pagos, cobros parciales, reembolsos.
- Direcciones profesionales verificadas y navegación por mapas.
- Llamadas RTC.
- Duración negociable.
- Contraoferta de horario o modalidad.
- Creación automática de citas.
- Notificaciones push.
- Recomendaciones clínicas autónomas de MENTA.

Cada una requiere diseño de dominio, contrato HTTP, persistencia, seguridad y pruebas propios.

---

## 22. Documentation obligatoria al finalizar

- Mapa de navegación final.
- Matriz de rutas por rol.
- Catálogo de componentes reutilizables.
- Reglas de MENTA contextual.
- Función `resolveAcceptedOfferDestination` documentada.
- Estados de cada pantalla.
- Evidencias de pruebas.
- Limitaciones conocidas.
- Capacidades todavía no habilitadas.
- Evidencia visual antes/después.
- Decisiones de arquitectura relevantes.

---

## 23. Definition of Done 10/10

### Producto
- [ ] 4 pestañas por rol.
- [ ] Inicio comprensible en menos de 5 segundos.
- [ ] Una acción primaria por pantalla.
- [ ] MENTA integrada sin dominar la navegación.
- [ ] Mensajes accesibles sin ocupar una pestaña.
- [ ] Flujo presencial no abre automáticamente el chat.
- [ ] Ningún estado funcional es ficticio.

### Arquitectura
- [ ] Navegación completamente tipada.
- [ ] `resolveAcceptedOfferDestination` centralizado.
- [ ] Componentes compartidos.
- [ ] Validación separada del JSX.
- [ ] Sin duplicación significativa.
- [ ] Sin cambios involuntarios al dominio.
- [ ] Sin lógica de infraestructura en componentes visuales.

### Diseño
- [ ] Identidad visual aplicada mediante tokens.
- [ ] Poppins e Inter coherentes.
- [ ] Lucide y MorphIcons con funciones diferenciadas.
- [ ] Cero emojis como iconos.
- [ ] Densidad visual controlada.
- [ ] Estados vacíos, carga y error diseñados.
- [ ] Responsive en dispositivos objetivo.

### Seguridad
- [ ] Sin información sensible en logs.
- [ ] Sin datos clínicos en rutas.
- [ ] Borradores eliminados correctamente.
- [ ] Autorización por rol comprobada.
- [ ] Sin ubicación exacta sin autorización.
- [ ] MENTA respeta contexto y consentimiento.

### Rendimiento
- [ ] Listas virtualizadas.
- [ ] Sin peticiones duplicadas.
- [ ] Sin bloqueos visibles.
- [ ] Imágenes con placeholders estables.
- [ ] Interacciones fluidas en Android real.

### Accesibilidad
- [ ] Contraste WCAG AA.
- [ ] Áreas táctiles correctas.
- [ ] Soporte para texto ampliado.
- [ ] Foco correcto en modales y bottom sheets.
- [ ] No depender únicamente del color.
- [ ] Reducción de movimiento respetada.

### Calidad
- [ ] `npm run typecheck` ✅
- [ ] `npm run validate:design` ✅
- [ ] `npm run validate:native-config` ✅
- [ ] Pruebas unitarias aprobadas.
- [ ] Pruebas de integración aprobadas.
- [ ] Matriz manual completada.
- [ ] Oferta expirada probada.
- [ ] Idempotencia probada.
- [ ] Pérdida de conexión probada.

---

## 24. Veredicto final

> **La interfaz será más limpia, pero no perderá funcionalidades.**<br>
> **La navegación responderá al modelo mental del paciente y del psicólogo.**<br>
> **MENTA será transversal, contextual y responsable.**<br>
> **El wizard reducirá la carga cognitiva sin alterar el contrato existente.**<br>
> **Las contraofertas mostrarán solamente condiciones reales.**<br>
> **La aceptación respetará la modalidad sin simular citas, llamadas o ubicaciones.**<br>
> **El sistema visual se aplicará mediante componentes y tokens.**<br>
> **Seguridad, accesibilidad y rendimiento forman parte de la implementación.**

El resultado final no será una maqueta atractiva encima de lógica incompleta. Será una experiencia visual profesional, coherente con el dominio, verificable de extremo a extremo y preparada para evolucionar sin reescrituras.

---

## 25. Registro de implementación — corte 1 (2 de septiembre de 2026)

### Alcance implementado

- Navegación principal reducida a cuatro pestañas por rol; MENTA y Mensajes permanecen como destinos secundarios del encabezado compartido.
- Inicio del paciente con jerarquía contextual, una única acción primaria, próxima cita obtenida del backend y directorio resumido.
- Wizard de cinco pasos con borrador efímero, políticas de presupuesto del backend, fecha y hora explícitas para solicitudes programadas y prevención de doble envío.
- Radar y comparación de ofertas separados del contexto de la solicitud.
- Decisión posterior a la aceptación centralizada por modalidad.
- Chat inmediato abre la conversación autorizada; llamada, atención presencial y programación muestran confirmación sin simular RTC, dirección ni cita.
- Sesión de solicitudes aislada por usuario. El cambio de cuenta y el cierre de sesión cancelan suscripciones, limpian memoria y eliminan la referencia persistida del propietario anterior.
- Aceptación construida con la oferta devuelta por el servidor, evitando presentar datos locales obsoletos.
- Bottom sheet con semántica de diálogo, foco inicial y áreas táctiles mínimas.
- Radar compatible con reducción de movimiento.
- Locale de presentación centralizado y moneda ISO formateada regionalmente; `NIO` se presenta como `C$` sin hardcodearlo en las pantallas.
- Carga tipográfica limitada a Inter 400/500/600/700 y Poppins 400/600/700.

### Evidencia automatizada

| Control | Resultado |
|---|---|
| TypeScript estricto | Aprobado |
| Validador del sistema visual | Aprobado |
| Validador de configuración nativa | Aprobado |
| Pruebas Jest | 12 suites y 43 pruebas aprobadas |
| Exportación Expo Web | Aprobada |
| Exportación Expo Android | Aprobada |
| Fuentes incluidas en cada exportación | 7 variantes necesarias |
| Integridad del diff (`git diff --check`) | Aprobada; solo avisos de fin de línea de Windows |

### Estado de los bloques

| Bloque | Estado del corte | Gate todavía pendiente |
|---|---|---|
| RV-1 | Implementado | Cerrado con el logotipo principal, sus aplicaciones positiva/negativa y el isotipo complementario |
| RV-2 | Implementado | Completar matriz manual de deep links, cambio de rol y retroceso físico |
| RV-3 | Implementado | Evidencia visual y validación en tamaños de texto ampliados |
| RV-4 | Implementado | Pruebas manuales de teclado, conexión lenta y reintento en Android real |
| RV-5 | Implementado | Prueba de expiración y concurrencia contra backend en ejecución |
| RV-6 | Implementado | Verificación extremo a extremo de las cuatro modalidades/temporalidades |
| RV-7 | RV-7A implementado | Continuar con Agenda, Pacientes, Perfil y validación manual del panel profesional |
| RV-8 | En progreso | Dispositivo real, matriz de accesibilidad, capturas finales e informe de rendimiento |

### Deuda conocida no ocultada

- Dos pruebas que montan React Navigation imprimen el aviso de entorno `act(...)` originado en `PreventRemoveProvider`; las pruebas terminan correctamente. No se añadió un filtro de consola que pudiera ocultar regresiones reales.
- El gate de recursos provisionales quedó cerrado con el logotipo principal y el isotipo complementario contrastados contra la guía maestra de Canva; la trazabilidad final se registra en la sección 35.
- Las pruebas en dispositivo físico y condiciones degradadas siguen siendo obligatorias antes de declarar RV-8 completo.

---

## 26. Registro de implementación — RV-7A Solicitudes del psicólogo

### Cambios visuales y de experiencia

- Se eliminó la barra duplicada de actividad y los separadores de estilo administrativo.
- La lista utiliza tarjetas planas con borde sutil y espacio uniforme.
- Cada tarjeta prioriza modalidad, necesidad categorizada, momento solicitado y presupuesto.
- La descripción libre del paciente no se expone en la tarjeta resumida.
- La identidad permanece explícitamente protegida hasta la aceptación de una oferta.
- Las acciones se renombraron según el dominio real: el psicólogo no «acepta la solicitud», sino que «envía una oferta».
- «Cambiar tarifa» es una acción secundaria; «Enviar oferta» mantiene la jerarquía dominante.
- Las acciones se apilan automáticamente en pantallas estrechas o con texto ampliado.
- El estado vacío distingue carga inicial de ausencia real de solicitudes.

### Contraoferta profesional

- Se extrajo a un componente independiente del dashboard.
- Compara presupuesto del paciente y propuesta profesional sin perder contexto.
- Obtiene el rango válido de la política entregada por el backend.
- Bloquea importes inválidos antes del envío y conserva la validación definitiva del servidor.
- Presenta moneda regionalmente sin cambiar el código ISO del dominio.
- Implementa semántica de diálogo, foco inicial, cierre accesible, teclado decimal y una sola acción primaria.
- Su comparación cambia a disposición vertical en pantallas pequeñas o con texto ampliado.

### Seguridad y rendimiento

- Las respuestas tardías de listeners pertenecientes a una sesión anterior son ignoradas.
- La carga de solicitudes tiene estado propio y deja de confundirse con el envío de una oferta.
- La lista permanece virtualizada y limita el render inicial.
- La idempotencia y los contratos HTTP existentes no fueron modificados.

### Evidencia RV-7A

| Control | Resultado |
|---|---|
| TypeScript estricto | Aprobado |
| Pruebas del componente de solicitud | Aprobadas |
| Prueba del bottom sheet profesional | Aprobada |
| Pruebas de presentación temporal | Aprobadas |
| Prueba de listener tardío entre sesiones | Aprobada |
| Suite frontend completa | 12 suites y 43 pruebas aprobadas |
| Sistema visual y configuración nativa | Aprobados |
| Exportación Expo Web y Android | Aprobada |

### Gate restante de RV-7A

La implementación automatizada está cerrada. Antes de declarar validación visual física completa se debe probar con datos reales en Android: lista vacía, varias solicitudes, texto ampliado, contraoferta inválida, envío exitoso y error de red.

---

## 27. Registro de implementación — RV-7B Agenda y disponibilidad profesional

### Agenda de citas

- La agenda se presenta como una lista virtualizada y separa claramente próximas sesiones e historial.
- Cada cita muestra contraparte, fecha, hora, modalidad, zona horaria y estado con texto; la comprensión no depende únicamente del color.
- Cada tarjeta conserva una sola acción principal según el estado de la cita.
- Reprogramación y cancelación se agrupan bajo «Opciones», evitando tres botones simultáneos por tarjeta.
- La cancelación utiliza un flujo de confirmación independiente y exige un motivo antes de habilitar la acción destructiva.
- La programación y reprogramación ocurren en una hoja inferior con selección explícita de paciente, modalidad y horario.
- Seleccionar un horario ya no ejecuta una mutación inmediata: el usuario debe confirmar la cita o el nuevo horario.
- Los horarios se agrupan por día y respetan la zona horaria entregada por el backend.
- La consulta utiliza el horizonte completo definido por la política HTTP, sin un límite visual duplicado y hardcodeado.
- Las respuestas tardías de una consulta de horarios anterior se descartan para que un cambio rápido de paciente o modalidad no sobrescriba la selección vigente.

### Disponibilidad del psicólogo

- El panel profesional separa `Citas` y `Disponibilidad` como contextos distintos, sin mezclarlos en una pantalla saturada.
- La disponibilidad se carga y persiste con los endpoints PostgreSQL existentes; no se modificaron contratos ni reglas del dominio.
- La vista semanal resume los siete días en una sola superficie y muestra todos los intervalos activos.
- El editor permite activar o desactivar días y conservar varios intervalos por día para representar pausas.
- Las horas se normalizan al formato de 24 horas antes del envío.
- Se bloquean rangos inválidos y horarios superpuestos antes de llamar al servidor.
- Una semana sin días activos se permite como decisión explícita, pero advierte que no se publicarán nuevos horarios.
- La zona horaria proviene del perfil profesional y usa la zona del dispositivo únicamente como respaldo.
- La edición mantiene foco accesible, controles táctiles de al menos 44 px, estados de error y bloqueo durante el guardado.

### Arquitectura y mantenibilidad

- La composición visual permanece en `AgendaScreen`.
- La orquestación de citas, sockets, transiciones e idempotencia se trasladó a `useAppointmentAgenda`.
- La carga y escritura de disponibilidad se aisló en `useProfessionalAvailability`.
- La presentación de citas y disponibilidad usa utilidades puras con pruebas unitarias.
- La modalidad tiene un único componente de icono reutilizable.
- La normalización de horas y la obtención de zona horaria se centralizaron y también son reutilizadas por el onboarding profesional y el wizard de solicitudes.
- Los componentes no contienen llamadas HTTP directas y el backend continúa como autoridad final.

### Evidencia RV-7B

| Control | Resultado |
|---|---|
| TypeScript estricto | Aprobado |
| Reglas de acciones por rol y estado | Aprobadas |
| Agrupación y presentación de horarios por zona | Aprobadas |
| Confirmación explícita de programación | Aprobada |
| Confirmación segura de cancelación | Aprobada |
| Validación de rangos y solapamientos | Aprobada |
| Separación visual Citas/Disponibilidad | Aprobada |
| Suite frontend completa | 20 suites y 57 pruebas aprobadas |
| Sistema visual y configuración nativa | Aprobados |
| Exportación Expo Web y Android | Aprobada |
| Integridad del diff (`git diff --check`) | Aprobada; solo avisos de fin de línea de Windows |

### Gate manual restante de RV-7B

La implementación automatizada está cerrada. La aceptación física debe cubrir en Android real: crear una cita, cambiar rápidamente paciente y modalidad, confirmar, reprogramar, cancelar con y sin motivo, recorrer estados profesionales, editar varios intervalos, intentar solaparlos, desactivar toda la semana, simular pérdida de red y repetir las pruebas con texto ampliado. Las transiciones y persistencia deben verificarse con backend y PostgreSQL en ejecución; no se consideran demostradas únicamente por las pruebas de presentación.

---

## 28. Registro de implementación — RV-7C Pacientes e historia clínica

### Jerarquía y divulgación progresiva

- La selección de pacientes permanece virtualizada y limita el render inicial para conservar fluidez con expedientes numerosos.
- El expediente dejó de presentar triaje, plan y cronología simultáneamente. Ahora contiene tres destinos explícitos: `Resumen`, `Plan` y `Notas`.
- El resumen muestra únicamente volumen de encuentros, planes activos o históricos, borradores pendientes y la protección de confidencialidad.
- La orientación previa de MENTA se consulta dentro del resumen y conserva su distinción explícita frente a un diagnóstico clínico.
- Las secciones de plan y notas mantienen sus ciclos de vida y acciones originales sin modificar contratos HTTP ni persistencia PostgreSQL.

### Editor clínico protegido

- La creación y edición de encuentros, notas, enmiendas y planes se extrajo a una hoja modal independiente.
- El diálogo anuncia su contexto a tecnologías de asistencia, mueve el foco al abrirse y admite cierre nativo.
- Solo expone los campos pertinentes al modo actual y mantiene una única acción primaria.
- Las longitudes, motivos mínimos y autorización definitiva continúan gobernadas por la política entregada por el backend.
- Los contadores hacen visibles los límites sin duplicar valores en la interfaz.
- El contenido se identifica como información privada del expediente y no se mezcla con el resto de la navegación.

### Mantenibilidad y defensa ante datos inesperados

- Etiquetas de estados, secuencia de objetivos y presentación de fechas se centralizaron en una utilidad pura y probada.
- Una fecha inválida degrada a `Fecha no disponible` en vez de romper el render.
- Se retiraron estilos y campos embebidos que quedaron obsoletos al extraer el editor.
- No se alteraron repositorios, endpoints, reglas de firma, versionado, auditoría ni permisos clínicos.

### Evidencia RV-7C

| Control | Resultado |
|---|---|
| TypeScript estricto | Aprobado |
| Editor de encuentro incompleto bloqueado | Aprobado |
| Separación entre editor de plan y nota | Aprobada |
| Secuencia permitida de objetivos | Aprobada |
| Degradación de fechas inválidas | Aprobada |
| Suite frontend completa | 22 suites y 62 pruebas aprobadas |
| Sistema visual | Aprobado |
| Configuración nativa | Aprobada |

### Gate manual restante de RV-7C

Debe recorrerse en Android real con una relación asistencial activa: seleccionar pacientes, consultar orientación previa, crear y firmar una nota, registrar una enmienda, revisar versiones, crear/activar/completar un plan y confirmar que un usuario sin relación o permiso no obtiene información clínica. También se debe repetir con teclado visible y texto ampliado.

---

## 29. Registro de implementación — RV-7D Login, registro, perfil y verificación

### Login y registro

- Los formularios validan correo, obligatoriedad, longitud de contraseña y colegiatura antes de ejecutar una solicitud HTTP.
- Cada campo presenta su propio mensaje de error y lo expone como alerta accesible; el color dejó de ser la única señal.
- La contraseña puede mostrarse u ocultarse tanto en login como en registro mediante un control táctil de 44 px.
- Paciente y psicólogo se presentan como opciones de radio con estado seleccionado comprensible para tecnologías de asistencia.
- Las reglas de validación se extrajeron a utilidades puras; los límites profesionales continúan centralizados y no se duplican en componentes.
- Las acciones dominantes reutilizan el botón oficial y mantienen estado ocupado durante la operación.

### Perfil

- El perfil se redujo a identidad, rol/estado y una única entrada profesional pertinente.
- Los códigos internos `PENDING`, `VERIFIED` y `REJECTED` se traducen a mensajes claros en español.
- El perfil profesional se carga con cancelación por desmontaje, error visible y reintento explícito.
- La presentación se edita en una hoja modal accesible con contador, límites y una sola acción primaria.
- La especialidad se muestra como dato de solo lectura y explica dónde se administra, evitando un control deshabilitado ambiguo.
- El cierre de sesión conserva confirmación y distingue una revocación remota fallida de la eliminación local de credenciales.

### Verificación profesional

- Cinco formularios simultáneos se sustituyeron por configuración progresiva: especialidad, modalidad, evidencia, presentación y disponibilidad.
- Después de cargar PostgreSQL, la interfaz abre automáticamente el primer requisito obligatorio pendiente.
- El checklist funciona también como navegación y anuncia si cada requisito está completado o pendiente.
- Evidencia, catálogo, tarifa, horarios y presentación conservan sus repositorios, políticas y reglas originales.
- Especialidades, modalidades y días usan semántica de selección; campos monetarios y horarios tienen etiquetas accesibles.
- La aprobación administrativa, auditoría, eventos en tiempo real y habilitación automática no fueron modificados.

### Evidencia RV-7D

| Control | Resultado |
|---|---|
| TypeScript estricto | Aprobado |
| Validación de login y correo | Aprobada |
| Contraseña mínima y rol profesional | Aprobados |
| Traducción completa de estados de verificación | Aprobada |
| Validación del editor profesional | Aprobada |
| Suite frontend completa | 25 suites y 69 pruebas aprobadas |
| Sistema visual | Aprobado |
| Configuración nativa | Aprobada |

### Gate manual restante de RV-7D

La aceptación física debe registrar paciente y psicólogo, probar credenciales inválidas, teclado y autocompletado, cerrar/reabrir sesión, recorrer cada requisito profesional, cargar evidencia, aprobar/rechazar desde administración y confirmar la transición automática al panel. Debe repetirse con texto ampliado y red interrumpida, sin usar credenciales de producción.

---

## 30. Registro de implementación — RV-7E Inbox, conversación y MENTA

### Inbox y navegación

- Inbox conserva carga paginada y lista virtualizada, pero ahora utiliza el encabezado compartido con retroceso visible.
- Se corrigió la salida de Inbox y MENTA dentro del stack global, cuyo encabezado nativo está deshabilitado.
- La actividad y el rol de la contraparte se presentan con texto claro; fechas inválidas degradan de forma segura.
- Carga, vacío, error recuperable, actualización y paginación permanecen visualmente diferenciados.

### Conversación asistencial

- La deduplicación por remitente y clave cliente, el orden temporal y la confirmación de mensajes optimistas se extrajeron a funciones puras.
- Se conservan autenticación de sala, autorización del backend, sincronización al reconectar, carga histórica y reintento del mismo identificador idempotente.
- El estado de tiempo real siempre incluye texto y no depende únicamente del punto de color.
- Los controles de volver, cargar anteriores, cerrar error, reintentar y enviar tienen rol, etiqueta y estado accesible.
- La lista limita render inicial y ventana de elementos para conversaciones extensas.

### MENTA

- Todos los estados del agente —carga, deshabilitado, consentimiento y conversación— tienen navegación de retorno consistente.
- El encabezado se unificó con el sistema visual; privacidad y alcance permanecen visibles sin competir con la identidad principal.
- El historial de turnos pasó a una lista virtualizada, adecuada para conversaciones largas.
- El consentimiento conserva semántica de checkbox, versión y bloqueo de la acción hasta aceptación explícita.
- Las consultas de herramientas siguen mostrando qué contexto autorizado se utilizó.
- Las respuestas de contingencia permanecen identificadas y los borradores clínicos siguen exigiendo revisión del psicólogo.
- No se modificaron endpoints, consentimiento persistido, límites del servidor, herramientas autorizadas ni proveedor externo.

### Evidencia RV-7E

| Control | Resultado |
|---|---|
| TypeScript estricto | Aprobado |
| Deduplicación de mensajes optimistas | Aprobada |
| Estados de conexión con texto | Aprobados |
| Degradación de fechas/horas inválidas | Aprobada |
| Suite frontend completa | 26 suites y 72 pruebas aprobadas |
| Sistema visual | Aprobado |

### Gate manual restante de RV-7E

Se debe comprobar con dos dispositivos y dos cuentas: recepción en tiempo real, envío simultáneo, reconexión, reintento sin duplicado, historial paginado, relación pausada y denegación de una sala ajena. MENTA requiere probar consentimiento nuevo/existente, ambos roles, herramientas permitidas, caída del proveedor, mensajes extensos y revisión humana de cualquier borrador clínico.

---

## 31. Registro de implementación — RV-8A Estados comunes, responsive y accesibilidad

### Estados comunes

- `AsyncState` define prioridad determinista: carga, error bloqueante, vacío y contenido.
- Carga anuncia progreso; error usa región de alerta sin ocultar el botón de reintento; vacío dispone de descripción accesible completa.
- El icono, títulos, mensajes y acciones son configurables sin duplicar composición.
- Inbox adoptó el patrón y conserva un aviso no bloqueante cuando ya existen datos utilizables.

### Responsive

- Breakpoint compacto, umbral de texto ampliado, objetivo táctil y ancho legible se centralizaron en tokens de layout.
- Tarjetas de citas/solicitudes y hojas de disponibilidad/ofertas consumen una misma regla para apilar contenido.
- Inbox, conversación y MENTA limitan la longitud visual en escritorio sin reducir el área útil móvil.
- El radar dejó de capturar el ancho una sola vez al importar el módulo: ahora responde a rotación y redimensionamiento y tiene límite en pantallas web grandes.
- La acción de volver en el perfil profesional externo pasó al objetivo táctil mínimo.

### Accesibilidad

- El sistema común exige objetivos táctiles mínimos de 44 px para botones compartidos y acciones de sección.
- Las hojas modales, autenticación, toasts y alertas respetan la preferencia del sistema de reducir movimiento.
- Estados seleccionados, ocupados, deshabilitados, conexión, error y vacío incluyen semántica o texto; no dependen solo de color o animación.
- Los controles principales del radar ahora exponen rol y etiqueta.
- El validador impide reintroducir `Dimensions.get(...)` estático y estilos literales `style={{...}}`.

### Evidencia RV-8A

| Control | Resultado |
|---|---|
| TypeScript estricto | Aprobado |
| Precedencia de estados comunes | Aprobada |
| Reintento accesible | Aprobado |
| Descripción de vacío | Aprobada |
| Pantalla estrecha y texto ampliado | Aprobados |
| Radar móvil/web | Aprobado |
| Suite frontend completa | 28 suites y 77 pruebas aprobadas |
| Sistema visual y configuración nativa | Aprobados |

### Gate manual restante de RV-8A

En Android y web se debe validar TalkBack/lector de pantalla, orden de foco, teclado externo, zoom web al 200 %, fuente del sistema al máximo, contraste de estados, orientación horizontal, reducir movimiento y áreas táctiles. Las pruebas automatizadas validan contratos; no sustituyen una auditoría asistiva física.

---

## 32. Registro de implementación — RV-8B Iconos, splash y recursos de marca

### Identidad nativa y web

- Android utiliza el isotipo oficial como primer plano de su icono adaptativo sobre el azul primario `#253A82`.
- No se configura una variante monocromática: la guía oficial declara no permitida la escala de grises.
- El splash presenta el logotipo completo, contenido y centrado sobre el azul primario, conforme a la aplicación negativa aprobada.
- La versión web declara nombre, nombre corto, idioma, color de tema, color de fondo y favicon de Ruta Emocional.
- Los recursos mantienen formatos y proporciones compatibles con Expo SDK 57: icono general y primer plano Android de 1024 px; favicon de 96 px; isotipo transparente de 576 × 500 px; y logotipos horizontales transparentes para interfaces y splash.
- La configuración se validó también después de ser resuelta por Expo; no depende únicamente de que `app.json` sea sintácticamente válido.

### Prevención de regresiones

- El validador nativo comprueba rutas, tamaños y combinación de colores de los recursos de marca.
- El fondo Android basado en la retícula de construcción queda expresamente prohibido en la configuración activa.
- El validador exige el logotipo negativo en splash, el isotipo limpio en Android y los metadatos de marca en web.
- No se generaron reinterpretaciones de la marca con IA ni se alteró el trazado del identificador existente.

### Evidencia RV-8B

| Control | Resultado |
|---|---|
| Configuración pública resuelta por Expo | Aprobada |
| Icono adaptativo Android | Aprobado |
| Icono temático Android | No configurado por restricción explícita de marca |
| Splash limpio y contenido | Aprobado |
| Favicon y metadatos web | Aprobados |
| Dimensiones y formato de recursos | Aprobados |
| Validador nativo automatizado | Aprobado |

### Cierre de marca de RV-8B

El recurso oficial proporcionado permitió sustituir la retícula y la marca provisional del icono general. La misma geometría, zona segura y paleta documentada alimentan ahora iOS/general, Android, splash, favicon e interfaces. La app no reconstruye ni deforma el trazado.

---

## 33. Registro de implementación — RV-8C Validación Android y web

### Artefactos de plataforma

- Expo generó satisfactoriamente un bundle web de producción con 4 928 módulos y un bundle Android/Hermes válido después de integrar el logotipo y sus dos aplicaciones oficiales.
- La resolución pública de configuración conservó nombre, idioma, tema, favicon, iconos adaptativos y splash.
- El verificador de dependencias de Expo SDK 57 confirmó que las dependencias están actualizadas.
- Los bundles se escribieron fuera del repositorio y no contaminan el control de versiones.

### Aceptación web real

- El artefacto exportado se sirvió localmente y se inspeccionó en navegador; no se usó únicamente el árbol de pruebas.
- Login y ambas variantes de registro renderizaron sin errores ni advertencias de consola.
- A 390 × 844 no hubo desbordamiento horizontal y todos los controles visibles alcanzaron 44 px como mínimo.
- La validación incompleta produjo alertas específicas para nombre, correo y contraseña, además de un resumen recuperable.
- La navegación por teclado avanzó de forma coherente por campos, visibilidad de contraseña, colegiatura, acción principal y retorno.
- El documento generado declaró idioma español, viewport móvil, favicon y tema `#253A82`.

### Hallazgo y corrección durante RV-8C

React Native Web 0.21 no exponía en el DOM el estado elegido de radios mediante `accessibilityState` por sí solo. Se conservó `accessibilityState.checked` para nativo y se añadió `aria-checked` explícito para web. El mismo contrato se aplicó a checkboxes y tabs con `aria-checked` o `aria-selected`; una regla automática impide omitirlo en controles nuevos. La aceptación posterior confirmó `true/false` en el DOM real.

### Backend utilizado en la prueba

- El servidor inició conectado a PostgreSQL.
- Los probes `live` y `ready` devolvieron `ok`.
- Readiness confirmó base de datos, outbox y solicitudes de privacidad en estado correcto.
- Durante una pausa prolongada del host se registraron tres ciclos fallidos del dispatcher; su política de reintento recuperó el proceso y el probe posterior confirmó outbox sin retraso ni eventos en dead letter. La causa externa exacta no se atribuye sin telemetría persistida.
- La prueba visual no introdujo datos personales, credenciales ni historias clínicas.

### Evidencia RV-8C

| Control | Resultado |
|---|---|
| TypeScript estricto | Aprobado |
| Dependencias Expo SDK 57 | Aprobadas |
| Bundle web | Aprobado |
| Bundle Android/Hermes | Aprobado |
| Render web en escritorio | Aprobado |
| Render web compacto | Aprobado |
| Consola del navegador | Sin errores ni advertencias |
| Estado ARIA de radios | Aprobado después de corrección |
| ADB | Disponible, sin dispositivo conectado |

### Gate físico restante de RV-8C

No se declara una aceptación Android física: `adb devices -l` no listó ningún dispositivo durante el corte. El bundle Android sí compila. Al conectar el teléfono corresponde ejecutar login/registro, perfil profesional, carga de evidencia, solicitudes, ofertas, conversación, agenda, historia clínica y MENTA; además se deben comprobar TalkBack, fuente máxima, reducir movimiento, rotación, teclado y reconexión.

---

## 34. Registro de implementación — RV-8D Capturas y evidencia final

### Paquete generado

- Se creó `evidencia-refactor-visual-final.md` como índice autocontenido del corte RV-7C a RV-8D.
- La evidencia mapea cada exigencia Aficionado / Desarrollo con su archivo verificable.
- Se incorporaron tres capturas finales del bundle web: login de escritorio, validación compacta y registro profesional.
- Cada captura incluye resolución y SHA-256 para demostrar integridad.
- El documento separa resultados automatizados, validación real, gates manuales y trabajo fuera de alcance.
- El inventario de interfaz se actualizó para reflejar Lucide y MorphIcons; se retiró la referencia heredada a Material Icons.

### Criterio de honestidad

- No se incluyeron cuentas personales, contraseñas, tokens, ubicaciones, evidencia profesional ni información clínica.
- Las capturas autenticadas se reservan para un recorrido posterior con datos enteramente ficticios.
- El video permanece a cargo del responsable del proyecto, conforme al alcance acordado.
- Android real continúa como gate; el icono limpio general/iOS quedó resuelto con el recurso oficial.

### Evidencia RV-8D

| Control | Resultado |
|---|---|
| Matriz contra rúbrica oficial | Completa |
| Capturas públicas reproducibles | 3 |
| Integridad SHA-256 | Registrada |
| Secretos o datos privados en evidencia | Ninguno |
| Separación automatizado/manual | Explícita |
| Video | Fuera del corte técnico |

### Cierre del bloque visual

RV-7C, RV-7D, RV-7E, RV-8A, RV-8B, RV-8C y RV-8D quedan implementadas y documentadas en su alcance técnico. El gate de marca está cerrado; permanecen únicamente los pasos de aceptación con hardware y datos ficticios ya enumerados.

---

## 35. Cierre transversal — Logotipo e identificador oficial en interfaces

### Decisiones aplicadas desde la guía maestra

- Se revisaron las páginas de isotipo, variaciones, zona segura, tamaños, paleta, positivo/negativo y usos prohibidos del diseño oficial de Canva.
- El logotipo horizontal completo es la firma principal de Ruta Emocional; el isotipo queda como identificador complementario para formatos compactos y activos de plataforma.
- Se incorporaron las aplicaciones positiva sobre superficies claras y negativa sobre azul institucional, sin invertir automáticamente sus colores.
- El azul primario permanece en `#253A82`; el render conserva proporción mediante `contain` y respeta la zona segura incluida en cada activo.

### Integración reusable

- `BrandLogo` centraliza tamaños compacto, estándar y hero, aplicaciones positiva/negativa, accesibilidad y protección de color.
- `BrandSymbol` reserva el isotipo para iconos y cabeceras tituladas donde la firma horizontal perdería legibilidad.
- Login, registro y splash usan el logotipo negativo sobre fondo primario; la rehidratación y el inicio del paciente usan el positivo sobre superficie clara.
- Buscar, Agenda, Perfil, Solicitudes y Pacientes conservan el isotipo discretamente en encabezados raíz sin competir con el título ni con las acciones.
- La rehidratación segura de sesión muestra la marca antes de entregar la navegación.
- MENTA conserva identidad propia: el isotipo corporativo no reemplaza su iconografía funcional.

### Validación final del cierre

| Control | Resultado |
|---|---|
| TypeScript estricto | Aprobado |
| Pruebas de identidad (`BrandLogo` y `BrandSymbol`) | Aplicaciones positiva/negativa, proporción y accesibilidad cubiertas |
| Regresión frontend completa | 30 suites, 89 pruebas aprobadas |
| Validador del sistema visual | Aprobado |
| Validador de configuración nativa | Aprobado |
| Bundle web | Aprobado, 4 928 módulos |
| Bundle Android/Hermes | Aprobado, 3 538 módulos |
| Render web de login | Aprobado en 1440 × 1024 y 390 × 844 |
| Procesos temporales de QA | Detenidos al finalizar |
