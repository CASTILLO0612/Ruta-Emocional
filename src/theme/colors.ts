export const Colors = {
  primary: '#0A2463',
  primaryLight: '#1E3A8A',
  primaryDark: '#061640',
  primaryFaded: '#0A246320',

  accent: '#39D353',
  accentLight: '#6EE77E',
  accentDark: '#25A33C',
  accentFaded: '#39D35320',

  background: '#F7F8FC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  overlay: 'rgba(10,36,99,0.72)',

  textPrimary: '#0D1B3E',
  textSecondary: '#5A6A8A',
  textDisabled: '#B0BAD0',
  textInverse: '#FFFFFF',
  textAccent: '#25A33C',

  success: '#39D353',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  border: '#E2E8F4',
  borderStrong: '#C8D3E8',
  divider: '#EEF1F9',

  starFilled: '#F59E0B',
  starEmpty: '#D1D9EC',

  radarRing: '#39D35340',
  radarCore: '#39D353',
  routeLine: '#0A2463',
} as const;

export type ColorKey = keyof typeof Colors;
