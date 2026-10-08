import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Edit3, ShieldCheck } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { IconSize } from '../../theme/icons';
import { formatMoney } from '../../utils/money';
import type { WizardDraft } from '../../utils/validateWizardStep';

interface RequestSummaryProps {
  readonly draft: WizardDraft;
  readonly onEditStep: (step: 1 | 2 | 3 | 4) => void;
}

export const RequestSummary: React.FC<RequestSummaryProps> = ({
  draft,
  onEditStep,
}) => {
  const getModalityLabel = (modality?: string) => {
    switch (modality) {
      case 'chat':
        return 'Chat en línea';
      case 'call':
        return 'Llamada de voz';
      case 'in-person':
        return 'Atención presencial';
      default:
        return modality ?? 'No seleccionada';
    }
  };

  const budget = Number(draft.proposedBudgetInput);

  return (
    <View style={styles.container}>
      <Text style={[Typography.h3, styles.title]}>Revisa tu solicitud</Text>
      <Text style={[Typography.body, styles.subtitle]}>
        Confirma los datos antes de publicarla.
      </Text>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[Typography.caption, styles.sectionLabel]}>
            MOTIVO
          </Text>
          <TouchableOpacity
            onPress={() => onEditStep(1)}
            style={styles.editButton}
            accessibilityRole="button"
            accessibilityLabel="Editar motivo o necesidad"
          >
            <Edit3 size={14} color={Colors.primary} />
            <Text style={[Typography.button, styles.editText]}>Editar</Text>
          </TouchableOpacity>
        </View>
        <Text style={[Typography.body, styles.sectionValue]}>
          {draft.primaryNeed}
        </Text>
        {draft.description && (
          <Text style={[Typography.bodySmall, styles.sectionDescription]}>
            {draft.description}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[Typography.caption, styles.sectionLabel]}>
            MODALIDAD
          </Text>
          <TouchableOpacity
            onPress={() => onEditStep(2)}
            style={styles.editButton}
            accessibilityRole="button"
            accessibilityLabel="Editar modalidad de atención"
          >
            <Edit3 size={14} color={Colors.primary} />
            <Text style={[Typography.button, styles.editText]}>Editar</Text>
          </TouchableOpacity>
        </View>
        <Text style={[Typography.body, styles.sectionValue]}>
          {getModalityLabel(draft.modality)}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[Typography.caption, styles.sectionLabel]}>
            HORARIO
          </Text>
          <TouchableOpacity
            onPress={() => onEditStep(3)}
            style={styles.editButton}
            accessibilityRole="button"
            accessibilityLabel="Editar horario de atención"
          >
            <Edit3 size={14} color={Colors.primary} />
            <Text style={[Typography.button, styles.editText]}>Editar</Text>
          </TouchableOpacity>
        </View>
        <Text style={[Typography.body, styles.sectionValue]}>
          {draft.timing === 'immediate'
            ? 'Atención inmediata'
            : draft.scheduledFor
              ? `Programada para ${draft.scheduledFor.toLocaleDateString()} a las ${draft.scheduledFor.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Programada'}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[Typography.caption, styles.sectionLabel]}>
            PRESUPUESTO
          </Text>
          <TouchableOpacity
            onPress={() => onEditStep(4)}
            style={styles.editButton}
            accessibilityRole="button"
            accessibilityLabel="Editar presupuesto propuesto"
          >
            <Edit3 size={14} color={Colors.primary} />
            <Text style={[Typography.button, styles.editText]}>Editar</Text>
          </TouchableOpacity>
        </View>
        <Text style={[Typography.priceSm, styles.budgetAmount]}>
          {draft.currencyCode ? formatMoney(budget, draft.currencyCode) : 'No disponible'}
        </Text>
      </View>

      <View style={styles.privacyNote}>
        <ShieldCheck size={IconSize.inline} color={Colors.primary} />
        <Text style={[Typography.caption, styles.privacyText]}>
          Solo profesionales verificados podrán verla.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },
  title: {
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  section: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sectionLabel: {
    color: Colors.textTertiary,
    fontFamily: Typography.button.fontFamily,
    letterSpacing: 0.6,
  },
  editButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.xs,
  },
  editText: {
    color: Colors.primary,
    fontSize: 13,
  },
  sectionValue: {
    color: Colors.textPrimary,
  },
  sectionDescription: {
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  budgetAmount: {
    color: Colors.primary,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.base,
  },
  privacyText: {
    flex: 1,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
