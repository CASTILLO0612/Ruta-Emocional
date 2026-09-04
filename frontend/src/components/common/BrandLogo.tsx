import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const logoSources = {
  positive: require('../../../assets/brand/ruta-emocional-logo-positive.png'),
  negative: require('../../../assets/brand/ruta-emocional-logo-negative.png'),
} as const;

export type BrandLogoSize = 'header' | 'compact' | 'standard' | 'hero';
export type BrandLogoVariant = keyof typeof logoSources;

export interface BrandLogoProps {
  readonly size?: BrandLogoSize;
  readonly variant?: BrandLogoVariant;
  readonly decorative?: boolean;
}

/**
 * Logotipo principal de Ruta Emocional.
 *
 * La variante positiva se usa sobre superficies claras y la negativa sobre el
 * azul institucional. El componente mantiene la proporción y protege los
 * colores de marca frente a la inversión automática de accesibilidad.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'standard',
  variant = 'positive',
  decorative = false,
}) => (
  <View style={[styles.frame, frameSizes[size]]}>
    <Image
      source={logoSources[variant]}
      style={styles.image}
      resizeMode="contain"
      accessible={!decorative}
      accessibilityRole="image"
      accessibilityLabel={decorative ? undefined : 'Ruta Emocional'}
      accessibilityIgnoresInvertColors
    />
  </View>
);

const frameSizes = StyleSheet.create({
  header: {
    width: 88,
    height: 32,
  },
  compact: {
    width: 128,
    height: 44,
  },
  standard: {
    width: 216,
    height: 72,
  },
  hero: {
    width: 288,
    height: 96,
  },
});

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
