import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Info, Pencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { IconSize, IconStroke } from '../../theme/icons';
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
        <Pencil
          size={IconSize.inline}
          strokeWidth={IconStroke.regular}
          color={Colors.textTertiary}
        />
      </View>

      <View style={styles.hintRow}>
        <Info size={IconSize.inline} strokeWidth={IconStroke.regular} color={Colors.textTertiary} />
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
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
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
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
  },
  input: {
    flex: 1,
    ...Typography.price,
    fontSize: 26,
    color: Colors.textPrimary,
    padding: 0,
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
