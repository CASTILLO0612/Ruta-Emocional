/**
 * PrimaryActionCard — Tarjeta de acción primaria dominante en Inicio.
 *
 * Principio rector: Una sola acción primaria visible por pantalla.
 * Conduce directamente a la pestaña Buscar donde el paciente inicia
 * el formulario guiado paso a paso o gestiona su búsqueda activa.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Compass } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { AppButton } from '../common/AppButton';

interface PrimaryActionCardProps {
  readonly onStartSearch: () => void;
}

export const PrimaryActionCard: React.FC<PrimaryActionCardProps> = ({
  onStartSearch,
}) => (
  <View style={styles.container}>
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Compass
          size={IconSize.action}
          color={Colors.accent}
          strokeWidth={IconStroke.emphasized}
        />
      </View>

      <Text style={[Typography.h3, styles.title]}>
        Encuentra apoyo profesional
      </Text>

      <AppButton
        label="Buscar acompañamiento"
        onPress={onStartSearch}
        variant="secondary"
        size="lg"
        fullWidth
        accessibilityLabel="Iniciar búsqueda de acompañamiento psicológico"
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    ...Shadow.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceOnBrand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.textInverse,
    marginBottom: Spacing.md,
  },
});
