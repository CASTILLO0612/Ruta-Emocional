import { StyleSheet, TextStyle } from 'react-native';

export const FontFamily = {
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  display: 38,
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
} as const;

export const Typography = StyleSheet.create({
  display: {
    fontSize: FontSize.display,
    fontWeight: '800',
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,
  h1: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,
  h2: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,
  h3: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  } as TextStyle,
  h4: {
    fontSize: FontSize.md,
    fontWeight: '600',
  } as TextStyle,
  bodyLarge: {
    fontSize: FontSize.md,
    fontWeight: '400',
  } as TextStyle,
  body: {
    fontSize: FontSize.base,
    fontWeight: '400',
  } as TextStyle,
  bodySmall: {
    fontSize: FontSize.sm,
    fontWeight: '400',
  } as TextStyle,
  caption: {
    fontSize: FontSize.xs,
    fontWeight: '400',
    letterSpacing: LetterSpacing.wide,
  } as TextStyle,
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    letterSpacing: LetterSpacing.wide,
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
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,
  priceSm: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  } as TextStyle,
});
