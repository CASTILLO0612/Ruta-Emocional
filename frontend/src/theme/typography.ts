import { StyleSheet, TextStyle } from 'react-native';

export const FontFamily = {
  brandRegular: 'Poppins_400Regular',
  brandSemiBold: 'Poppins_600SemiBold',
  brandBold: 'Poppins_700Bold',
  bodyRegular: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',

  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const FontSize = {
  navigation: 10,
  xs: 12,
  sm: 14,
  base: 16,
  md: 16,
  lg: 19,
  xl: 23,
  xxl: 27,
  display: 32,
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.65,
} as const;

export const LetterSpacing = {
  tighter: -0.8,
  tight: -0.3,
  normal: 0,
  wide: 0.2,
  wider: 0.6,
} as const;

export const Typography = StyleSheet.create({
  display: {
    fontFamily: FontFamily.brandBold,
    fontSize: FontSize.display,
    letterSpacing: LetterSpacing.tighter,
    lineHeight: FontSize.display * LineHeight.tight,
  } as TextStyle,
  h1: {
    fontFamily: FontFamily.brandBold,
    fontSize: FontSize.xxl,
    letterSpacing: LetterSpacing.tight,
    lineHeight: FontSize.xxl * 1.25,
  } as TextStyle,
  h2: {
    fontFamily: FontFamily.brandBold,
    fontSize: FontSize.xl,
    letterSpacing: LetterSpacing.tight,
    lineHeight: FontSize.xl * 1.3,
  } as TextStyle,
  h3: {
    fontFamily: FontFamily.brandBold,
    fontSize: FontSize.lg,
    letterSpacing: LetterSpacing.normal,
    lineHeight: FontSize.lg * 1.35,
  } as TextStyle,
  h4: {
    fontFamily: FontFamily.brandSemiBold,
    fontSize: FontSize.md,
    letterSpacing: LetterSpacing.normal,
    lineHeight: FontSize.md * 1.4,
  } as TextStyle,
  bodyLarge: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: FontSize.md,
    lineHeight: FontSize.md * LineHeight.normal,
  } as TextStyle,
  body: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.normal,
  } as TextStyle,
  bodySmall: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
  } as TextStyle,
  caption: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * LineHeight.normal,
    letterSpacing: LetterSpacing.wide,
  } as TextStyle,
  label: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.4,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
  } as TextStyle,
  button: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: LetterSpacing.wide,
  } as TextStyle,
  price: {
    fontFamily: FontFamily.brandBold,
    fontSize: FontSize.xxl,
    letterSpacing: LetterSpacing.tighter,
  } as TextStyle,
  priceSm: {
    fontFamily: FontFamily.brandBold,
    fontSize: FontSize.lg,
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,
  overline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.4,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
  } as TextStyle,
});
