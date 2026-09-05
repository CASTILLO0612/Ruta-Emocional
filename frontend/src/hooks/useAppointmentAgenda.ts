import { useFocusEffect } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import { useCallback, useMemo, useRef, useState } from 'react';

import { getDeviceTimeZone } from '../config/localization';
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
} from '../repositories/AppointmentRepository';
import {
  subscribeToAppointmentReminders,
  subscribeToAppointmentUpdates,
} from '../services/socketClient';
import {
  AppointmentAction,
  formatAppointmentDate,
} from '../utils/appointmentPresentation';
import { presentUserError } from '../utils/userFacingError';

export function useAppointmentAgenda() {
  const agendaGenerationRef = useRef(0);
  const slotsGenerationRef = useRef(0);
  const [relationships, setRelationships] = useState<readonly AppointmentRelationship[]>([]);
  const [policy, setPolicy] = useState<AppointmentPolicy | null>(null);
  const [upcoming, setUpcoming] = useState<readonly Appointment[]>([]);
  const [history, setHistory] = useState<readonly Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [selectedModality, setSelectedModality] = useState<AppointmentModality | null>(null);
  const [slots, setSlots] = useState<readonly AppointmentSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [optionsAppointment, setOptionsAppointment] = useState<Appointment | null>(null);
  const [mutationId, setMutationId] = useState<string | null>(null);

  const selectedRelationship = useMemo(
    () => relationships.find(({ id }) => id === selectedRelationshipId) ?? null,
    [relationships, selectedRelationshipId]
  );

  const loadAgenda = useCallback(async (signal?: AbortSignal) => {
    const requestGeneration = ++agendaGenerationRef.current;
    try {
      setError(null);
      const [nextPolicy, nextRelationships, nextUpcoming, nextHistory] = await Promise.all([
        fetchAppointmentPolicy(signal),
        fetchAppointmentRelationships(signal),
        fetchAppointments('UPCOMING', undefined, signal),
        fetchAppointments('HISTORY', undefined, signal),
      ]);
      if (signal?.aborted || requestGeneration !== agendaGenerationRef.current) return;
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
      if (requestGeneration !== agendaGenerationRef.current) return;
      setError(presentUserError(loadError, 'No pudimos cargar la agenda. Inténtalo nuevamente.'));
    } finally {
      if (!signal?.aborted && requestGeneration === agendaGenerationRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void loadAgenda(controller.signal);
    const unsubscribeUpdates = subscribeToAppointmentUpdates(() => void loadAgenda());
    const unsubscribeReminders = subscribeToAppointmentReminders((reminder) => {
      const reminderDate = formatAppointmentDate(reminder.startsAt, getDeviceTimeZone());
      setReminderMessage(`Tienes una cita programada para ${reminderDate}.`);
      void loadAgenda();
    });
    return () => {
      agendaGenerationRef.current += 1;
      slotsGenerationRef.current += 1;
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
    const requestGeneration = ++slotsGenerationRef.current;
    setIsLoadingSlots(true);
    setSlotError(null);
    setSelectedSlot(null);
    try {
      const from = new Date(Date.now() + (activePolicy.minimumLeadMinutes + 1) * 60_000);
      const until = new Date(Date.now() + activePolicy.maximumHorizonDays * 86_400_000);
      const nextSlots = await fetchAppointmentSlots({
        careRelationshipId: relationship.id,
        modality,
        from,
        until,
      });
      if (requestGeneration === slotsGenerationRef.current) setSlots(nextSlots);
    } catch (loadError) {
      if (requestGeneration !== slotsGenerationRef.current) return;
      setSlots([]);
      setSlotError(
        presentUserError(loadError, 'No pudimos consultar los horarios. Inténtalo nuevamente.')
      );
    } finally {
      if (requestGeneration === slotsGenerationRef.current) setIsLoadingSlots(false);
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
    setSelectedSlot(null);
    setSlotError(null);
    setIsScheduleOpen(true);
    void loadSlots(relationship, modality, policy);
  }, [loadSlots, policy, relationships, selectedRelationship]);

  const closeSchedule = useCallback(() => {
    if (mutationId !== null) return;
    slotsGenerationRef.current += 1;
    setIsScheduleOpen(false);
    setRescheduling(null);
    setSelectedSlot(null);
    setSlots([]);
    setSlotError(null);
  }, [mutationId]);

  const chooseRelationship = useCallback((relationship: AppointmentRelationship) => {
    if (!policy) return;
    const modality = relationship.enabledModalities[0] ?? null;
    setSelectedRelationshipId(relationship.id);
    setSelectedModality(modality);
    setSlots([]);
    setSelectedSlot(null);
    if (modality) void loadSlots(relationship, modality, policy);
  }, [loadSlots, policy]);

  const chooseModality = useCallback((modality: AppointmentModality) => {
    if (!policy || !selectedRelationship) return;
    setSelectedModality(modality);
    setSelectedSlot(null);
    void loadSlots(selectedRelationship, modality, policy);
  }, [loadSlots, policy, selectedRelationship]);

  const confirmSelectedSlot = useCallback(async () => {
    if (!selectedRelationship || !selectedModality || !selectedSlot) return;
    const operationId = rescheduling?.id ?? 'create';
    setMutationId(operationId);
    setSlotError(null);
    try {
      if (rescheduling) {
        await rescheduleAppointment(rescheduling.id, selectedSlot.startsAt, randomUUID());
      } else {
        await createAppointment({
          careRelationshipId: selectedRelationship.id,
          modality: selectedModality,
          startsAt: selectedSlot.startsAt,
        }, randomUUID());
      }
      setIsScheduleOpen(false);
      setRescheduling(null);
      setSelectedSlot(null);
      setSlots([]);
      await loadAgenda();
    } catch (mutationError) {
      setSlotError(
        presentUserError(mutationError, 'No pudimos guardar la cita. El horario no fue reservado.')
      );
    } finally {
      setMutationId(null);
    }
  }, [loadAgenda, rescheduling, selectedModality, selectedRelationship, selectedSlot]);

  const runTransition = useCallback(async (
    appointment: Appointment,
    transition: AppointmentTransition,
    reason?: string
  ): Promise<boolean> => {
    setMutationId(appointment.id);
    setError(null);
    try {
      await transitionAppointment(appointment.id, transition, randomUUID(), reason);
      await loadAgenda();
      return true;
    } catch (mutationError) {
      setError(
        presentUserError(mutationError, 'No pudimos actualizar la cita. Inténtalo nuevamente.')
      );
      return false;
    } finally {
      setMutationId(null);
    }
  }, [loadAgenda]);

  const handlePrimaryAction = useCallback((
    appointment: Appointment,
    action: AppointmentAction
  ) => {
    if (action.type === 'reschedule') {
      openSchedule(appointment);
      return;
    }
    if (action.type === 'cancel') {
      setOptionsAppointment(appointment);
      return;
    }
    void runTransition(appointment, action.transition);
  }, [openSchedule, runTransition]);

  const handleOptionsReschedule = useCallback((appointment: Appointment) => {
    setOptionsAppointment(null);
    openSchedule(appointment);
  }, [openSchedule]);

  const handleCancel = useCallback(async (appointment: Appointment, reason: string) => {
    if (await runTransition(appointment, 'CANCEL', reason)) {
      setOptionsAppointment(null);
    }
  }, [runTransition]);

  return {
    relationships,
    policy,
    upcoming,
    history,
    isLoading,
    isRefreshing,
    error,
    reminderMessage,
    dismissReminder: () => setReminderMessage(null),
    refresh,
    openSchedule,
    handlePrimaryAction,
    optionsAppointment,
    setOptionsAppointment,
    handleOptionsReschedule,
    handleCancel,
    mutationId,
    schedule: {
      visible: isScheduleOpen,
      rescheduling,
      selectedRelationshipId,
      selectedModality,
      slots,
      selectedSlot,
      isLoadingSlots,
      isSubmitting: mutationId === (rescheduling?.id ?? 'create'),
      error: slotError,
      onSelectRelationship: chooseRelationship,
      onSelectModality: chooseModality,
      onSelectSlot: setSelectedSlot,
      onConfirm: confirmSelectedSlot,
      onClose: closeSchedule,
    },
  } as const;
}
