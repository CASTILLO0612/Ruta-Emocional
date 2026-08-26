import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

const QUICK_AMOUNTS = [200, 350, 500, 750];

interface BudgetInputProps {
  value: number;
  onChange: (value: number) => void;
}

export const BudgetInput: React.FC<BudgetInputProps> = ({ value, onChange }) => {
  const handleTextChange = (text: string) => {
    const numeric = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(numeric)) onChange(numeric);
    else if (text === '') onChange(0);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>TU PRESUPUESTO</Text>

      <View style={styles.inputRow}>
        <View style={styles.currencyBadge}>
          <Text style={styles.currencyText}>C$</Text>
        </View>
        <TextInput
          style={styles.input}
          value={value > 0 ? value.toString() : ''}
          onChangeText={handleTextChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={Colors.textDisabled}
          maxLength={6}
          accessibilityLabel="Budget amount input"
        />
        <MaterialIcons
          name="edit"
          size={16}
          color={Colors.textTertiary}
          style={styles.editIcon}
        />
      </View>

      <View style={styles.quickRow}>
        {QUICK_AMOUNTS.map((amount) => (
          <TouchableOpacity
            key={amount}
            onPress={() => onChange(amount)}
            activeOpacity={0.75}
            style={[
              styles.quickChip,
              value === amount && styles.quickChipActive,
            ]}
          >
            <Text
              style={[
                styles.quickChipText,
                value === amount && styles.quickChipTextActive,
              ]}
            >
              C${amount}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.hintRow}>
        <MaterialIcons name="info-outline" size={13} color={Colors.textTertiary} />
        <Text style={styles.hint}>
          Los psicólogos pueden contraofertar
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
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  quickChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs + 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  quickChipActive: {
    backgroundColor: Colors.accentFaded,
    borderColor: Colors.accent,
  },
  quickChipText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  quickChipTextActive: {
    color: Colors.accentDark,
    fontWeight: '700',
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
