import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BrainCircuit, ArrowRight } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { AppButton } from '../common/AppButton';

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
  <View style={styles.container}>
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <BrainCircuit
            size={IconSize.action}
            color={Colors.technology}
            strokeWidth={IconStroke.regular}
          />
        </View>
        <Text style={[Typography.label, styles.agentLabel]}>MENTA</Text>
      </View>

      <Text style={[Typography.body, styles.text]}>{text}</Text>

      <View style={styles.actionContainer}>
        <AppButton
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          size="sm"
          icon={<ArrowRight size={14} color={Colors.primary} />}
          accessibilityLabel={`Acción sugerida por MENTA: ${actionLabel}`}
        />
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.informative,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentLabel: {
    color: Colors.primary,
    letterSpacing: 1,
  },
  text: {
    color: Colors.textPrimary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  actionContainer: {
    alignItems: 'flex-start',
  },
});
