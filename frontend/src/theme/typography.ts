import { StyleSheet, TextStyle } from 'react-native';

// Inter es la fuente moderna estándar para apps de salud/fintech premium.
// En Expo Web se carga via CSS. En native, cae al sistema (San Francisco / Roboto).
export const FontFamily = {
  regular: 'Inter',
  medium: 'Inter',
  semiBold: 'Inter',
  bold: 'Inter',
} as const;

export const FontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 16,
  lg: 19,
  xl: 22,
  xxl: 28,
  display: 32,
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const LetterSpacing = {
  tighter: -1,
  tight: -0.4,
  normal: 0,
  wide: 0.3,
  wider: 0.8,
} as const;

export const Typography = StyleSheet.create({
  display: {
    fontSize: FontSize.display,
    fontWeight: '800',
    letterSpacing: LetterSpacing.tighter,
    lineHeight: FontSize.display * LineHeight.tight,
  } as TextStyle,
  h1: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    letterSpacing: LetterSpacing.tight,
    lineHeight: FontSize.xxl * 1.25,
  } as TextStyle,
  h2: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    letterSpacing: LetterSpacing.tight,
    lineHeight: FontSize.xl * 1.3,
  } as TextStyle,
  h3: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,
  h4: {
    fontSize: FontSize.md,
    fontWeight: '600',
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,
  bodyLarge: {
    fontSize: FontSize.md,
    fontWeight: '400',
    lineHeight: FontSize.md * LineHeight.normal,
  } as TextStyle,
  body: {
    fontSize: FontSize.base,
    fontWeight: '400',
    lineHeight: FontSize.base * LineHeight.normal,
  } as TextStyle,
  bodySmall: {
    fontSize: FontSize.sm,
    fontWeight: '400',
    lineHeight: FontSize.sm * LineHeight.relaxed,
  } as TextStyle,
  caption: {
    fontSize: FontSize.xs,
    fontWeight: '400',
    letterSpacing: LetterSpacing.wide,
  } as TextStyle,
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
  } as TextStyle,
  button: {
    fontSize: FontSize.base,
    fontWeight: '700',
    letterSpacing: LetterSpacing.wide,
  } as TextStyle,
  price: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: LetterSpacing.tighter,
  } as TextStyle,
  priceSm: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,
  overline: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
  } as TextStyle,
});
