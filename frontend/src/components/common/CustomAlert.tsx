import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import { AppAlertTone } from '../../utils/alert';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  tone?: AppAlertTone;
  confirmDestructive?: boolean;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  showCancel = false,
  tone = 'info',
  confirmDestructive = false,
}) => {
  const reduceMotion = useReducedMotionPreference();
  const feedback = FEEDBACK_STYLES[tone];
  const FeedbackIcon = feedback.icon;
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel ?? onConfirm}
      statusBarTranslucent
    >
      <View style={styles.overlay} accessibilityViewIsModal>
        <View style={styles.alertCard} accessibilityRole="alert">
          <View style={styles.headingRow}>
            <View style={[styles.iconContainer, { backgroundColor: feedback.surface }]}>
              <FeedbackIcon size={22} color={feedback.color} strokeWidth={2} />
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonRow}>
            {showCancel && onCancel && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={cancelText}
              >
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[
                styles.confirmBtn,
                confirmDestructive && styles.destructiveBtn,
                !showCancel && { flex: 1 },
              ]}
              onPress={onConfirm}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              <Text style={styles.confirmBtnText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const FEEDBACK_STYLES = {
  info: { icon: Info, color: Colors.info, surface: Colors.infoSurface },
  success: { icon: CircleCheck, color: Colors.success, surface: Colors.successSurface },
  warning: { icon: TriangleAlert, color: Colors.warning, surface: Colors.warningSurface },
  error: { icon: CircleAlert, color: Colors.error, surface: Colors.errorSurface },
} as const;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  alertCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadow.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
    flex: 1,
  },
  message: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  confirmBtnText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
  destructiveBtn: {
    backgroundColor: Colors.error,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...Typography.button,
    color: Colors.textSecondary,
  },
});
