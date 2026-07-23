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
      <Text style={styles.sectionLabel}>Tu presupuesto</Text>

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
          size={18}
          color={Colors.textSecondary}
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

      <Text style={styles.hint}>
        <MaterialIcons name="info-outline" size={12} color={Colors.textSecondary} />
        {' '}Los psicologos pueden contraofertar
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  currencyBadge: {
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  currencyText: {
    ...Typography.label,
    color: Colors.primary,
  },
  input: {
    flex: 1,
    ...Typography.price,
    color: Colors.textPrimary,
    padding: 0,
  },
  editIcon: {
    opacity: 0.5,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  quickChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
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
  },
  hint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
