import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CircleAlert, Clock3, Plus, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../common/AppButton';
import type { WeeklyAvailabilityRule } from '../../models/ProfessionalProfile';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import {
  canAppendAvailabilityInterval,
  createAvailabilityRule,
  normalizeClockTime,
  sortAvailabilityRules,
  validateAvailabilityRules,
  WEEKDAY_LABELS,
} from '../../utils/availability';
import { shouldStackInteractiveContent } from '../../utils/responsiveLayout';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';

interface AvailabilityDraftRule extends WeeklyAvailabilityRule {
  readonly draftId: string;
}

interface ProfessionalAvailabilitySheetProps {
  readonly visible: boolean;
  readonly timezone: string;
  readonly rules: readonly WeeklyAvailabilityRule[];
  readonly isSubmitting: boolean;
  readonly error: string | null;
  readonly onSubmit: (rules: readonly WeeklyAvailabilityRule[]) => void;
  readonly onClose: () => void;
}

export const ProfessionalAvailabilitySheet: React.FC<ProfessionalAvailabilitySheetProps> = ({
  visible,
  timezone,
  rules,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const { fontScale, width } = useWindowDimensions();
  const shouldStackTimeFields = shouldStackInteractiveContent(width, fontScale);
  const sheetRef = useRef<View>(null);
  const sequenceRef = useRef(0);
  const [draftRules, setDraftRules] = useState<readonly AvailabilityDraftRule[]>([]);

  const withDraftId = useCallback((rule: WeeklyAvailabilityRule): AvailabilityDraftRule => ({
    ...rule,
    draftId: `availability-${sequenceRef.current++}`,
  }), []);

  useEffect(() => {
    if (!visible) return;
    sequenceRef.current = 0;
    setDraftRules(sortAvailabilityRules(rules.filter(({ isActive }) => isActive)).map(withDraftId));
    const frame = requestAnimationFrame(() => {
      const node = findNodeHandle(sheetRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, rules, withDraftId]);

  const rulesWithoutDraftIds = useMemo(
    () => draftRules.map(({ draftId: _draftId, ...rule }) => rule),
    [draftRules]
  );
  const validation = useMemo(
    () => validateAvailabilityRules(rulesWithoutDraftIds),
    [rulesWithoutDraftIds]
  );

  const rulesForWeekday = (weekday: number) => (
    draftRules.filter((rule) => rule.weekday === weekday)
  );

  const toggleWeekday = (weekday: number, enabled: boolean) => {
    setDraftRules((current) => {
      if (!enabled) return current.filter((rule) => rule.weekday !== weekday);
      if (current.some((rule) => rule.weekday === weekday)) return current;
      return sortAvailabilityRules([
        ...current,
        withDraftId(createAvailabilityRule(weekday)),
      ]);
    });
  };

  const addInterval = (weekday: number) => {
    setDraftRules((current) => {
      const dayRules = current.filter((rule) => rule.weekday === weekday);
      return sortAvailabilityRules([
        ...current,
        withDraftId(createAvailabilityRule(weekday, dayRules)),
      ]);
    });
  };

  const updateRule = (
    draftId: string,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setDraftRules((current) => current.map((rule) => (
      rule.draftId === draftId ? { ...rule, [field]: value } : rule
    )));
  };

  const normalizeRuleField = (
    draftId: string,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    const normalized = normalizeClockTime(value);
    if (normalized) updateRule(draftId, field, normalized);
  };

  const removeRule = (draftId: string) => {
    setDraftRules((current) => current.filter((rule) => rule.draftId !== draftId));
  };

  const submit = () => {
    if (!validation.isValid) return;
    const normalized = rulesWithoutDraftIds.map((rule) => ({
      ...rule,
      startTime: normalizeClockTime(rule.startTime)!,
      endTime: normalizeClockTime(rule.endTime)!,
      isActive: true,
    }));
    onSubmit(sortAvailabilityRules(normalized));
  };

  return (
    <Modal
      visible={visible}
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
        <View
          ref={sheetRef}
          role="dialog"
          accessibilityViewIsModal
          accessibilityLabel="Editar disponibilidad semanal"
          collapsable={false}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Clock3
                size={IconSize.action}
                strokeWidth={IconStroke.regular}
                color={Colors.primary}
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Disponibilidad semanal</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{timezone}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Cerrar edición de disponibilidad"
            >
              <X
                size={IconSize.action}
                strokeWidth={IconStroke.regular}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.guidance}>
              Activa los días de atención. Puedes añadir intervalos separados para pausas.
            </Text>

            {WEEKDAY_LABELS.map((label, weekday) => {
              const dayRules = rulesForWeekday(weekday);
              const enabled = dayRules.length > 0;
              const canAddInterval = canAppendAvailabilityInterval(dayRules);
              const dayError = validation.errorsByWeekday[weekday];
              return (
                <View key={label} style={styles.daySection}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayCopy}>
                      <Text style={styles.dayLabel}>{label}</Text>
                      <Text style={styles.dayStatus}>
                        {enabled
                          ? dayRules.length === 1 ? '1 intervalo' : `${dayRules.length} intervalos`
                          : 'No disponible'}
                      </Text>
                    </View>
                    <Switch
                      value={enabled}
                      onValueChange={(value) => toggleWeekday(weekday, value)}
                      disabled={isSubmitting}
                      trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                      thumbColor={enabled ? Colors.primary : Colors.surface}
                      ios_backgroundColor={Colors.border}
                      accessibilityLabel={`${enabled ? 'Desactivar' : 'Activar'} ${label}`}
                    />
                  </View>

                  {enabled ? (
                    <View style={styles.intervals}>
                      {dayRules.map((rule, index) => (
                        <View
                          key={rule.draftId}
                          style={[
                            styles.intervalRow,
                            shouldStackTimeFields && styles.intervalRowStacked,
                          ]}
                        >
                          <View style={styles.timeField}>
                            <Text style={styles.timeLabel}>Desde</Text>
                            <TextInput
                              value={rule.startTime.slice(0, 5)}
                              onChangeText={(value) => updateRule(rule.draftId, 'startTime', value)}
                              onBlur={() => normalizeRuleField(
                                rule.draftId,
                                'startTime',
                                rule.startTime
                              )}
                              placeholder="09:00"
                              placeholderTextColor={Colors.textDisabled}
                              maxLength={5}
                              keyboardType="numbers-and-punctuation"
                              style={[styles.timeInput, dayError && styles.timeInputError]}
                              accessibilityLabel={`${label}, intervalo ${index + 1}, hora de inicio`}
                            />
                          </View>
                          <View style={styles.timeField}>
                            <Text style={styles.timeLabel}>Hasta</Text>
                            <TextInput
                              value={rule.endTime.slice(0, 5)}
                              onChangeText={(value) => updateRule(rule.draftId, 'endTime', value)}
                              onBlur={() => normalizeRuleField(
                                rule.draftId,
                                'endTime',
                                rule.endTime
                              )}
                              placeholder="17:00"
                              placeholderTextColor={Colors.textDisabled}
                              maxLength={5}
                              keyboardType="numbers-and-punctuation"
                              style={[styles.timeInput, dayError && styles.timeInputError]}
                              accessibilityLabel={`${label}, intervalo ${index + 1}, hora de fin`}
                            />
                          </View>
                          <TouchableOpacity
                            onPress={() => removeRule(rule.draftId)}
                            disabled={isSubmitting}
                            style={[
                              styles.removeButton,
                              shouldStackTimeFields && styles.removeButtonStacked,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Eliminar intervalo ${index + 1} de ${label}`}
                          >
                            <Trash2
                              size={IconSize.action}
                              strokeWidth={IconStroke.regular}
                              color={Colors.error}
                            />
                          </TouchableOpacity>
                        </View>
                      ))}

                      {dayError ? (
                        <View style={styles.dayError} accessibilityRole="alert">
                          <CircleAlert
                            size={IconSize.inline}
                            strokeWidth={IconStroke.regular}
                            color={Colors.error}
                          />
                          <Text style={styles.dayErrorText}>{dayError}</Text>
                        </View>
                      ) : null}

                      <TouchableOpacity
                        onPress={() => addInterval(weekday)}
                        disabled={isSubmitting || !canAddInterval}
                        style={[styles.addButton, !canAddInterval && styles.disabledAction]}
                        accessibilityRole="button"
                        accessibilityLabel={`Agregar otro intervalo el ${label}`}
                        accessibilityState={{ disabled: isSubmitting || !canAddInterval }}
                      >
                        <Plus
                          size={IconSize.inline}
                          strokeWidth={IconStroke.regular}
                          color={Colors.primary}
                        />
                        <Text style={styles.addButtonText}>Agregar intervalo</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {draftRules.length === 0 ? (
              <View style={styles.emptyWarning} accessibilityRole="alert">
                <CircleAlert
                  size={IconSize.action}
                  strokeWidth={IconStroke.regular}
                  color={Colors.warning}
                />
                <Text style={styles.emptyWarningText}>
                  Sin días activos no se ofrecerán horarios para nuevas citas.
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.serverError} accessibilityRole="alert">
                <CircleAlert
                  size={IconSize.action}
                  strokeWidth={IconStroke.regular}
                  color={Colors.error}
                />
                <Text style={styles.serverErrorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <AppButton
              label="Guardar disponibilidad"
              onPress={submit}
              isLoading={isSubmitting}
              disabled={!validation.isValid}
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
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '94%',
    alignSelf: 'center',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
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
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: Colors.textTertiary,
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
    gap: Spacing.md,
  },
  guidance: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  daySection: {
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.base,
  },
  dayHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  dayCopy: {
    flex: 1,
  },
  dayLabel: {
    ...Typography.body,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textPrimary,
  },
  dayStatus: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xxs,
  },
  intervals: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  intervalRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  timeField: {
    flex: 1,
    gap: Spacing.xs,
  },
  timeLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  timeInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceSoft,
  },
  timeInputError: {
    borderColor: Colors.error,
  },
  removeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  removeButtonStacked: {
    alignSelf: 'flex-end',
  },
  dayError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  dayErrorText: {
    ...Typography.caption,
    color: Colors.error,
    flex: 1,
  },
  addButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  addButtonText: {
    ...Typography.button,
    color: Colors.primary,
  },
  disabledAction: {
    opacity: 0.45,
  },
  emptyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.warningSurface,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  emptyWarningText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    flex: 1,
  },
  serverError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.errorSurface,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  serverErrorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
});
