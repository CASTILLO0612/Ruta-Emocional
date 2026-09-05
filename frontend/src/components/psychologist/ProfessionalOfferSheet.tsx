import React, { useMemo, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { ShieldCheck, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../common/AppButton';
import type { ActiveRequest } from '../../models/ActiveRequest';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { formatCurrencySymbol, formatMoney } from '../../utils/money';
import { shouldStackInteractiveContent } from '../../utils/responsiveLayout';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import { useModalAccessibilityFocus } from '../../hooks/useModalAccessibilityFocus';

interface ProfessionalOfferSheetProps {
  readonly request: ActiveRequest | null;
  readonly amountInput: string;
  readonly minimumAmount?: number;
  readonly maximumAmount?: number;
  readonly isSubmitting: boolean;
  readonly onAmountChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onClose: () => void;
}

export const ProfessionalOfferSheet: React.FC<ProfessionalOfferSheetProps> = ({
  request,
  amountInput,
  minimumAmount,
  maximumAmount,
  isSubmitting,
  onAmountChange,
  onSubmit,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const { fontScale, width } = useWindowDimensions();
  const sheetRef = useRef<View>(null);
  const amount = Number(amountInput);
  const hasPolicy = Number.isFinite(minimumAmount) && Number.isFinite(maximumAmount);
  const isAmountValid = hasPolicy
    && Number.isFinite(amount)
    && amount >= minimumAmount!
    && amount <= maximumAmount!;
  const shouldStackComparison = shouldStackInteractiveContent(width, fontScale);

  const validationMessage = useMemo(() => {
    if (!request || !amountInput.trim() || !hasPolicy || isAmountValid) return null;
    return `Ingresa un importe entre ${formatMoney(minimumAmount!, request.currencyCode)} y ${formatMoney(maximumAmount!, request.currencyCode)}.`;
  }, [amountInput, hasPolicy, isAmountValid, maximumAmount, minimumAmount, request]);

  useModalAccessibilityFocus(sheetRef, Boolean(request));

  return (
    <Modal
      visible={Boolean(request)}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        {request ? (
          <View
            ref={sheetRef}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}
            role="dialog"
            accessibilityViewIsModal
            accessibilityLabel="Proponer una tarifa diferente"
            collapsable={false}
          >
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>Cambiar tarifa</Text>
                <Text style={styles.subtitle}>
                  El paciente decidirá si acepta tu propuesta.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cerrar propuesta de tarifa"
              >
                <X
                  size={IconSize.action}
                  strokeWidth={IconStroke.regular}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={[
              styles.comparison,
              shouldStackComparison && styles.comparisonStacked,
            ]}>
              <View style={styles.comparisonColumn}>
                <Text style={styles.comparisonLabel}>Presupuesto del paciente</Text>
                <Text style={styles.comparisonValue}>
                  {formatMoney(request.proposedBudget, request.currencyCode)}
                </Text>
              </View>
              <View style={[
                styles.comparisonDivider,
                shouldStackComparison && styles.comparisonDividerStacked,
              ]} />
              <View style={styles.comparisonColumn}>
                <Text style={styles.comparisonLabel}>Tu propuesta</Text>
                <Text style={[styles.comparisonValue, styles.proposedValue]}>
                  {Number.isFinite(amount) && amountInput.trim()
                    ? formatMoney(amount, request.currencyCode)
                    : 'Por definir'}
                </Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Importe de la oferta</Text>
              <View style={[styles.amountField, validationMessage && styles.amountFieldInvalid]}>
                <Text style={styles.currencySymbol}>
                  {formatCurrencySymbol(request.currencyCode)}
                </Text>
                <TextInput
                  style={styles.amountInput}
                  value={amountInput}
                  onChangeText={onAmountChange}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  accessibilityLabel="Importe de la oferta"
                  accessibilityHint="Escribe la tarifa que deseas proponer al paciente"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textDisabled}
                />
              </View>
              {validationMessage ? (
                <Text style={styles.validation} accessibilityRole="alert">
                  {validationMessage}
                </Text>
              ) : hasPolicy ? (
                <Text style={styles.helper}>
                  Rango permitido: {formatMoney(minimumAmount!, request.currencyCode)}–{formatMoney(maximumAmount!, request.currencyCode)}
                </Text>
              ) : (
                <Text style={styles.validation} accessibilityRole="alert">
                  Las reglas de ofertas todavía no están disponibles.
                </Text>
              )}
            </View>

            <View style={styles.privacyNote}>
              <ShieldCheck
                size={IconSize.inline}
                strokeWidth={IconStroke.regular}
                color={Colors.success}
              />
              <Text style={styles.privacyText}>
                La identidad del paciente seguirá protegida hasta que acepte una oferta.
              </Text>
            </View>

            <AppButton
              label="Enviar propuesta"
              onPress={onSubmit}
              isLoading={isSubmitting}
              disabled={!isAmountValid}
              fullWidth
              size="lg"
              accessibilityLabel={isAmountValid
                ? `Enviar propuesta por ${formatMoney(amount, request.currencyCode)}`
                : 'Enviar propuesta'}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
    ...Shadow.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -Spacing.sm,
    marginTop: -Spacing.sm,
  },
  comparison: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryTint,
  },
  comparisonColumn: {
    flex: 1,
    gap: Spacing.xs,
  },
  comparisonDivider: {
    width: 1,
    backgroundColor: Colors.primaryTintStrong,
    marginHorizontal: Spacing.md,
  },
  comparisonStacked: {
    flexDirection: 'column',
  },
  comparisonDividerStacked: {
    width: '100%',
    height: 1,
    marginHorizontal: 0,
    marginVertical: Spacing.md,
  },
  comparisonLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  comparisonValue: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  proposedValue: {
    color: Colors.primary,
  },
  fieldGroup: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  amountFieldInvalid: {
    borderColor: Colors.error,
  },
  currencySymbol: {
    ...Typography.h2,
    color: Colors.primary,
    marginRight: Spacing.sm,
  },
  amountInput: {
    ...Typography.display,
    color: Colors.textPrimary,
    flex: 1,
    paddingVertical: Spacing.sm,
  },
  helper: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  validation: {
    ...Typography.caption,
    color: Colors.error,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  privacyText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1,
  },
});
