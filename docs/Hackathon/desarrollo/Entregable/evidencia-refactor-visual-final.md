# Evidencia final del refactor visual

**Proyecto:** Ruta Emocional<br>
**Categoría y área:** Aficionado / Desarrollo<br>
**Corte técnico:** RV-7C a RV-8D<br>
**Fecha de verificación:** 28 de septiembre de 2026<br>
**Rama verificada:** `postgresql-migration`

## 1. Objetivo y alcance

Este documento consolida la evidencia del refactor visual y de su validación técnica. El alcance incluye pacientes e historia clínica, acceso y verificación profesional, mensajería y MENTA, estados comunes, responsive, accesibilidad, recursos de marca, bundle Android y recorrido web público.

No sustituye el video de navegación. Tampoco declara como aprobada una prueba física que no haya sido ejecutada: al momento de este corte ADB estaba disponible, pero no había un dispositivo Android conectado.

## 2. Trazabilidad con la rúbrica oficial

| Requisito Aficionado / Desarrollo | Evidencia verificable | Estado |
|---|---|---|
| README técnico | [`README.md`](../../../../README.md) | Completo |
| Diagrama de base de datos | [DER conceptual](Diagrama%20ER.pdf), [catálogo conceptual](modelo-entidad-relacion-conceptual.md) y [3FN](../../../database/normalization-3nf.md) | Completo; supera 2FN |
| Interfaces navegables y formularios funcionales | [Inventario funcional](evidencia-interfaz-y-formularios.md) y capturas de este documento | Completo para el recorrido validado |
| Control de versiones | [Evidencia Git](evidencia-control-versiones.md) | Completo al confirmar y sincronizar este corte |
| Seguridad, código legible y tres roles | [Roles y permisos](roles-y-permisos.md), [matriz de autorización](../../../security/authorization-matrix.md) y pruebas backend | Completo |
| Ejecución local | [`README.md`](../../../../README.md#instalación) y comprobaciones de este documento | Completo |
| Video | A cargo del responsable del proyecto | Fuera del corte técnico |

## 3. Evidencia visual

### 3.1 Login web en escritorio

![Login de Ruta Emocional en escritorio](evidencias-visuales/01-login-web-escritorio.png)

La pantalla presenta una única tarea, jerarquía clara, Poppins/Inter, acción dominante, campos etiquetados, recuperación de acceso y ancho de lectura controlado. El encabezado compacto conserva la firma oficial sin competir con el formulario; privacidad, términos y ayuda completan la señal de confianza. El render se capturó desde el bundle web en una ventana de escritorio.

### 3.2 Registro compacto y validación

![Registro de paciente con validación visible](evidencias-visuales/02-registro-validacion-web-movil.png)

La validación bloquea el envío incompleto, asocia un mensaje a cada campo, conserva un resumen no intrusivo y no depende únicamente del color. En 390 px no se detectó desbordamiento horizontal y todos los controles visibles alcanzaron al menos 44 px de alto.

### 3.3 Registro profesional

![Registro de psicólogo](evidencias-visuales/03-registro-profesional-web.png)

La variante profesional reutiliza el mismo formulario y revela la colegiatura solo cuando corresponde. Paciente y psicólogo se exponen como radios reales; la opción activa se anuncia con `aria-checked` en web y `accessibilityState.checked` en nativo.

### Integridad de las capturas

| Archivo | Resolución | SHA-256 |
|---|---:|---|
| `01-login-web-escritorio.png` | 1440 × 1024 | `278994A16C3BCE1865D646B8624CF0B4BA79C48C82524B8914EB1721AFC9DD62` |
| `02-registro-validacion-web-movil.png` | 390 × 844 | `609DDB6A0E08EE20B2ACFDC52B9F1D642FE58B52178C866AA496318108C63819` |
| `03-registro-profesional-web.png` | 390 × 843 | `55A514564B0328615D9C57FE45A196F75CC02B980E6D87BFC3021763C7B442E7` |

## 4. Validación visual y accesible ejecutada

| Control | Resultado |
|---|---|
| Render del bundle web exportado | Aprobado |
| Consola del navegador en login y registro | Sin errores ni advertencias |
| Vista compacta a 390 × 844 | Sin desbordamiento horizontal |
| Vista de escritorio | Sin desbordamiento horizontal |
| Altura mínima de controles visibles | 44 px |
| Validación de formulario | Alertas por campo y resumen visibles |
| Navegación por teclado | Orden coherente por campos, acción y retorno |
| Radios paciente/psicólogo | `aria-checked=true/false` verificado en DOM |
| Pantallas inactivas del stack | Aisladas con `aria-hidden=true` |
| Idioma del documento web | `es` |
| Color de tema web | `#253A82` |
| Viewport móvil | Declarado correctamente |
| Contraste de combinaciones funcionales | WCAG AA automatizado |
| Movimiento reducido | Respetado por hooks y componentes comunes |

Durante la aceptación web se detectó que React Native Web no trasladaba el estado seleccionado de los radios desde `accessibilityState`. La corrección conserva la semántica nativa y añade ARIA explícito para web. El validador visual impide reincorporar radios, checkboxes o tabs sin su estado ARIA correspondiente.

## 5. Verificación técnica reproducible

| Verificación | Resultado del corte |
|---|---|
| TypeScript frontend | Aprobado, cero errores |
| Validador del sistema visual | Aprobado |
| Validador de configuración nativa | Aprobado |
| Compatibilidad Expo SDK 57 | Dependencias actualizadas y compatibles |
| Pruebas frontend | 57 suites, 148 pruebas aprobadas sin advertencias de React |
| Pruebas unitarias backend | 57 pruebas aprobadas |
| Integración HTTP de autenticación | Aprobada contra PostgreSQL, incluida recuperación de un solo uso |
| Integración HTTP transversal | 9 suites aprobadas, sin regresiones de módulos existentes |
| Migraciones PostgreSQL | 25 aplicadas desde una base aislada vacía; esquema de desarrollo actualizado |
| Consistencia documental | 62/62 relaciones con cobertura 3FN, 62/62 modelos trazados y documentos privados fuera de Git |
| Salud del backend | `live=ok` y `ready=ok` |
| PostgreSQL en readiness | `database=ok` |
| Outbox en readiness | `messagingOutbox=ok` después de recuperación automática |
| Privacidad en readiness | `privacyRequests=ok` |
| Carga de readiness local | 200 solicitudes, concurrencia 20, cero fallos, p95 279.77 ms |
| Streaming Ollama local | 17 fragmentos nativos; 8.96 s al primer fragmento en arranque frío |
| Exportación web | Aprobada, 5 038 módulos |
| Exportación Android/Hermes | Aprobada, 3 555 módulos |
| Development build Android | APK generado, instalado y ejecutado en Android 16 emulado |
| Accesibilidad de acceso | Etiquetas y objetivos táctiles inspeccionados; fuente al 200 % sin recortes |
| Google nativo | Flujo entregado correctamente a Google Play Services; cuenta externa no incorporada al emulador |

Comandos equivalentes:

```bash
npm run quality:delivery
TEST_DATABASE_URL=<base_postgresql_aislada> npm --prefix backend run test:integration
npx --prefix frontend expo export --platform web
npx --prefix frontend expo export --platform android
```

Los bundles y el APK de QA se generaron fuera del repositorio, por lo que no
pueden incorporarse accidentalmente a Git. Los secretos, archivos
`.env`, tokens, evidencias profesionales y datos clínicos no forman parte de las
capturas ni de este documento.

La integración del 28 de septiembre se ejecutó sobre una base exclusiva creada
vacía para QA. Las 27 migraciones se aplicaron en orden, las 9 suites finalizaron
en verde y la base temporal se eliminó después de comprobar que no mantenía
conexiones. La base de desarrollo no se usó como destino destructivo.

El mismo corte verificó el reinicio de MENTA de extremo a extremo: la
conversación anterior se cierra, la nueva comienza sin turnos heredados y el
historial cifrado permanece disponible únicamente para auditoría autorizada.

La compilación nativa se ejecutó desde una copia temporal de QA con ruta corta.
La ubicación habitual del repositorio supera el límite de rutas de CMake/Ninja
en Windows; el código y las dependencias compilan correctamente al retirar esa
restricción ambiental. El APK resultante arrancó sin módulos ausentes ni
excepciones fatales, mostró el acceso completo, conservó su jerarquía con fuente
al 200 % y abrió el flujo nativo de Google Play Services.

El DER final se regeneró con 43 entidades, 72 relaciones y 7 N:N. Sus 16 páginas
se renderizaron a PNG y se inspeccionaron individualmente para descartar texto
cortado, solapamientos, atributos ilegibles o mezcla de elementos físicos.

En una jornada de QA prolongada el dispatcher registró tres ciclos fallidos transitorios y continuó reintentando. La comprobación posterior devolvió `messagingOutbox=ok`, sin retraso ni dead letters. No se adjudica una causa definitiva sin logs externos persistidos; este dato queda conservado para la futura fase de observabilidad productiva.

## 6. Resultado por fase

| Fase | Resultado |
|---|---|
| RV-7C Pacientes e historia clínica | Implementada y automatizada; aceptación clínica física pendiente |
| RV-7D Login, registro, perfil y verificación | Implementada y automatizada; acceso minimalista, recuperación segura y recorrido público web aprobados |
| RV-7E Inbox, conversación y MENTA | Implementada y automatizada, incluido streaming y reinicio seguro; prueba multidispositivo pendiente |
| RV-8A Estados, responsive y accesibilidad | Implementada; regresión ARIA encontrada y corregida |
| RV-8B Iconos, splash y marca | Firma horizontal oficial en encabezados y acceso; isotipo reservado para iconos, splash compacto y activos de plataforma |
| RV-8C Android y web | Bundles aprobados, web inspeccionada y Android 16 emulado ejecutado; dispositivo físico pendiente |
| RV-8D Evidencia final | Paquete técnico y capturas públicas completos; video fuera de alcance |

## 7. Gates manuales que no deben presentarse como aprobados

1. Conectar un Android real y ejecutar el recorrido completo con paciente y psicólogo ficticios.
2. Validar TalkBack, fuente máxima, reducir movimiento, teclado abierto, rotación, selección de evidencia y reconexión.
3. Repetir conversación con dos dispositivos y comprobar envío simultáneo, reconexión y ausencia de duplicados.
4. Recorrer historia clínica con una relación asistencial ficticia, incluyendo firma y enmienda.
5. Capturar las pantallas autenticadas finales únicamente con cuentas y datos ficticios.

Estos gates no invalidan el cumplimiento Aficionado / Desarrollo ya documentado, pero sí son necesarios antes de afirmar una aceptación móvil integral o preparación productiva.

## 8. Cierre de identidad visual del producto

- El logotipo y el isotipo entregados se contrastaron con las páginas 7 a 20 del diseño maestro de Canva.
- La aplicación reconoce el logotipo horizontal como firma principal y reserva el isotipo como identificador complementario para espacios compactos y activos de plataforma.
- Las aplicaciones positiva y negativa conservan zona segura, proporción mediante `contain` y protección ante inversión automática de color.
- Login, registro y splash usan el logotipo negativo; rehidratación e inicio usan el positivo; los encabezados titulados usan la firma horizontal correspondiente y reservan el isotipo para espacios realmente compactos.
- Icono general, primer plano adaptativo y favicon mantienen el isotipo sobre `#253A82`, mientras el splash emplea la firma horizontal negativa.
- No se declara icono monocromático temático porque la guía de identidad prohíbe explícitamente las variaciones en escala de grises.
- Las pruebas de identidad validan ambas aplicaciones, accesibilidad y ausencia de deformación; el validador nativo fija rutas, tamaños y colores de plataforma.
