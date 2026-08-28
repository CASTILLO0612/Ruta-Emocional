import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../components/common/AppButton';
import {
  Appointment,
  AppointmentModality,
  AppointmentPolicy,
  AppointmentRelationship,
  AppointmentSlot,
  AppointmentTransition,
  createAppointment,
  fetchAppointmentPolicy,
  fetchAppointmentRelationships,
  fetchAppointments,
  fetchAppointmentSlots,
  rescheduleAppointment,
  transitionAppointment,
} from '../../repositories/AppointmentRepository';
import {
  subscribeToAppointmentReminders,
  subscribeToAppointmentUpdates,
} from '../../services/socketClient';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

const STATUS_LABELS: Record<Appointment['status'], string> = {
  SCHEDULED: 'Pendiente de confirmar',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Inasistencia',
};

const MODALITY_LABELS: Record<AppointmentModality, string> = {
  CHAT: 'Chat',
  CALL: 'Llamada',
  IN_PERSON: 'Presencial',
};

const MODALITY_ICONS: Record<AppointmentModality, keyof typeof MaterialIcons.glyphMap> = {
  CHAT: 'chat-bubble-outline',
  CALL: 'phone',
  IN_PERSON: 'place',
};

function formatAppointmentDate(isoDate: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

function formatSlotDate(isoDate: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

export const AgendaScreen: React.FC = () => {
  const role = useAuthStore(({ role: currentRole }) => currentRole);
  const canCreate = useAuthStore(({ userProfile }) => (
    userProfile?.capabilities.includes('appointment:create:self') ?? false
  ));
  const [relationships, setRelationships] = useState<readonly AppointmentRelationship[]>([]);
  const [policy, setPolicy] = useState<AppointmentPolicy | null>(null);
  const [upcoming, setUpcoming] = useState<readonly Appointment[]>([]);
  const [history, setHistory] = useState<readonly Appointment[]>([]);
  const [scope, setScope] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [selectedModality, setSelectedModality] = useState<AppointmentModality | null>(null);
  const [slots, setSlots] = useState<readonly AppointmentSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [mutationId, setMutationId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  const visibleAppointments = scope === 'UPCOMING' ? upcoming : history;
  const selectedRelationship = useMemo(
    () => relationships.find(({ id }) => id === selectedRelationshipId) ?? null,
    [relationships, selectedRelationshipId]
  );

  const loadAgenda = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const [nextPolicy, nextRelationships, nextUpcoming, nextHistory] = await Promise.all([
        fetchAppointmentPolicy(signal),
        fetchAppointmentRelationships(signal),
        fetchAppointments('UPCOMING', undefined, signal),
        fetchAppointments('HISTORY', undefined, signal),
      ]);
      if (signal?.aborted) return;
      setPolicy(nextPolicy);
      setRelationships(nextRelationships);
      setUpcoming(nextUpcoming.data);
      setHistory(nextHistory.data);
      setSelectedRelationshipId((current) => (
        current && nextRelationships.some(({ id }) => id === current)
          ? current
          : nextRelationships[0]?.id ?? null
      ));
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar la agenda.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void loadAgenda(controller.signal);
    const unsubscribeUpdates = subscribeToAppointmentUpdates(() => void loadAgenda());
    const unsubscribeReminders = subscribeToAppointmentReminders((reminder) => {
      setReminderMessage(`Tienes una cita programada para ${formatAppointmentDate(reminder.startsAt)}.`);
      void loadAgenda();
    });
    return () => {
      controller.abort();
      unsubscribeUpdates();
      unsubscribeReminders();
    };
  }, [loadAgenda]));

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAgenda();
    setIsRefreshing(false);
  }, [loadAgenda]);

  const loadSlots = useCallback(async (
    relationship: AppointmentRelationship,
    modality: AppointmentModality,
    activePolicy: AppointmentPolicy
  ) => {
    setIsLoadingSlots(true);
    setError(null);
    try {
      const from = new Date(
        Date.now() + (activePolicy.minimumLeadMinutes + 1) * 60_000
      );
      const windowDays = Math.min(14, activePolicy.maximumHorizonDays);
      const until = new Date(Date.now() + windowDays * 86_400_000);
      setSlots(await fetchAppointmentSlots({
        careRelationshipId: relationship.id,
        modality,
        from,
        until,
      }));
    } catch (slotError) {
      setSlots([]);
      setError(slotError instanceof Error ? slotError.message : 'No pudimos consultar horarios.');
    } finally {
      setIsLoadingSlots(false);
    }
  }, []);

  const openSchedule = useCallback((appointment?: Appointment) => {
    if (!policy) return;
    const relationship = appointment
      ? relationships.find(({ id }) => id === appointment.careRelationshipId)
      : selectedRelationship ?? relationships[0];
    if (!relationship) return;
    const modality = appointment?.modality ?? relationship.enabledModalities[0];
    if (!modality) return;
    setRescheduling(appointment ?? null);
    setSelectedRelationshipId(relationship.id);
    setSelectedModality(modality);
    setIsScheduleOpen(true);
    void loadSlots(relationship, modality, policy);
  }, [loadSlots, policy, relationships, selectedRelationship]);

  const chooseRelationship = useCallback((relationship: AppointmentRelationship) => {
    if (!policy) return;
    const modality = relationship.enabledModalities[0] ?? null;
    setSelectedRelationshipId(relationship.id);
    setSelectedModality(modality);
    setSlots([]);
    if (modality) void loadSlots(relationship, modality, policy);
  }, [loadSlots, policy]);

  const chooseModality = useCallback((modality: AppointmentModality) => {
    if (!policy || !selectedRelationship) return;
    setSelectedModality(modality);
    void loadSlots(selectedRelationship, modality, policy);
  }, [loadSlots, policy, selectedRelationship]);

  const chooseSlot = useCallback(async (slot: AppointmentSlot) => {
    if (!selectedRelationship || !selectedModality) return;
    const operationId = rescheduling?.id ?? 'create';
    setMutationId(operationId);
    setError(null);
    try {
      if (rescheduling) {
        await rescheduleAppointment(rescheduling.id, slot.startsAt, randomUUID());
      } else {
        await createAppointment({
          careRelationshipId: selectedRelationship.id,
          modality: selectedModality,
          startsAt: slot.startsAt,
        }, randomUUID());
      }
      setIsScheduleOpen(false);
      setRescheduling(null);
      setSlots([]);
      await loadAgenda();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'No pudimos guardar la cita.');
    } finally {
      setMutationId(null);
    }
  }, [loadAgenda, rescheduling, selectedModality, selectedRelationship]);

  const runTransition = useCallback(async (
    appointment: Appointment,
    transition: AppointmentTransition,
    reason?: string
  ) => {
    setMutationId(appointment.id);
    setError(null);
    try {
      await transitionAppointment(appointment.id, transition, randomUUID(), reason);
      setCancellingId(null);
      setCancellationReason('');
      await loadAgenda();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'No pudimos actualizar la cita.');
    } finally {
      setMutationId(null);
    }
  }, [loadAgenda]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.supportingText}>Cargando agenda</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Agenda</Text>
          <Text style={styles.subtitle}>Citas vinculadas a relaciones de atención activas</Text>
        </View>
        {canCreate && relationships.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Programar una cita"
            onPress={() => isScheduleOpen ? setIsScheduleOpen(false) : openSchedule()}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <MaterialIcons name={isScheduleOpen ? 'close' : 'add'} size={24} color={Colors.textInverse} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh()}
            tintColor={Colors.primary}
          />
        )}
      >
        {error ? (
          <Pressable onPress={() => void refresh()} style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={20} color={Colors.error} />
            <View style={styles.flex}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.retryText}>Toca para volver a cargar</Text>
            </View>
          </Pressable>
        ) : null}

        {reminderMessage ? (
          <Pressable onPress={() => setReminderMessage(null)} style={styles.reminderBanner}>
            <MaterialIcons name="notifications-none" size={20} color={Colors.primary} />
            <Text style={styles.reminderText}>{reminderMessage}</Text>
            <MaterialIcons name="close" size={18} color={Colors.textTertiary} />
          </Pressable>
        ) : null}

        {isScheduleOpen && policy ? (
          <View style={styles.schedulePanel}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>
                  {rescheduling ? 'Reprogramar cita' : 'Programar cita'}
                </Text>
                <Text style={styles.sectionCaption}>
                  Duración configurada: {policy.durationMinutes} minutos
                </Text>
              </View>
              <MaterialIcons name="event-available" size={24} color={Colors.primary} />
            </View>

            {!rescheduling ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {relationships.map((relationship) => (
                  <Pressable
                    key={relationship.id}
                    onPress={() => chooseRelationship(relationship)}
                    style={[
                      styles.relationshipChip,
                      relationship.id === selectedRelationshipId && styles.chipSelected,
                    ]}
                  >
                    <Text style={[
                      styles.chipText,
                      relationship.id === selectedRelationshipId && styles.chipTextSelected,
                    ]}>
                      {relationship.counterpart.displayName}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {selectedRelationship ? (
              <View style={styles.modalityRow}>
                {selectedRelationship.enabledModalities.map((modality) => (
                  <Pressable
                    key={modality}
                    onPress={() => chooseModality(modality)}
                    disabled={Boolean(rescheduling)}
                    style={[
                      styles.modalityChip,
                      modality === selectedModality && styles.modalitySelected,
                    ]}
                  >
                    <MaterialIcons
                      name={MODALITY_ICONS[modality]}
                      size={16}
                      color={modality === selectedModality ? Colors.textInverse : Colors.primary}
                    />
                    <Text style={[
                      styles.modalityText,
                      modality === selectedModality && styles.modalityTextSelected,
                    ]}>
                      {MODALITY_LABELS[modality]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {isLoadingSlots ? (
              <ActivityIndicator style={styles.slotLoader} color={Colors.primary} />
            ) : slots.length > 0 ? (
              <View style={styles.slotGrid}>
                {slots.slice(0, 24).map((slot) => (
                  <Pressable
                    key={slot.startsAt}
                    disabled={mutationId !== null}
                    onPress={() => void chooseSlot(slot)}
                    style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}
                  >
                    <MaterialIcons name="schedule" size={16} color={Colors.primary} />
                    <Text style={styles.slotText}>{formatSlotDate(slot.startsAt)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.emptySlots}>
                No hay espacios disponibles en los próximos días para esta modalidad.
              </Text>
            )}
          </View>
        ) : null}

        <View style={styles.segmentedControl}>
          {(['UPCOMING', 'HISTORY'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setScope(value)}
              style={[styles.segment, scope === value && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, scope === value && styles.segmentTextActive]}>
                {value === 'UPCOMING' ? 'Próximas' : 'Historial'}
              </Text>
            </Pressable>
          ))}
        </View>

        {visibleAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="event-note" size={30} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {scope === 'UPCOMING' ? 'No hay citas próximas' : 'No hay citas en el historial'}
            </Text>
            <Text style={styles.emptyText}>
              {canCreate && relationships.length > 0
                ? 'Selecciona un espacio disponible para programar tu próxima sesión.'
                : 'Las citas aparecerán después de establecer una relación de atención activa.'}
            </Text>
          </View>
        ) : visibleAppointments.map((appointment) => {
          const busy = mutationId === appointment.id;
          const ended = new Date(appointment.endsAt).getTime() <= Date.now();
          const canReschedule = ['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && !ended;
          return (
            <View key={appointment.id} style={styles.appointmentCard}>
              <View style={styles.cardTopRow}>
                <View style={styles.modalityIcon}>
                  <MaterialIcons
                    name={MODALITY_ICONS[appointment.modality]}
                    size={20}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.counterpart}>{appointment.counterpart.displayName}</Text>
                  <Text style={styles.date}>{formatAppointmentDate(appointment.startsAt)}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{STATUS_LABELS[appointment.status]}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{MODALITY_LABELS[appointment.modality]}</Text>
                <View style={styles.dot} />
                <Text style={styles.metaText}>{appointment.timezone}</Text>
              </View>

              {appointment.cancellationReason ? (
                <Text style={styles.reasonText}>{appointment.cancellationReason}</Text>
              ) : null}

              {cancellingId === appointment.id ? (
                <View style={styles.cancellationBox}>
                  <TextInput
                    value={cancellationReason}
                    onChangeText={setCancellationReason}
                    placeholder="Motivo de cancelación"
                    placeholderTextColor={Colors.textTertiary}
                    maxLength={500}
                    multiline
                    style={styles.reasonInput}
                  />
                  <View style={styles.actionRow}>
                    <AppButton
                      label="Volver"
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        setCancellingId(null);
                        setCancellationReason('');
                      }}
                    />
                    <AppButton
                      label="Confirmar cancelación"
                      variant="danger"
                      size="sm"
                      disabled={!cancellationReason.trim()}
                      isLoading={busy}
                      onPress={() => void runTransition(
                        appointment,
                        'CANCEL',
                        cancellationReason.trim()
                      )}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  {role === 'psychologist' && appointment.status === 'SCHEDULED' && !ended ? (
                    <AppButton
                      label="Confirmar"
                      size="sm"
                      variant="secondary"
                      isLoading={busy}
                      onPress={() => void runTransition(appointment, 'CONFIRM')}
                    />
                  ) : null}
                  {role === 'psychologist' && appointment.status === 'CONFIRMED' && !ended ? (
                    <AppButton
                      label="Iniciar"
                      size="sm"
                      variant="secondary"
                      isLoading={busy}
                      onPress={() => void runTransition(appointment, 'START')}
                    />
                  ) : null}
                  {role === 'psychologist' && appointment.status === 'IN_PROGRESS' ? (
                    <AppButton
                      label="Completar"
                      size="sm"
                      variant="secondary"
                      isLoading={busy}
                      onPress={() => void runTransition(appointment, 'COMPLETE')}
                    />
                  ) : null}
                  {role === 'psychologist'
                    && ended
                    && ['SCHEDULED', 'CONFIRMED'].includes(appointment.status) ? (
                      <AppButton
                        label="Marcar inasistencia"
                        size="sm"
                        variant="outline"
                        isLoading={busy}
                        onPress={() => void runTransition(appointment, 'NO_SHOW')}
                      />
                    ) : null}
                  {canReschedule ? (
                    <AppButton
                      label="Reprogramar"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onPress={() => openSchedule(appointment)}
                    />
                  ) : null}
                  {['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(appointment.status) && !ended ? (
                    <AppButton
                      label="Cancelar"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onPress={() => setCancellingId(appointment.id)}
                    />
                  ) : null}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  title: { ...Typography.h1, color: Colors.textPrimary },
  subtitle: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xs },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  pressed: { opacity: 0.75 },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  flex: { flex: 1, minWidth: 0 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  supportingText: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.md },
  errorBanner: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { ...Typography.bodySmall, color: Colors.error },
  retryText: { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.xxs },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#DCE4FA',
  },
  reminderText: { ...Typography.bodySmall, color: Colors.textPrimary, flex: 1 },
  schedulePanel: {
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    marginBottom: Spacing.lg,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...Typography.h3, color: Colors.textPrimary },
  sectionCaption: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xxs },
  chipScroll: { marginTop: Spacing.base },
  relationshipChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    marginRight: Spacing.sm,
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.bodySmall, color: Colors.textSecondary },
  chipTextSelected: { color: Colors.textInverse, fontWeight: '600' },
  modalityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.base },
  modalityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  modalitySelected: { backgroundColor: Colors.primary },
  modalityText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  modalityTextSelected: { color: Colors.textInverse },
  slotLoader: { marginVertical: Spacing.xl },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.base },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    width: '48%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E1E8F8',
  },
  slotPressed: { backgroundColor: '#EEF2FF' },
  slotText: { ...Typography.caption, color: Colors.textPrimary, flex: 1 },
  emptySlots: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.base },
  segmentedControl: {
    flexDirection: 'row',
    padding: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F4F6FA',
    marginBottom: Spacing.base,
  },
  segment: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.sm },
  segmentActive: { backgroundColor: Colors.surface },
  segmentText: { ...Typography.bodySmall, color: Colors.textSecondary, fontWeight: '600' },
  segmentTextActive: { color: Colors.primary },
  emptyState: { alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxxl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    marginBottom: Spacing.base,
  },
  emptyTitle: { ...Typography.h3, color: Colors.textPrimary, textAlign: 'center' },
  emptyText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
  appointmentCard: {
    paddingVertical: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  modalityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  counterpart: { ...Typography.h4, color: Colors.textPrimary },
  date: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xxs },
  statusPill: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: '#F4F6FA' },
  statusText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginLeft: 54, marginTop: Spacing.sm },
  metaText: { ...Typography.caption, color: Colors.textTertiary },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textTertiary },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md },
  reasonText: { ...Typography.bodySmall, color: Colors.textSecondary, marginLeft: 54, marginTop: Spacing.sm },
  cancellationBox: { marginLeft: 54, marginTop: Spacing.md },
  reasonInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    textAlignVertical: 'top',
    color: Colors.textPrimary,
    ...Typography.body,
  },
});
