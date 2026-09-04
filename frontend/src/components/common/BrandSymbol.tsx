import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Colors } from '../../theme/colors';
import { BorderRadius } from '../../theme/spacing';

const brandSymbolSource = require('../../../assets/brand/ruta-emocional-isotype.png');

export type BrandSymbolSize = 'compact' | 'standard' | 'hero';
export type BrandSymbolSurface = 'transparent' | 'badge';

export interface BrandSymbolProps {
  readonly size?: BrandSymbolSize;
  readonly surface?: BrandSymbolSurface;
  readonly decorative?: boolean;
}

/**
 * Isotipo complementario para espacios donde el logotipo completo no conserva
 * una lectura adecuada, como iconos de plataforma y cabeceras tituladas.
 */
export const BrandSymbol: React.FC<BrandSymbolProps> = ({
  size = 'standard',
  surface = 'transparent',
  decorative = false,
}) => (
  <View style={[styles.frame, frameSizes[size], surface === 'badge' && styles.badge]}>
    <Image
      source={brandSymbolSource}
      style={styles.image}
      resizeMode="contain"
      accessible={!decorative}
      accessibilityRole="image"
      accessibilityLabel={decorative ? undefined : 'Símbolo de Ruta Emocional'}
      accessibilityIgnoresInvertColors
    />
  </View>
);

const frameSizes = StyleSheet.create({
  compact: {
    width: 44,
    height: 44,
  },
  standard: {
    width: 72,
    height: 72,
  },
  hero: {
    width: 128,
    height: 128,
  },
});

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
