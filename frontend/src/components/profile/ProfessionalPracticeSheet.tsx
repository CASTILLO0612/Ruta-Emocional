import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, Circle, Star, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../common/AppButton';
import type { DirectoryModality } from '../../models/Psychologist';
import type {
  ProfessionalCatalogs,
  ProfessionalProfile,
  SpecialtyCatalogItem,
} from '../../models/ProfessionalProfile';
import { useModalAccessibilityFocus } from '../../hooks/useModalAccessibilityFocus';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { formatModalityLabel } from '../../utils/modality';

export interface ProfessionalPracticeDraft {
  readonly specialtyCodes: readonly string[];
  readonly primarySpecialtyCode: string;
  readonly modalities: readonly {
    readonly code: DirectoryModality;
    readonly isEnabled: boolean;
    readonly amount: string;
    readonly currency: string;
  }[];
}

interface ProfessionalPracticeSheetProps {
  readonly visible: boolean;
  readonly profile: ProfessionalProfile | null;
  readonly specialties: readonly SpecialtyCatalogItem[];
  readonly catalogs: ProfessionalCatalogs | null;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly onSave: (draft: ProfessionalPracticeDraft) => void;
  readonly onClose: () => void;
}

interface ModalityDraft {
  readonly code: DirectoryModality;
  readonly isEnabled: boolean;
  readonly amount: string;
  readonly currency: string;
}

function buildModalities(
  profile: ProfessionalProfile | null,
  catalogs: ProfessionalCatalogs | null
): readonly ModalityDraft[] {
  if (!catalogs) return [];
  return catalogs.modalities.map((code) => {
    const configured = profile?.modalities.find((item) => item.code === code);
    return {
      code,
      isEnabled: configured?.isEnabled ?? false,
      amount: configured?.pricePerHour.amount ?? '',
      currency: configured?.pricePerHour.currency ?? catalogs.currencies[0] ?? '',
    };
  });
}

function isValidAmount(value: string): boolean {
  return /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value.trim()) && Number(value) > 0;
}

