# Refactor transversal de identidad visual

**Estado:** implementado y validado localmente
**Alcance:** frontend Expo SDK 57, sin cambios en contratos HTTP ni reglas de negocio

## 1. Objetivo

Consolidar las interfaces existentes de Ruta Emocional bajo una sola identidad
visual profesional, accesible y reutilizable. El refactor conserva los flujos de
paciente, psicólogo y administración; no reemplaza repositorios, estados del
dominio, autorización ni persistencia.

## 2. Fuentes de diseño

- [Guía tipográfica en Canva](https://www.canva.com/design/DAHT3oFZtDI/wEmf3Kk65vGKTwD_WlKhDw/edit)
- [Identidad visual en Canva](https://www.canva.com/design/DAHTUnFb_2Q/7Omp_ZaJeUO1H49JIQytAg/edit)
- `docs/Hackathon/Identidad Visual/Guía de Diseño de Interfaces — Ruta Emocional.docx`

La identidad original de Canva se tomó como fuente de verdad para la variante
lila: `#A89DFF`. El valor `#AB9DFF` encontrado en el documento resumen se trata
como una inconsistencia tipográfica y no se utiliza en el producto.

## 3. Decisiones implementadas

### Color

La paleta oficial quedó centralizada en `frontend/src/theme/colors.ts`:

- azul principal `#253A82`;
- lavanda `#A89DFF`;
- rosa `#FFB2F7`;
- azul interactivo `#88A2FF`;
- azul claro `#C0E0FF`;
- lima `#E3FC87`.

Los estados de éxito, advertencia y error utilizan colores semánticos separados
para evitar que un color de marca cambie de significado entre pantallas. Ninguna
pantalla declara colores hexadecimales o valores RGB por su cuenta.

### Tipografía

- Poppins: jerarquía de marca, títulos, encabezados y precios.
- Inter: cuerpo, formularios, botones, etiquetas y contenido denso.
- Las fuentes se cargan una sola vez en `App.tsx` mediante `expo-font`, de forma
  compatible con Expo Go y los development builds de SDK 57.
- Las pantallas consumen variantes nominales de `FontFamily`; no utilizan pesos
  tipográficos manuales.

### Iconografía y movimiento

- Lucide es el único lenguaje iconográfico del producto: `lucide-react-native`
  renderiza los iconos estáticos y el paquete `lucide` aporta la geometría de
  los estados que se transforman.
- MorphIcons se usa únicamente en cambios de estado con significado: mostrar u
  ocultar contraseña, otorgar consentimiento a MENTA, abrir o cerrar editores
  clínicos y completar requisitos profesionales. No se anima la iconografía
  decorativa ni la navegación.
- `AppMorphIcon` encapsula la configuración común, utiliza el binding nativo
  sobre `react-native-svg` en Android/iOS y el binding React en Web. Todas las
  transiciones respetan la preferencia de movimiento reducido del sistema.
- Se retiraron las dependencias directas y usos de Material Icons.
- No se permiten emojis en código de interfaz.
- Las animaciones de entrada y feedback usan duraciones centralizadas y evitan
  el driver nativo en Web.

### Componentes y superficies

- Botones, tarjetas, alertas, toasts, selectores, calificación y controles de
  formularios comparten radios, espaciado, tipografía, contraste y estados.
- Las sombras son discretas y se resuelven con `boxShadow` en Web y propiedades
  nativas en Android/iOS.
- Los controles interactivos principales mantienen un área táctil mínima de 44
  puntos.
- Los textos transaccionales se ajustaron a la terminología de la guía:
  “oferta”, “propuesta”, “contraoferta” y “solicitud de atención”.

## 4. Cobertura

El refactor se aplicó a:

- acceso y registro;
- inicio y directorio del paciente;
- búsqueda y recepción de propuestas;
- perfil público del psicólogo;
- MENTA contextual y orientación estructurada de seguridad;
- bandeja de conversaciones y conversación segura;
- agenda y citas;
- perfil de cuenta;
- onboarding y verificación profesional;
- solicitudes del psicólogo;
- historia clínica;
- cola administrativa de verificaciones;
- superficies de llamada y mapa Web.

La navegación profesional conserva sus seis destinos. Para evitar truncamiento
en teléfonos estrechos utiliza una escala tipográfica específica, sin esconder
las etiquetas ni depender únicamente del icono.

## 5. Controles automáticos

`npm run validate:design` falla si una pantalla vuelve a introducir:

- Material Icons;
- colores no centralizados;
- pesos tipográficos manuales;
- imports directos de MorphIcons fuera del adaptador común por plataforma.

`npm run validate:native-config` sigue rechazando emojis, secretos de servidor
inyectados al cliente y configuraciones nativas inseguras. Las versiones de
parche recomendadas para Expo SDK 57 también quedaron fijadas y verificadas.

## 6. Verificación ejecutada

Se completaron correctamente:

```text
npm run typecheck
npm run validate:design
npm run validate:native-config
npx expo install --check
npx expo export --platform all
```

La revisión visual en Expo Web se realizó con viewport móvil de 390 × 844 y con
datos sintéticos locales. Se recorrieron pantallas de paciente, psicólogo y
administración, incluida una aprobación profesional controlada. No se utilizaron
datos clínicos ni credenciales reales.

La transición MorphIcons se verificó además observando la geometría SVG durante
y después del cambio de estado. Los bundles de Android, iOS y Web resolvieron
correctamente sus adaptadores específicos.

## 7. Pendientes explícitos

1. Sustituir los pictogramas temporales de cabecera por el logotipo/isotipo
   oficial cuando se entregue el activo maestro en SVG o PNG transparente. No se
   debe reconstruir el logotipo a partir de una captura comprimida.
2. Ejecutar pruebas manuales de accesibilidad, escalado de texto y contraste en
   Android físico y, cuando exista disponibilidad, en iOS.
3. Añadir regresión visual automatizada cuando el pipeline de CI disponga de un
   entorno estable para renderizar Expo Web.
4. Dar seguimiento a las vulnerabilidades transitivas moderadas que permanecen
   en Expo y React Navigation. El hallazgo alto de `browserslist` se corrigió con
   `npm audit fix`; no se aplicó `--force` porque la resolución propuesta degrada
   versiones mayores e introduce cambios incompatibles.
