import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarClock, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../common/AppButton';
import type { Appointment } from '../../repositories/AppointmentRepository';
import type { UserRole } from '../../services/AuthService';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { getAppointmentActionPlan } from '../../utils/appointmentPresentation';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';

interface AppointmentOptionsSheetProps {
  readonly appointment: Appointment | null;
  readonly role: UserRole | null;
  readonly isSubmitting: boolean;
  readonly onReschedule: (appointment: Appointment) => void;
  readonly onCancel: (appointment: Appointment, reason: string) => void;
  readonly onClose: () => void;
}

export const AppointmentOptionsSheet: React.FC<AppointmentOptionsSheetProps> = ({
  appointment,
  role,
  isSubmitting,
  onReschedule,
  onCancel,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const sheetRef = useRef<View>(null);
  const [isConfirmingCancellation, setIsConfirmingCancellation] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    setIsConfirmingCancellation(false);
    setReason('');
    if (!appointment) return;
    const frame = requestAnimationFrame(() => {
      const node = findNodeHandle(sheetRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [appointment]);

  const secondaryActions = appointment
    ? getAppointmentActionPlan(appointment, role).secondary
    : [];
  const canReschedule = secondaryActions.some(({ type }) => type === 'reschedule');
  const canCancel = secondaryActions.some(({ type }) => type === 'cancel');

  return (
    <Modal
      visible={Boolean(appointment)}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        {appointment ? (
          <View
            ref={sheetRef}
            role="dialog"
            accessibilityViewIsModal
            accessibilityLabel="Opciones de la cita"
            collapsable={false}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>
                  {isConfirmingCancellation ? 'Cancelar cita' : 'Opciones de la cita'}
                </Text>
                <Text style={styles.subtitle}>{appointment.counterpart.displayName}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Cerrar opciones de la cita"
              >
                <X
                  size={IconSize.action}
                  strokeWidth={IconStroke.regular}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {isConfirmingCancellation ? (
              <View style={styles.cancelFlow}>
                <Text style={styles.warningCopy}>
                  La cancelación quedará registrada y será visible para ambas partes.
                </Text>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Motivo de cancelación</Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Explica brevemente el motivo"
                    placeholderTextColor={Colors.textDisabled}
                    maxLength={500}
                    multiline
                    textAlignVertical="top"
                    style={styles.reasonInput}
                    accessibilityLabel="Motivo de cancelación"
                  />
                  <Text style={styles.counter}>{reason.length}/500</Text>
                </View>
                <AppButton
                  label="Confirmar cancelación"
                  variant="danger"
                  size="lg"
                  fullWidth
                  disabled={!reason.trim()}
                  isLoading={isSubmitting}
                  onPress={() => onCancel(appointment, reason.trim())}
                />
                <AppButton
                  label="Volver a las opciones"
                  variant="ghost"
                  fullWidth
                  disabled={isSubmitting}
                  onPress={() => setIsConfirmingCancellation(false)}
                />
              </View>
            ) : (
              <View style={styles.options}>
                {canReschedule ? (
                  <AppButton
                    label="Reprogramar cita"
                    size="lg"
                    fullWidth
                    disabled={isSubmitting}
                    icon={(
                      <CalendarClock
                        size={IconSize.action}
                        strokeWidth={IconStroke.regular}
                        color={Colors.textInverse}
                      />
                    )}
                    onPress={() => onReschedule(appointment)}
                  />
                ) : null}
                {canCancel ? (
                  <AppButton
                    label="Cancelar cita"
                    variant="dangerGhost"
                    fullWidth
                    disabled={isSubmitting}
                    icon={(
                      <Trash2
                        size={IconSize.action}
                        strokeWidth={IconStroke.regular}
                        color={Colors.error}
                      />
                    )}
                    onPress={() => setIsConfirmingCancellation(true)}
                    style={styles.cancelButton}
                  />
                ) : null}
              </View>
            )}
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
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
    backgroundColor: Colors.surface,
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
  options: {
    gap: Spacing.sm,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  cancelFlow: {
    gap: Spacing.md,
  },
  warningCopy: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.errorSurface,
  },
  fieldGroup: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  reasonInput: {
    minHeight: 112,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    ...Typography.body,
  },
  counter: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'right',
  },
});
