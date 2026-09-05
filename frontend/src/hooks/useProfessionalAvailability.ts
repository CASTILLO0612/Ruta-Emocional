import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

import { getDeviceTimeZone } from '../config/localization';
import type { ProfessionalProfile, WeeklyAvailabilityRule } from '../models/ProfessionalProfile';
import {
  getOwnProfessionalProfile,
  replaceProfessionalAvailability,
} from '../repositories/ProfessionalProfileRepository';
import { presentUserError } from '../utils/userFacingError';

export function useProfessionalAvailability(enabled: boolean) {
  const loadGenerationRef = useRef(0);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    const requestGeneration = ++loadGenerationRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const nextProfile = await getOwnProfessionalProfile(signal);
      if (!signal?.aborted && requestGeneration === loadGenerationRef.current) {
        setProfile(nextProfile);
      }
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === 'AbortError') return;
      if (requestGeneration !== loadGenerationRef.current) return;
      setError(
        presentUserError(loadError, 'No pudimos cargar tu disponibilidad. Inténtalo nuevamente.')
      );
    } finally {
      if (!signal?.aborted && requestGeneration === loadGenerationRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      loadGenerationRef.current += 1;
      controller.abort();
    };
  }, [load]));

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const save = useCallback(async (rules: readonly WeeklyAvailabilityRule[]) => {
    if (!profile) return;
    setIsSaving(true);
    setMutationError(null);
    try {
      const updated = await replaceProfessionalAvailability(
        profile.availability.timezone ?? getDeviceTimeZone(),
        rules
      );
      setProfile(updated);
      setIsSheetOpen(false);
    } catch (saveError) {
      setMutationError(
        presentUserError(saveError, 'No pudimos guardar tu disponibilidad. Inténtalo nuevamente.')
      );
    } finally {
      setIsSaving(false);
    }
  }, [profile]);

  const openEditor = useCallback(() => {
    setMutationError(null);
    setIsSheetOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    if (!isSaving) setIsSheetOpen(false);
  }, [isSaving]);

  return {
    profile,
    timezone: profile?.availability.timezone ?? getDeviceTimeZone(),
    isLoading,
    isRefreshing,
    isSaving,
    isSheetOpen,
    error,
    mutationError,
    load,
    refresh,
    save,
    openEditor,
    closeEditor,
  } as const;
}
