import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Layout } from '../../theme/layout';

interface SectionHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
}) => (
  <View style={styles.container}>
    <View style={styles.textContainer}>
      <Text style={[Typography.h4, styles.title]}>{title}</Text>
      {subtitle && (
        <Text style={[Typography.bodySmall, styles.subtitle]}>{subtitle}</Text>
      )}
    </View>
    {actionLabel && onAction && (
      <TouchableOpacity
        onPress={onAction}
        style={styles.actionButton}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[Typography.button, styles.actionText]}>
          {actionLabel}
        </Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  textContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  title: {
    color: Colors.textPrimary,
  },
  subtitle: {
    color: Colors.textTertiary,
    marginTop: Spacing.xxs,
  },
  actionButton: {
    minHeight: Layout.minimumTouchTarget,
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  actionText: {
    color: Colors.primary,
    fontSize: 14,
  },
});
