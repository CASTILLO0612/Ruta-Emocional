/**
 * AsyncState — Componente unificado para estados asíncronos.
 *
 * Maneja los cuatro estados estándar de datos:
 * 1. Carga (Spinner accesible + mensaje)
 * 2. Error (Alerta de feedback + botón de reintento)
 * 3. Vacío (Icono/ilustración + título + mensaje + acción opcional)
 * 4. Éxito / Contenido (Renderiza children)
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AlertCircle, Inbox, type LucideIcon } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { Layout } from '../../theme/layout';
import { AppButton } from '../common/AppButton';

export interface AsyncStateProps {
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly isEmpty?: boolean;
  readonly onRetry?: () => void;
  readonly loadingMessage?: string;
  readonly errorTitle?: string;
  readonly emptyTitle?: string;
  readonly emptyMessage?: string;
  readonly emptyIcon?: LucideIcon;
  readonly emptyActionLabel?: string;
  readonly onEmptyAction?: () => void;
  readonly children?: React.ReactNode;
}

export const AsyncState: React.FC<AsyncStateProps> = ({
  isLoading = false,
  error = null,
  isEmpty = false,
  onRetry,
  loadingMessage = 'Cargando información...',
  errorTitle = 'Ocurrió un inconveniente',
  emptyTitle = 'No hay datos disponibles',
  emptyMessage = 'Por el momento no hay información para mostrar.',
  emptyIcon: EmptyIcon = Inbox,
  emptyActionLabel,
  onEmptyAction,
  children,
}) => {
  if (isLoading) {
    return (
      <View
        style={styles.centered}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={loadingMessage}
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[Typography.bodySmall, styles.loadingText]}>
          {loadingMessage}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <View style={styles.errorIconContainer}>
          <AlertCircle
            size={IconSize.state}
            color={Colors.error}
            strokeWidth={IconStroke.regular}
          />
        </View>
        <Text style={[Typography.h4, styles.errorTitle]}>
          {errorTitle}
        </Text>
        <Text style={[Typography.body, styles.errorDescription]} accessibilityRole="alert">
          {error}
        </Text>
        {onRetry && (
          <AppButton
            label="Reintentar"
            onPress={onRetry}
            variant="outline"
            size="sm"
            style={styles.actionButton}
          />
        )}
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View
        style={styles.centered}
        accessible
        accessibilityLabel={`${emptyTitle}. ${emptyMessage}`}
      >
        <View style={styles.emptyIconContainer}>
          <EmptyIcon
            size={IconSize.state}
            color={Colors.textTertiary}
            strokeWidth={IconStroke.regular}
          />
        </View>
        <Text style={[Typography.h4, styles.emptyTitle]}>{emptyTitle}</Text>
        <Text style={[Typography.bodySmall, styles.emptyDescription]}>
          {emptyMessage}
        </Text>
        {emptyActionLabel && onEmptyAction && (
          <AppButton
            label={emptyActionLabel}
            onPress={onEmptyAction}
            variant="secondary"
            size="sm"
            style={styles.actionButton}
          />
        )}
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    minHeight: 240,
    width: '100%',
    maxWidth: Layout.maxReadableWidth,
    alignSelf: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.errorSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  errorTitle: {
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  errorDescription: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    maxWidth: 320,
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  emptyDescription: {
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    maxWidth: 300,
  },
  actionButton: {
    marginTop: Spacing.xs,
  },
});
