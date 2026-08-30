export const Colors = {
  // Azul principal — más elegante, sin saturación extrema
  primary: '#1A2F6B',
  primaryLight: '#2845A0',
  primaryDark: '#0D1B3E',
  primaryFaded: 'transparent',
  primarySubtle: 'transparent',
  primaryTint: '#EEF2FF',
  primaryTintStrong: '#DCE4FA',
  primaryOverlay: 'rgba(255, 255, 255, 0.16)',

  // Accent verde — reservado solo para estados "live" y éxito
  accent: '#22C55E',
  accentLight: '#4ADE80',
  accentDark: '#16A34A',
  accentFaded: 'transparent',

  // Fondos — muy suaves, casi blancos
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#FFFFFF',
  surfaceRaised: '#FCFCFD',
  surfaceSoft: '#F8FAFC',
  overlay: 'rgba(13, 27, 62, 0.65)',

  // Texto — jerarquía clara de 4 niveles
  textPrimary: '#0D1B3E',
  textSecondary: '#4A5778',
  textTertiary: '#8897B8',
  textDisabled: '#BEC8DF',
  textInverse: '#FFFFFF',
  textAccent: '#16A34A',

  // Estados semánticos
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  errorFaded: 'transparent',
  errorSurface: '#FEF2F2',
  errorBorder: '#FECACA',
  warningSurface: '#FFF7ED',
  warningBorder: '#FED7AA',
  info: '#3B82F6',

  // Bordes — mucho más sutiles
  border: '#EEEEEE',
  borderSubtle: '#F7F7F7',
  borderStrong: '#E0E0E0',
  divider: '#F0F0F0',

  // Decorativos
  starFilled: '#F59E0B',
  starEmpty: '#DDE3F0',
  radarRing: '#22C55E30',
  radarCore: '#22C55E',
  routeLine: '#1A2F6B',
} as const;

export type ColorKey = keyof typeof Colors;
