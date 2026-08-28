import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { formatMoney } from '../../utils/money';

interface BudgetInputProps {
  value: number;
  onChange: (value: number) => void;
  currencyCode: string;
  minimumAmount: number;
  maximumAmount: number;
}

export const BudgetInput: React.FC<BudgetInputProps> = ({
  value,
  onChange,
  currencyCode,
  minimumAmount,
  maximumAmount,
}) => {
  const handleTextChange = (text: string) => {
    const normalized = text.replace(',', '.').replace(/[^0-9.]/g, '');
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) onChange(numeric);
    else if (text === '') onChange(0);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>TU PRESUPUESTO</Text>

      <View style={styles.inputRow}>
        <View style={styles.currencyBadge}>
          <Text style={styles.currencyText}>{currencyCode}</Text>
        </View>
        <TextInput
          style={styles.input}
          value={value > 0 ? value.toString() : ''}
          onChangeText={handleTextChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={Colors.textDisabled}
          maxLength={String(Math.trunc(maximumAmount)).length + 3}
          accessibilityLabel="Budget amount input"
        />
        <MaterialIcons
          name="edit"
          size={16}
          color={Colors.textTertiary}
          style={styles.editIcon}
        />
      </View>

      <View style={styles.hintRow}>
        <MaterialIcons name="info-outline" size={13} color={Colors.textTertiary} />
        <Text style={styles.hint}>
          Rango permitido: {formatMoney(minimumAmount, currencyCode)}–{formatMoney(maximumAmount, currencyCode)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs + 2,
  },
  sectionLabel: {
    ...Typography.overline,
    color: Colors.textTertiary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs + 2,
    gap: Spacing.md,
  },
  currencyBadge: {
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  currencyText: {
    ...Typography.label,
    color: Colors.primary,
    fontWeight: '800',
  },
  input: {
    flex: 1,
    ...Typography.price,
    fontSize: 26,
    color: Colors.textPrimary,
    padding: 0,
  },
  editIcon: {
    opacity: 0.6,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});
