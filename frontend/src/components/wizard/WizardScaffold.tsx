import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { AppHeader } from '../shared/AppHeader';
import { KeyboardScreenContainer } from '../shared/ScreenContainer';
import { StepProgress } from './StepProgress';
import { AppButton } from '../common/AppButton';

interface WizardScaffoldProps {
  readonly currentStep: 1 | 2 | 3 | 4 | 5;
  readonly stepTitle: string;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly isContinueDisabled: boolean;
  readonly isSubmitting?: boolean;
  readonly continueLabel?: string;
  readonly children: React.ReactNode;
}

export const WizardScaffold: React.FC<WizardScaffoldProps> = ({
  currentStep,
  stepTitle,
  onBack,
  onContinue,
  isContinueDisabled,
  isSubmitting = false,
  continueLabel = 'Continuar',
  children,
}) => {
  const insets = useSafeAreaInsets();
  const isFirstStep = currentStep === 1;

  return (
    <View style={styles.container}>
      {/* Encabezado con retroceso */}
      <AppHeader
        title="Solicitud"
        showBack
        showMenta={false}
        showInbox={false}
      />

      {/* Indicador de progreso */}
      <StepProgress currentStep={currentStep} stepTitle={stepTitle} />

      {/* Contenido con soporte de teclado */}
      <KeyboardScreenContainer
        edges={['bottom', 'left', 'right']}
        contentStyle={styles.content}
      >
        {children}
      </KeyboardScreenContainer>

      {/* Barra de acciones inferior fija */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, Spacing.base) },
        ]}
      >
        <View style={styles.actionRow}>
          {!isFirstStep && (
            <AppButton
              label="Atrás"
              onPress={onBack}
              variant="outline"
              size="md"
              disabled={isSubmitting}
              style={styles.backButton}
            />
          )}

          <AppButton
            label={continueLabel}
            onPress={onContinue}
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isContinueDisabled || isSubmitting}
            style={isFirstStep ? styles.fullButton : styles.continueButton}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.giant,
  },
  bottomBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  backButton: {
    flex: 1,
  },
  continueButton: {
    flex: 2,
  },
  fullButton: {
    flex: 1,
  },
});
