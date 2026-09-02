import { Platform } from 'react-native';

import { BrandColors } from './colors';

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  giant: 64,
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
} as const;

export const Shadow = {
  sm: Platform.select({
    web: { boxShadow: `0 2px 6px ${BrandColors.navy}0A` },
    default: {
      shadowColor: BrandColors.navy,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
  })!,
  md: Platform.select({
    web: { boxShadow: `0 4px 16px ${BrandColors.navy}14` },
    default: {
      shadowColor: BrandColors.navy,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
  })!,
  lg: Platform.select({
    web: { boxShadow: `0 8px 24px ${BrandColors.navy}1A` },
    default: {
      shadowColor: BrandColors.navy,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 5,
    },
  })!,
  xl: Platform.select({
    web: { boxShadow: `0 16px 32px ${BrandColors.navy}1F` },
    default: {
      shadowColor: BrandColors.navy,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.12,
      shadowRadius: 32,
      elevation: 8,
    },
  })!,
} as const;

export type SpacingKey = keyof typeof Spacing;
export type BorderRadiusKey = keyof typeof BorderRadius;
