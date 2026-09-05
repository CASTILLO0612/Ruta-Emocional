import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, MessageCircle, BrainCircuit } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { IconSize, IconStroke } from '../../theme/icons';
import { Layout } from '../../theme/layout';
import { BrandLogo } from '../common/BrandLogo';

const HEADER_SUBTITLE_MIN_WIDTH = 600;

export interface HeaderContextualAction {
  readonly label: string;
  readonly icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  readonly onPress: () => void;
}

export interface AppHeaderProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly showBrand?: boolean;
  readonly showBrandMark?: boolean;
  readonly showBack?: boolean;
  readonly onBack?: () => void;
  readonly showMenta?: boolean;
  readonly showInbox?: boolean;
  readonly contextualAction?: HeaderContextualAction;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  showBrand = false,
  showBrandMark = false,
  showBack = false,
  onBack,
  showMenta = false,
  showInbox = false,
  contextualAction,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const compact = width <= Layout.compactWidth;
  const shouldShowSubtitle = Boolean(subtitle) && width >= HEADER_SUBTITLE_MIN_WIDTH;

  const rightActions: HeaderContextualAction[] = [];

  if (contextualAction) {
    rightActions.push(contextualAction);
  }

  if (showMenta && rightActions.length < 2) {
    rightActions.push({
      label: 'Abrir MENTA',
      icon: BrainCircuit,
      onPress: () => (navigation as any).navigate('MentaAgent'),
    });
  }

  if (showInbox && rightActions.length < 2) {
    rightActions.push({
      label: 'Abrir mensajes',
      icon: MessageCircle,
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
        {!showBack && showBrandMark ? (
          <View testID="app-header-brand-logo" style={styles.headerLogo}>
            <BrandLogo size="header" variant="positive" decorative />
          </View>
        ) : null}
      </View>

      {/* Centro */}
      <View style={styles.center}>
        {showBrand ? (
          <BrandLogo size={compact ? 'header' : 'compact'} variant="positive" />
        ) : title ? (
          <View style={styles.titleContainer}>
            <Text
              style={styles.title}
              numberOfLines={1}
              ellipsizeMode="clip"
              maxFontSizeMultiplier={Layout.largeTextScale}
            >
              {title}
            </Text>
            {shouldShowSubtitle ? (
              <Text
                style={styles.subtitle}
                numberOfLines={1}
                ellipsizeMode="clip"
                maxFontSizeMultiplier={Layout.largeTextScale}
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
    minWidth: 96,
    flexShrink: 0,
    overflow: 'hidden',
  },
  headerLogo: {
    width: 88,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSide: {
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    overflow: 'hidden',
  },
  titleContainer: {
    width: '100%',
    minWidth: 0,
    alignItems: 'center',
  },
  title: {
    ...Typography.h4,
    width: '100%',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.caption,
    width: '100%',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  iconButton: {
    width: Layout.minimumTouchTarget,
    height: Layout.minimumTouchTarget,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
