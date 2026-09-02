/**
 * Ruta Emocional color system.
 *
 * Brand colors come from the official visual identity. Product neutrals and
 * semantic feedback colors complement the brand without changing it.
 */
export const BrandColors = {
  navy: '#253A82',
  periwinkle: '#88A2FF',
  lilac: '#A89DFF',
  lightBlue: '#C0E0FF',
  pink: '#FFB2F7',
  lime: '#E3FC87',
} as const;

export const NeutralColors = {
  950: '#172033',
  700: '#475569',
  500: '#64748B',
  300: '#CBD5E1',
  200: '#E2E8F0',
  100: '#F1F5F9',
  50: '#F8FAFC',
  white: '#FFFFFF',
} as const;

export const Colors = {
  // Brand and primary interaction
  primary: BrandColors.navy,
  primaryLight: BrandColors.periwinkle,
  primaryDark: NeutralColors[950],
  primaryFaded: 'rgba(37, 58, 130, 0.08)',
  primarySubtle: 'rgba(37, 58, 130, 0.05)',
  primaryTint: '#F1F4FF',
  primaryTintStrong: BrandColors.lightBlue,
  primaryOverlay: 'rgba(255, 255, 255, 0.16)',

  // Brand accents. Lime communicates positive emphasis, not every success.
  accent: BrandColors.lime,
  accentLight: '#F1FFD0',
  accentDark: BrandColors.navy,
  accentFaded: 'rgba(227, 252, 135, 0.28)',
  technology: BrandColors.lilac,
  emotional: BrandColors.pink,
  interactive: BrandColors.periwinkle,
  informative: BrandColors.lightBlue,

  // Surfaces
  background: NeutralColors[50],
  surface: NeutralColors.white,
  surfaceMuted: NeutralColors[100],
  surfaceRaised: NeutralColors.white,
  surfaceSoft: NeutralColors[50],
  overlay: 'rgba(23, 32, 51, 0.68)',

  // Text
  textPrimary: NeutralColors[950],
  textSecondary: NeutralColors[700],
  textTertiary: NeutralColors[500],
  textDisabled: '#94A3B8',
  textInverse: NeutralColors.white,
  textOnBrandMuted: 'rgba(255, 255, 255, 0.76)',
  textAccent: BrandColors.navy,
  surfaceOnBrand: 'rgba(255, 255, 255, 0.10)',
  borderOnBrand: 'rgba(255, 255, 255, 0.18)',

  // Semantic feedback colors remain distinct from the brand palette.
  success: '#157A4A',
  successSurface: '#ECFDF3',
  successBorder: '#A7E3C3',
  warning: '#B45309',
  warningSurface: '#FFF7ED',
  warningBorder: '#FED7AA',
  error: '#C2414D',
  errorFaded: 'rgba(194, 65, 77, 0.08)',
  errorSurface: '#FFF1F2',
  errorBorder: '#FECDD3',
  info: BrandColors.navy,
  infoSurface: '#EFF6FF',
  infoBorder: BrandColors.lightBlue,

  // Borders and dividers
  border: NeutralColors[300],
  borderSubtle: NeutralColors[200],
  borderStrong: '#94A3B8',
  divider: NeutralColors[200],

  // Specialized visuals
  starFilled: '#D97706',
  starEmpty: NeutralColors[300],
  radarRing: 'rgba(136, 162, 255, 0.20)',
  radarCore: BrandColors.navy,
  routeLine: BrandColors.navy,
  callBackground: BrandColors.navy,
  callControl: 'rgba(255, 255, 255, 0.15)',
  callControlDisabled: 'rgba(194, 65, 77, 0.28)',
  callPreview: 'rgba(23, 32, 51, 0.72)',
} as const;

export type ColorKey = keyof typeof Colors;
