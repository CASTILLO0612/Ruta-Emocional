import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { passwordStrength } from '../../utils/authValidation';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';

const STRENGTH_COLORS = {
  1: Colors.error,
  2: Colors.warning,
  3: Colors.success,
} as const;

interface PasswordStrengthProps {
  readonly password: string;
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  if (!password) return null;
  const result = passwordStrength(password);
  const color = STRENGTH_COLORS[result.level];

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={`Seguridad de contraseña: ${result.label}`}
    >
      <View style={styles.bars}>
        {[1, 2, 3].map((level) => (
          <View
            key={level}
            style={[
              styles.bar,
              level <= result.level && { backgroundColor: color },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color }]}>{result.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bars: { flex: 1, flexDirection: 'row', gap: Spacing.xs },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.borderSubtle,
  },
  label: { ...Typography.caption, fontFamily: FontFamily.bodySemiBold, minWidth: 52 },
});
