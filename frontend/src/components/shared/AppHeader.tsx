/**
 * AppHeader — Encabezado configurable compartido.
 *
 * Reglas:
 * - Máximo dos acciones visibles a la derecha del título.
 * - showBack ocupa la izquierda y tiene prioridad. Representa un botón visual
 *   de retroceso de navegación; es independiente del back físico de Android.
 * - showMenta y showInbox pueden omitirse en pantallas donde no aporten contexto.
 * - La acción contextual tiene prioridad y el total permanece limitado a dos acciones.
 * - Soporta subtítulo contextual accesible.
 * - Todas las acciones tienen accessibilityLabel.
 * - InboxHeaderAction no muestra badge en v1 (sin unreadCount en el contrato actual).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, MessageCircle, BrainCircuit } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { IconSize, IconStroke } from '../../theme/icons';
import { Layout } from '../../theme/layout';
import { BrandLogo } from '../common/BrandLogo';

export interface HeaderContextualAction {
  readonly label: string;
  readonly icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  readonly onPress: () => void;
}

export interface AppHeaderProps {
  /**
   * Título centrado del encabezado. Omitir en pantallas de inicio que muestren logo.
   */
  readonly title?: string;
  /**
   * Subtítulo descriptivo opcional para contexto de pantalla o rol.
   */
  readonly subtitle?: string;
  /**
   * Muestra el logotipo principal en su aplicación positiva en lugar del título.
   */
  readonly showBrand?: boolean;
  /** Muestra el logotipo oficial compacto en encabezados raíz con título. */
  readonly showBrandMark?: boolean;
  /** @deprecated Usar showBrandMark. Se conserva para compatibilidad transitoria. */
  readonly showBrandSymbol?: boolean;
  /**
   * Botón visual de retroceso (chevron). Representa navegación hacia atrás en el stack,
   * no el botón físico de Android (que React Navigation gestiona automáticamente).
   */
  readonly showBack?: boolean;
  /**
   * Callback personalizado para el botón de retroceso.
   */
  readonly onBack?: () => void;
  /**
   * Muestra el acceso a MentaAgentScreen (movido al AppStack).
   */
  readonly showMenta?: boolean;
  /**
   * Muestra el acceso a InboxScreen. Sin badge en v1.
   */
  readonly showInbox?: boolean;
  /**
   * Acción contextual adicional. Ocupa el primer espacio disponible.
   */
  readonly contextualAction?: HeaderContextualAction;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  showBrand = false,
  showBrandMark = false,
  showBrandSymbol = false,
  showBack = false,
  onBack,
  showMenta = false,
  showInbox = false,
  contextualAction,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const rightActions: HeaderContextualAction[] = [];

  if (contextualAction) {
    rightActions.push(contextualAction);
  }

  if (showMenta && rightActions.length < 2) {
    rightActions.push({
      label: 'Abrir MENTA',
      icon: BrainCircuit,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPress: () => (navigation as any).navigate('MentaAgent'),
    });
  }

  if (showInbox && rightActions.length < 2) {
    rightActions.push({
      label: 'Abrir mensajes',
      icon: MessageCircle,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPress: () => (navigation as any).navigate('Inbox'),
    });
  }

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}
      accessibilityRole="header"
    >
      {/* Izquierda */}
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity
            onPress={onBack ? onBack : () => navigation.goBack()}
            style={styles.iconButton}
            accessibilityLabel="Volver atrás"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft
              size={IconSize.navigation}
              color={Colors.textPrimary}
              strokeWidth={IconStroke.regular}
            />
          </TouchableOpacity>
        )}
        {!showBack && (showBrandMark || showBrandSymbol) ? (
          <BrandLogo size="header" variant="positive" decorative />
        ) : null}
      </View>

      {/* Centro */}
      <View style={styles.center}>
        {showBrand ? (
          <BrandLogo size="compact" variant="positive" />
        ) : title ? (
          <View style={styles.titleContainer}>
            <Text
              style={[Typography.h4, { color: Colors.textPrimary }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[Typography.caption, { color: Colors.textSecondary }]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Derecha — máximo dos acciones; la acción contextual tiene prioridad. */}
      <View style={[styles.side, styles.rightSide]}>
        {rightActions.slice(0, 2).map((action) => (
          <TouchableOpacity
            key={action.label}
            onPress={action.onPress}
            style={styles.iconButton}
            accessibilityLabel={action.label}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <action.icon
              size={IconSize.action}
              color={Colors.textPrimary}
              strokeWidth={IconStroke.regular}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    minHeight: 56,
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 96,
  },
  rightSide: {
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  iconButton: {
    width: Layout.minimumTouchTarget,
    height: Layout.minimumTouchTarget,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
