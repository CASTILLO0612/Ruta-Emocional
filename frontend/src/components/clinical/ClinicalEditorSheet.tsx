import React, { useRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ClipboardList, FileText, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../common/AppButton';
import type { ClinicalPolicy } from '../../repositories/ClinicalRecordRepository';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import { useModalAccessibilityFocus } from '../../hooks/useModalAccessibilityFocus';

export type ClinicalEditorMode = 'ENCOUNTER' | 'DRAFT' | 'AMENDMENT' | 'PLAN' | null;

interface ClinicalEditorSheetProps {
  readonly mode: ClinicalEditorMode;
  readonly policy: ClinicalPolicy | null;
  readonly noteContent: string;
  readonly encounterReason: string;
  readonly amendmentReason: string;
  readonly planSummary: string;
  readonly goalDescription: string;
  readonly canSubmit: boolean;
  readonly isSubmitting: boolean;
  readonly onNoteContentChange: (value: string) => void;
  readonly onEncounterReasonChange: (value: string) => void;
  readonly onAmendmentReasonChange: (value: string) => void;
  readonly onPlanSummaryChange: (value: string) => void;
  readonly onGoalDescriptionChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onClose: () => void;
}

const TITLE_BY_MODE: Record<Exclude<ClinicalEditorMode, null>, string> = {
  ENCOUNTER: 'Nuevo encuentro',
  DRAFT: 'Editar borrador',
  AMENDMENT: 'Enmendar nota',
  PLAN: 'Nuevo plan de tratamiento',
};

export const ClinicalEditorSheet: React.FC<ClinicalEditorSheetProps> = ({
  mode,
  policy,
  noteContent,
  encounterReason,
  amendmentReason,
  planSummary,
  goalDescription,
  canSubmit,
  isSubmitting,
  onNoteContentChange,
  onEncounterReasonChange,
  onAmendmentReasonChange,
  onPlanSummaryChange,
  onGoalDescriptionChange,
  onSubmit,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const sheetRef = useRef<View>(null);
  useModalAccessibilityFocus(sheetRef, Boolean(mode));

  return (
    <Modal
      visible={Boolean(mode)}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'slide'}
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
        {mode ? (
          <View
            ref={sheetRef}
            role="dialog"
            accessibilityViewIsModal
            accessibilityLabel={TITLE_BY_MODE[mode]}
            collapsable={false}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                {mode === 'PLAN' ? (
                  <ClipboardList size={IconSize.action} color={Colors.primary} strokeWidth={IconStroke.regular} />
                ) : (
                  <FileText size={IconSize.action} color={Colors.primary} strokeWidth={IconStroke.regular} />
                )}
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{TITLE_BY_MODE[mode]}</Text>
                <Text style={styles.subtitle}>La información se guardará en el expediente privado.</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                disabled={isSubmitting}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Cerrar editor clínico"
              >
                <X size={IconSize.action} color={Colors.textSecondary} strokeWidth={IconStroke.regular} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {mode === 'PLAN' ? (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Resumen del plan</Text>
                    <TextInput
                      value={planSummary}
                      onChangeText={onPlanSummaryChange}
                      multiline
                      maxLength={policy?.maximumTreatmentSummaryLength}
                      placeholder="Enfoque, frecuencia y criterios de seguimiento"
                      placeholderTextColor={Colors.textDisabled}
                      style={styles.textArea}
                      accessibilityLabel="Resumen del plan"
                    />
                    <Text style={styles.counter}>
                      {planSummary.length}/{policy?.maximumTreatmentSummaryLength ?? 0}
                    </Text>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Primer objetivo</Text>
                    <TextInput
                      value={goalDescription}
                      onChangeText={onGoalDescriptionChange}
                      multiline
                      maxLength={policy?.maximumGoalLength}
                      placeholder="Objetivo observable y clínicamente pertinente"
                      placeholderTextColor={Colors.textDisabled}
                      style={styles.compactTextArea}
                      accessibilityLabel="Primer objetivo terapéutico"
                    />
                    <Text style={styles.counter}>
                      {goalDescription.length}/{policy?.maximumGoalLength ?? 0}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  {mode === 'ENCOUNTER' ? (
                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Motivo del encuentro</Text>
                      <TextInput
                        value={encounterReason}
                        onChangeText={onEncounterReasonChange}
                        maxLength={policy?.maximumEncounterReasonLength}
                        placeholder="Opcional"
                        placeholderTextColor={Colors.textDisabled}
                        style={styles.input}
                        accessibilityLabel="Motivo del encuentro"
                      />
                    </View>
                  ) : null}

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Nota clínica</Text>
                    <TextInput
                      value={noteContent}
                      onChangeText={onNoteContentChange}
                      multiline
                      maxLength={policy?.maximumNoteLength}
                      placeholder="Registra observaciones relevantes y evita información innecesaria"
                      placeholderTextColor={Colors.textDisabled}
                      style={styles.noteArea}
                      accessibilityLabel="Contenido de la nota clínica"
                    />
                    <Text style={styles.counter}>
                      {noteContent.length}/{policy?.maximumNoteLength ?? 0}
                    </Text>
                  </View>

                  {mode === 'AMENDMENT' ? (
                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Motivo de la enmienda</Text>
                      <TextInput
                        value={amendmentReason}
                        onChangeText={onAmendmentReasonChange}
                        multiline
                        maxLength={policy?.maximumAmendmentReasonLength}
                        placeholder="Explica por qué se corrige la nota firmada"
                        placeholderTextColor={Colors.textDisabled}
                        style={styles.compactTextArea}
                        accessibilityLabel="Motivo de la enmienda"
                      />
                      <Text style={styles.counter}>
                        {amendmentReason.length}/{policy?.maximumAmendmentReasonLength ?? 0}
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <AppButton
                label={mode === 'PLAN' ? 'Crear plan' : 'Guardar cambios'}
                onPress={onSubmit}
                fullWidth
                size="lg"
                disabled={!canSubmit}
                isLoading={isSubmitting}
              />
            </View>
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
    maxWidth: 680,
    maxHeight: '94%',
    alignSelf: 'center',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
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
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryTint,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  scroll: {
    flexShrink: 1,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceSoft,
    color: Colors.textPrimary,
    ...Typography.body,
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceSoft,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
    ...Typography.body,
  },
  compactTextArea: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceSoft,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
    ...Typography.body,
  },
  noteArea: {
    minHeight: 200,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceSoft,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
    ...Typography.body,
  },
  counter: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
});
