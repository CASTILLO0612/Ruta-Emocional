import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';

interface StepProgressProps {
  readonly currentStep: number;
  readonly totalSteps?: number;
  readonly stepTitle: string;
}

export const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  totalSteps = 5,
  stepTitle,
}) => {
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}
      accessibilityLabel={`Paso ${currentStep} de ${totalSteps}: ${stepTitle}`}
    >
      <Text style={[Typography.caption, styles.stepCounter]}>
        {currentStep} de {totalSteps}
      </Text>

      {/* Barra de progreso */}
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${progressPercent}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
  },
  stepCounter: {
    color: Colors.primary,
    fontFamily: Typography.button.fontFamily,
    marginBottom: Spacing.xxs,
  },
  track: {
    height: 4,
    backgroundColor: Colors.borderSubtle,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
});
