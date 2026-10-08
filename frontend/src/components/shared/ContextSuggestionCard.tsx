import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BrainCircuit, ChevronRight } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { Layout } from '../../theme/layout';

interface ContextSuggestionCardProps {
  readonly text: string;
  readonly onAction: () => void;
  readonly actionLabel?: string;
}

export const ContextSuggestionCard: React.FC<ContextSuggestionCardProps> = ({
  text,
  onAction,
  actionLabel = 'Revisar',
}) => (
  <TouchableOpacity
    style={styles.container}
    onPress={onAction}
    activeOpacity={0.76}
    accessibilityRole="button"
    accessibilityLabel={`MENTA. ${text} ${actionLabel}`}
    accessibilityHint="Abre la sugerencia contextual"
  >
    <View style={styles.iconContainer}>
      <BrainCircuit
        size={IconSize.action}
        color={Colors.primary}
        strokeWidth={IconStroke.regular}
      />
    </View>

    <View style={styles.copy}>
      <Text style={[Typography.label, styles.agentLabel]}>MENTA</Text>
      <Text style={[Typography.bodySmall, styles.text]}>{text}</Text>
    </View>

    <View style={styles.navigationIcon}>
      <ChevronRight
        size={IconSize.action}
        color={Colors.textTertiary}
        strokeWidth={IconStroke.regular}
      />
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.md,
    marginVertical: Spacing.xs,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.divider,
  },
  iconContainer: {
    width: Layout.minimumTouchTarget,
    height: Layout.minimumTouchTarget,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: Spacing.xxs,
  },
  agentLabel: {
    color: Colors.primary,
    letterSpacing: 1,
  },
  text: {
    color: Colors.textSecondary,
  },
  navigationIcon: {
    width: Layout.minimumTouchTarget,
    height: Layout.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
