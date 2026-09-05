import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Edit3, CheckCircle2, ShieldCheck } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
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
        Comprueba que la información sea correcta antes de publicarla para los psicólogos.
      </Text>

      {/* Sección 1: Necesidad */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={[Typography.caption, styles.sectionLabel]}>
            1. MOTIVO / NECESIDAD
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

      {/* Sección 2: Modalidad */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={[Typography.caption, styles.sectionLabel]}>
            2. MODALIDAD
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

      {/* Sección 3: Horario */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={[Typography.caption, styles.sectionLabel]}>
            3. HORARIO DE ATENCIÓN
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

      {/* Sección 4: Presupuesto */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={[Typography.caption, styles.sectionLabel]}>
            4. TU PRESUPUESTO PROPUESTO
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

      {/* Garantía de privacidad y proceso */}
      <View style={styles.guaranteeBox}>
        <ShieldCheck size={IconSize.inline} color={Colors.primary} />
        <Text style={[Typography.caption, styles.guaranteeText]}>
          Tu solicitud será visible únicamente para profesionales verificados. No publicamos tus datos de contacto.
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
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
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
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryTint,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  guaranteeText: {
    flex: 1,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