export const ProfessionalPracticeSheet: React.FC<ProfessionalPracticeSheetProps> = ({
  visible,
  profile,
  specialties,
  catalogs,
  isLoading,
  isSaving,
  onSave,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const sheetRef = useRef<View>(null);
  const [selectedCodes, setSelectedCodes] = useState<readonly string[]>([]);
  const [primaryCode, setPrimaryCode] = useState('');
  const [modalities, setModalities] = useState<readonly ModalityDraft[]>([]);
  useModalAccessibilityFocus(sheetRef, visible);

  useEffect(() => {
    if (!visible) return;
    const nextCodes = profile?.specialties.map(({ code }) => code) ?? [];
    setSelectedCodes(nextCodes);
    setPrimaryCode(profile?.specialties.find(({ isPrimary }) => isPrimary)?.code ?? nextCodes[0] ?? '');
    setModalities(buildModalities(profile, catalogs));
  }, [catalogs, profile, visible]);

  const enabledModalities = useMemo(
    () => modalities.filter(({ isEnabled }) => isEnabled),
    [modalities]
  );
  const isValid = selectedCodes.length > 0
    && selectedCodes.includes(primaryCode)
    && enabledModalities.length > 0
    && enabledModalities.every(({ amount, currency }) => isValidAmount(amount) && currency.length === 3);

  const toggleSpecialty = (code: string) => {
    if (selectedCodes.includes(code)) {
      const next = selectedCodes.filter((item) => item !== code);
      setSelectedCodes(next);
      if (primaryCode === code) setPrimaryCode(next[0] ?? '');
      return;
    }
    if (selectedCodes.length >= 10) return;
    setSelectedCodes([...selectedCodes, code]);
    if (!primaryCode) setPrimaryCode(code);
  };

  const updateModality = (code: DirectoryModality, patch: Partial<ModalityDraft>) => {
    setModalities((current) => current.map((item) => item.code === code ? { ...item, ...patch } : item));
  };

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
          accessibilityLabel="Configurar servicios profesionales"
          collapsable={false}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Servicios profesionales</Text>
              <Text style={styles.subtitle}>Define cómo aparecerás en las búsquedas.</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSaving}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar configuración profesional"
            >
              <X size={IconSize.action} color={Colors.textSecondary} strokeWidth={IconStroke.regular} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {isLoading ? (
              <Text style={styles.helper}>Cargando configuración profesional…</Text>
            ) : (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Especialidades</Text>
                  <Text style={styles.helper}>Selecciona hasta 10 y marca una como principal.</Text>
                  <View style={styles.optionList}>
                    {specialties.map((specialty) => {
                      const selected = selectedCodes.includes(specialty.code);
                      const primary = primaryCode === specialty.code;
                      return (
                        <View key={specialty.code} style={styles.optionRow}>
                          <TouchableOpacity
                            onPress={() => toggleSpecialty(specialty.code)}
                            style={styles.optionMain}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            aria-checked={selected}
                            accessibilityLabel={`Especialidad ${specialty.name}`}
                          >
                            <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                              {selected ? <Check size={15} color={Colors.textInverse} strokeWidth={2.5} /> : null}
                            </View>
                            <Text style={styles.optionLabel}>{specialty.name}</Text>
                          </TouchableOpacity>
                          {selected ? (
                            <TouchableOpacity
                              onPress={() => setPrimaryCode(specialty.code)}
                              style={styles.primaryAction}
                              accessibilityRole="radio"
                              accessibilityState={{ checked: primary }}
                              aria-checked={primary}
                              accessibilityLabel={`${specialty.name} como especialidad principal`}
                            >
                              {primary ? (
                                <Star size={18} color={Colors.starFilled} fill={Colors.starFilled} strokeWidth={1.7} />
                              ) : (
                                <Circle size={18} color={Colors.textTertiary} strokeWidth={1.7} />
                              )}
                              <Text style={[styles.primaryText, primary && styles.primaryTextSelected]}>
                                Principal
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Modalidades y tarifas</Text>
                  <Text style={styles.helper}>Activa al menos una modalidad. La tarifa es por hora.</Text>
                  <View style={styles.optionList}>
                    {modalities.map((item) => (
                      <View key={item.code} style={styles.modalityRow}>
                        <View style={styles.modalityHeader}>
                          <Text style={styles.optionLabel}>{formatModalityLabel(item.code)}</Text>
                          <Switch
                            value={item.isEnabled}
                            onValueChange={(isEnabled) => updateModality(item.code, { isEnabled })}
                            trackColor={{ false: Colors.borderStrong, true: Colors.primaryLight }}
                            thumbColor={item.isEnabled ? Colors.primary : Colors.surface}
                            accessibilityLabel={`Activar ${formatModalityLabel(item.code)}`}
                          />
                        </View>
                        {item.isEnabled ? (
                          <View style={styles.priceRow}>
                            <TextInput
                              value={item.amount}
                              onChangeText={(amount) => updateModality(item.code, { amount })}
                              keyboardType="decimal-pad"
                              placeholder="Tarifa"
                              placeholderTextColor={Colors.textDisabled}
                              style={[styles.priceInput, !isValidAmount(item.amount) && styles.invalidInput]}
                              accessibilityLabel={`Tarifa por hora para ${formatModalityLabel(item.code)}`}
                            />
                            <View style={styles.currencySelector}>
                              {(catalogs?.currencies ?? []).map((currency) => (
                                <TouchableOpacity
                                  key={currency}
                                  onPress={() => updateModality(item.code, { currency })}
                                  style={styles.currencyAction}
                                  accessibilityRole="radio"
                                  accessibilityState={{ checked: item.currency === currency }}
                                  aria-checked={item.currency === currency}
                                >
                                  <Text style={item.currency === currency ? styles.currencySelected : styles.currencyText}>
                                    {currency}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <AppButton
              label="Guardar servicios"
              onPress={() => onSave({
                specialtyCodes: selectedCodes,
                primarySpecialtyCode: primaryCode,
                modalities,
              })}
              isLoading={isSaving}
              disabled={isLoading || !isValid}
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
    width: '100%', maxWidth: 680, maxHeight: '92%', alignSelf: 'center',
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    backgroundColor: Colors.surface, paddingTop: Spacing.sm, ...Shadow.lg,
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
  closeButton: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.full,
  },
  content: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, gap: Spacing.xl },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.label, color: Colors.textPrimary },
  helper: { ...Typography.caption, color: Colors.textSecondary },
  optionList: { borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  optionRow: {
    minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  optionMain: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  checkbox: {
    width: 22, height: 22, borderRadius: BorderRadius.sm,
    borderWidth: 1.5, borderColor: Colors.borderStrong, alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionLabel: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  primaryAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  primaryText: { ...Typography.caption, color: Colors.textTertiary },
  primaryTextSelected: { color: Colors.starFilled, fontFamily: FontFamily.bodySemiBold },
  modalityRow: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  modalityHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  priceInput: {
    flex: 1, minHeight: 48, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, color: Colors.textPrimary, ...Typography.body,
  },
  invalidInput: { borderColor: Colors.error },
  currencySelector: { flexDirection: 'row', alignItems: 'center' },
  currencyAction: { minHeight: 44, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  currencyText: { ...Typography.label, color: Colors.textTertiary },
  currencySelected: { ...Typography.label, color: Colors.primary, fontFamily: FontFamily.bodySemiBold },
  footer: {
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
});
