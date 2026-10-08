import React, { useRef } from 'react';
import {
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
import { UserRound, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useModalAccessibilityFocus } from '../../hooks/useModalAccessibilityFocus';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { AppButton } from '../common/AppButton';

interface ProfileDetailsSheetProps {
  readonly visible: boolean;
  readonly displayName: string;
  readonly phone: string;
  readonly isSaving: boolean;
  readonly onDisplayNameChange: (value: string) => void;
  readonly onPhoneChange: (value: string) => void;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

export function ProfileDetailsSheet({
  visible,
  displayName,
  phone,
  isSaving,
  onDisplayNameChange,
  onPhoneChange,
  onSave,
  onClose,
}: ProfileDetailsSheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const sheetRef = useRef<View>(null);
  const normalizedPhone = phone.trim().replace(/[\s()-]/g, '');
  const nameValid = displayName.trim().length >= 2 && displayName.trim().length <= 160;
  const phoneValid = !normalizedPhone || /^\+?\d{8,15}$/.test(normalizedPhone);
  useModalAccessibilityFocus(sheetRef, visible);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={isSaving ? () => undefined : onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={isSaving ? undefined : onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          ref={sheetRef}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
          role="dialog"
          accessibilityViewIsModal
          accessibilityLabel="Editar datos personales"
          collapsable={false}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <UserRound size={IconSize.action} color={Colors.primary} strokeWidth={IconStroke.regular} />
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Datos personales</Text>
              <Text style={styles.subtitle}>Información básica de tu cuenta.</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSaving}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar edición"
            >
              <X size={IconSize.action} color={Colors.textSecondary} strokeWidth={IconStroke.regular} />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                value={displayName}
                onChangeText={onDisplayNameChange}
                autoCapitalize="words"
                autoComplete="name"
                maxLength={160}
                placeholder="Tu nombre"
                placeholderTextColor={Colors.textTertiary}
                style={[styles.input, !nameValid && displayName.length > 0 && styles.invalidInput]}
                accessibilityLabel="Nombre"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Teléfono opcional</Text>
              <TextInput
                value={phone}
                onChangeText={onPhoneChange}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={24}
                placeholder="+505 8888 8888"
                placeholderTextColor={Colors.textTertiary}
                style={[styles.input, !phoneValid && styles.invalidInput]}
                accessibilityLabel="Teléfono"
              />
              {!phoneValid ? <Text style={styles.error}>Ingresa entre 8 y 15 dígitos.</Text> : null}
            </View>

            <AppButton
              label="Guardar cambios"
              onPress={onSave}
              isLoading={isSaving}
              disabled={!nameValid || !phoneValid}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  sheet: {
    width: '100%', maxWidth: 600, alignSelf: 'center', paddingTop: Spacing.sm,
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    backgroundColor: Colors.surface, ...Shadow.lg,
  },
  handle: {
    width: 36, height: 4, alignSelf: 'center', borderRadius: BorderRadius.full,
    backgroundColor: Colors.borderStrong,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.base,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { ...Typography.h3, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.xxs },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  form: { padding: Spacing.xl, gap: Spacing.lg },
  fieldGroup: { gap: Spacing.xs },
  label: { ...Typography.label, color: Colors.textSecondary },
  input: {
    ...Typography.body, minHeight: 52, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    backgroundColor: Colors.background, color: Colors.textPrimary,
  },
  invalidInput: { borderColor: Colors.error },
  error: { ...Typography.caption, color: Colors.error },
});
