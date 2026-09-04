import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarCheck, CircleAlert, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../common/AppButton';
import { AppointmentModalityIcon } from './AppointmentModalityIcon';
import type {
  Appointment,
  AppointmentModality,
  AppointmentPolicy,
  AppointmentRelationship,
  AppointmentSlot,
} from '../../repositories/AppointmentRepository';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import {
  formatAppointmentSlotDateOption,
  formatAppointmentSlotTime,
  groupAppointmentSlots,
} from '../../utils/appointmentPresentation';
import { formatModalityLabel } from '../../utils/modality';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import type { UserRole } from '../../services/AuthService';

interface AppointmentScheduleSheetProps {
  readonly visible: boolean;
  readonly rescheduling: Appointment | null;
  readonly policy: AppointmentPolicy | null;
  readonly relationships: readonly AppointmentRelationship[];
  readonly selectedRelationshipId: string | null;
  readonly selectedModality: AppointmentModality | null;
  readonly slots: readonly AppointmentSlot[];
  readonly selectedSlot: AppointmentSlot | null;
  readonly isLoadingSlots: boolean;
  readonly isSubmitting: boolean;
  readonly error: string | null;
  readonly role: UserRole | null;
  readonly onSelectRelationship: (relationship: AppointmentRelationship) => void;
  readonly onSelectModality: (modality: AppointmentModality) => void;
  readonly onSelectSlot: (slot: AppointmentSlot) => void;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

export const AppointmentScheduleSheet: React.FC<AppointmentScheduleSheetProps> = ({
  visible,
  rescheduling,
  policy,
  relationships,
  selectedRelationshipId,
  selectedModality,
  slots,
  selectedSlot,
  isLoadingSlots,
  isSubmitting,
  error,
  role,
  onSelectRelationship,
  onSelectModality,
  onSelectSlot,
  onConfirm,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const sheetRef = useRef<View>(null);
  const selectedRelationship = relationships.find(({ id }) => id === selectedRelationshipId) ?? null;
  const slotGroups = useMemo(() => groupAppointmentSlots(slots), [slots]);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const selectedSlotGroup = slotGroups.find(({ key }) => key === selectedDayKey) ?? slotGroups[0] ?? null;
  const counterpartLabel = role === 'psychologist' ? 'Paciente' : 'Profesional';

  useEffect(() => {
    setSelectedDayKey((current) => (
      current && slotGroups.some(({ key }) => key === current)
        ? current
        : slotGroups[0]?.key ?? null
    ));
  }, [slotGroups]);

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
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
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
          accessibilityLabel={rescheduling ? 'Reprogramar cita' : 'Programar cita'}
          collapsable={false}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <CalendarCheck
                size={IconSize.action}
                strokeWidth={IconStroke.regular}
                color={Colors.primary}
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>
                {rescheduling ? 'Reprogramar cita' : 'Programar cita'}
              </Text>
              <Text style={styles.subtitle}>
                {policy
                  ? `Sesiones de ${policy.durationMinutes} minutos`
                  : 'Configuración de agenda no disponible'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Cerrar programación"
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
          >
            {!rescheduling ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{counterpartLabel}</Text>
                {relationships.length === 1 && selectedRelationship ? (
                  <Text style={styles.counterpartName}>
                    {selectedRelationship.counterpart.displayName}
                  </Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {relationships.map((relationship) => {
                      const selected = relationship.id === selectedRelationshipId;
                      return (
                        <Pressable
                          key={relationship.id}
                          onPress={() => onSelectRelationship(relationship)}
                          style={[styles.chip, selected && styles.chipSelected]}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          aria-checked={selected}
                          accessibilityLabel={`Programar con ${relationship.counterpart.displayName}`}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                            {relationship.counterpart.displayName}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            ) : null}

            {selectedRelationship ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Modalidad</Text>
                <View style={styles.modalityRow}>
                  {selectedRelationship.enabledModalities.map((modality) => {
                    const selected = modality === selectedModality;
                    return (
                      <Pressable
                        key={modality}
                        onPress={() => onSelectModality(modality)}
                        disabled={Boolean(rescheduling)}
                        style={[styles.modality, selected && styles.modalitySelected]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, disabled: Boolean(rescheduling) }}
                        aria-checked={selected}
                        >
                        <AppointmentModalityIcon
                          modality={modality}
                          color={selected ? Colors.textInverse : Colors.primary}
                        />
                        <Text style={[
                          styles.modalityText,
                          selected && styles.modalityTextSelected,
                        ]}>
                          {formatModalityLabel(modality)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              {isLoadingSlots ? (
                <View style={styles.stateBox} accessibilityRole="progressbar">
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.stateText}>Consultando disponibilidad…</Text>
                </View>
              ) : error ? (
                <View style={[styles.stateBox, styles.errorBox]} accessibilityRole="alert">
                  <CircleAlert
                    size={IconSize.action}
                    strokeWidth={IconStroke.regular}
                    color={Colors.error}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : slotGroups.length > 0 ? (
                <View style={styles.slotPicker}>
                  <Text style={styles.sectionLabel}>Fecha</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dateRow}
                  >
                    {slotGroups.map((group) => {
                      const dateOption = formatAppointmentSlotDateOption(group.slots[0]);
                      const selected = group.key === selectedSlotGroup?.key;
                      return (
                        <Pressable
                          key={group.key}
                          onPress={() => setSelectedDayKey(group.key)}
                          style={[styles.dateOption, selected && styles.dateOptionSelected]}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          aria-checked={selected}
                          accessibilityLabel={group.label}
                        >
                          <Text style={[styles.dateWeekday, selected && styles.dateTextSelected]}>
                            {dateOption.weekday}
                          </Text>
                          <Text style={[styles.dateValue, selected && styles.dateTextSelected]}>
                            {dateOption.date}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {selectedSlotGroup ? (
                    <View style={styles.slotGroup}>
                      <Text style={styles.sectionLabel}>Hora</Text>
                      <View style={styles.slotRow}>
                        {selectedSlotGroup.slots.map((slot) => {
                          const selected = selectedSlot?.startsAt === slot.startsAt;
                          return (
                            <Pressable
                              key={slot.startsAt}
                              onPress={() => onSelectSlot(slot)}
                              style={[styles.slot, selected && styles.slotSelected]}
                              accessibilityRole="radio"
                              accessibilityState={{ checked: selected }}
                              aria-checked={selected}
                              accessibilityLabel={`Horario ${selectedSlotGroup.label}, ${formatAppointmentSlotTime(slot)}`}
                            >
                              <Text style={[styles.slotText, selected && styles.slotTextSelected]}>
                                {formatAppointmentSlotTime(slot)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.stateBox}>
                  <Text style={styles.stateText}>
                    No hay horarios disponibles para esta modalidad en el periodo consultado.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <AppButton
              label={rescheduling ? 'Confirmar nuevo horario' : 'Confirmar cita'}
              onPress={onConfirm}
              isLoading={isSubmitting}
              disabled={!selectedSlot || !policy}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </View>
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
    maxHeight: '92%',
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
    width: 44,
    height: 44,
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
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexShrink: 1,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  counterpartName: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  chipRow: {
    gap: Spacing.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  chipText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textInverse,
  },
  modalityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  modality: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  modalitySelected: {
    backgroundColor: Colors.primary,
  },
  modalityText: {
    ...Typography.bodySmall,
    color: Colors.primary,
  },
  modalityTextSelected: {
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textInverse,
  },
  stateBox: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  stateText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: Colors.errorSurface,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    textAlign: 'center',
  },
  slotPicker: {
    gap: Spacing.md,
  },
  dateRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.xl,
  },
  dateOption: {
    minWidth: 76,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  dateOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  dateWeekday: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  dateValue: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bodySemiBold,
    textTransform: 'capitalize',
  },
  dateTextSelected: {
    color: Colors.textInverse,
  },
  slotGroup: {
    gap: Spacing.sm,
  },
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  slot: {
    minWidth: 88,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  slotSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  slotText: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textPrimary,
  },
  slotTextSelected: {
    color: Colors.textInverse,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
});
