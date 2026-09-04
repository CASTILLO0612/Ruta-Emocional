import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BriefcaseMedical, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../common/AppButton';
import {
  PROFESSIONAL_BIO_MAX_LENGTH,
  PROFESSIONAL_BIO_MIN_LENGTH,
} from '../../config/professionalProfile';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { isProfessionalBioValid } from '../../utils/profilePresentation';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';

interface ProfessionalProfileSheetProps {
  readonly visible: boolean;
  readonly specialty: string;
  readonly bio: string;
  readonly isSaving: boolean;
  readonly onBioChange: (value: string) => void;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

export const ProfessionalProfileSheet: React.FC<ProfessionalProfileSheetProps> = ({
  visible,
  specialty,
  bio,
  isSaving,
  onBioChange,
  onSave,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const sheetRef = useRef<View>(null);
  const normalizedLength = bio.trim().length;
  const bioIsValid = isProfessionalBioValid(bio);

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      const node = findNodeHandle(sheetRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={isSaving ? () => undefined : onClose}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View
          ref={sheetRef}
          role="dialog"
          accessibilityViewIsModal
          accessibilityLabel="Editar perfil profesional"
          collapsable={false}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <BriefcaseMedical size={IconSize.action} color={Colors.primary} strokeWidth={IconStroke.regular} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Perfil profesional</Text>
              <Text style={styles.subtitle}>Esta información será visible en el directorio.</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSaving}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar edición del perfil"
            >
              <X size={IconSize.action} color={Colors.textSecondary} strokeWidth={IconStroke.regular} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Especialidad principal</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>{specialty || 'Aún no configurada'}</Text>
              </View>
              <Text style={styles.helper}>La especialidad se gestiona desde la configuración profesional.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Presentación profesional</Text>
              <TextInput
                value={bio}
                onChangeText={onBioChange}
                multiline
                maxLength={PROFESSIONAL_BIO_MAX_LENGTH}
                placeholder="Describe tu enfoque, experiencia y población atendida"
                placeholderTextColor={Colors.textDisabled}
                style={[styles.textArea, !bioIsValid && styles.invalidField]}
                accessibilityLabel="Presentación profesional"
                accessibilityHint={!bioIsValid ? `Escribe al menos ${PROFESSIONAL_BIO_MIN_LENGTH} caracteres` : undefined}
              />
              <View style={styles.guidanceRow}>
                <Text style={[styles.helper, !bioIsValid && styles.errorText]}>
                  Vacía o con un mínimo de {PROFESSIONAL_BIO_MIN_LENGTH} caracteres.
                </Text>
                <Text style={styles.counter}>{normalizedLength}/{PROFESSIONAL_BIO_MAX_LENGTH}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <AppButton
              label="Guardar presentación"
              onPress={onSave}
              isLoading={isSaving}
              disabled={!bioIsValid}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  sheet: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    alignSelf: 'center',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    paddingTop: Spacing.sm,
    ...Shadow.lg,
  },
  handle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryTint,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { ...Typography.h3, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.xxs },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  content: { padding: Spacing.xl, gap: Spacing.xl },
  fieldGroup: { gap: Spacing.sm },
  label: { ...Typography.label, color: Colors.textSecondary },
  readOnlyField: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  readOnlyText: { ...Typography.body, color: Colors.textPrimary },
  textArea: {
    minHeight: 160,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSoft,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
    ...Typography.body,
  },
  invalidField: { borderColor: Colors.error },
  guidanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  helper: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  errorText: { color: Colors.error },
  counter: { ...Typography.caption, color: Colors.textTertiary },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
});
