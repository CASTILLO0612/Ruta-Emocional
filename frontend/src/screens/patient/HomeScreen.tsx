/**
 * HomeScreen — Inicio del paciente (Refactor Visual 10/10).
 *
 * Principios rectores aplicados:
 * 1. Jerarquía dinámica guiada por prioritizeHomeSections.
 * 2. Una sola acción primaria visible («Buscar acompañamiento»).
 * 3. Máximo 2 profesionales en el preview del directorio.
 * 4. Ningún bloque vacío ocupa espacio en pantalla.
 * 5. MENTA se presenta como atajo contextual honesto, no como respuesta clínica simulada.
 * 6. Uso de FlatList en raíz (ScreenListContainer) sin ScrollView anidado.
 * 7. Eliminado el modal de formulario inline redundante.
 */
import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Sparkles, Calendar, ArrowRight } from 'lucide-react-native';

import { APP_LOCALE } from '../../config/localization';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { IconSize } from '../../theme/icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useRequestStore } from '../../store/useRequestStore';
import { usePsychologistStore } from '../../store/usePsychologistStore';

import { AppHeader } from '../../components/shared/AppHeader';
import { ScreenListContainer } from '../../components/shared/ScreenContainer';
import { SectionHeader } from '../../components/shared/SectionHeader';
import { PrimaryActionCard } from '../../components/shared/PrimaryActionCard';
import { ContextSuggestionCard } from '../../components/shared/ContextSuggestionCard';
import { ProfessionalCompactCard } from '../../components/shared/ProfessionalCompactCard';
import { AppButton } from '../../components/common/AppButton';
import { formatMoney } from '../../utils/money';
import { formatModalityLabel } from '../../utils/modality';
import { fetchAppointments } from '../../repositories/AppointmentRepository';
import {
  prioritizeHomeSections,
  HomeSection,
  HomeAppointment,
} from '../../utils/prioritizeHomeSections';
import type { PatientHomeNavigation } from '../../navigation/navigationTypes';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<PatientHomeNavigation>();
  const userProfile = useAuthStore((state) => state.userProfile);
  const activeRequest = useRequestStore((state) => state.activeRequest);
  const incomingOffers = useRequestStore((state) => state.incomingOffers);
  const [nextAppointment, setNextAppointment] = useState<HomeAppointment | null>(null);
  const [isLoadingAppointment, setIsLoadingAppointment] = useState(false);

  const {
    psychologists,
    isLoading: isLoadingPsychologists,
    fetchAvailablePsychologists,
  } = usePsychologistStore();

  useEffect(() => {
    const controller = new AbortController();
    void fetchAvailablePsychologists(controller.signal);
    return () => controller.abort();
  }, [fetchAvailablePsychologists]);

  const loadNextAppointment = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingAppointment(true);
    try {
      const response = await fetchAppointments('UPCOMING', undefined, signal);
      if (signal?.aborted) return;
      const next = [...response.data]
        .filter(({ status }) => ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(status))
        .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))[0];
      setNextAppointment(next ? {
        id: next.id,
        professionalName: next.counterpart.displayName,
        ...(next.counterpart.photoUrl ? { professionalPhotoURL: next.counterpart.photoUrl } : {}),
        scheduledFor: new Date(next.startsAt),
        modality: formatModalityLabel(next.modality),
      } : null);
    } catch (appointmentError) {
      if (signal?.aborted || (appointmentError instanceof Error && appointmentError.name === 'AbortError')) {
        return;
      }
      setNextAppointment(null);
    } finally {
      if (!signal?.aborted) setIsLoadingAppointment(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadNextAppointment(controller.signal);
    return () => controller.abort();
  }, [loadNextAppointment]);

  const handleRefresh = useCallback(() => {
    void Promise.allSettled([
      fetchAvailablePsychologists(),
      loadNextAppointment(),
    ]);
  }, [fetchAvailablePsychologists, loadNextAppointment]);

  // Generación dinámica de secciones según el estado real del store
  const sections = prioritizeHomeSections({
    userName: userProfile?.displayName,
    activeRequest,
    incomingOffers,
    nextAppointment,
    featuredPsychologists: psychologists,
  });

  const renderSection = ({ item }: { item: HomeSection }) => {
    switch (item.type) {
      case 'GREETING':
        return (
          <View style={styles.greetingContainer}>
            <Text style={[Typography.h2, styles.greetingTitle]}>
              {getGreeting()}, {getPreferredName(item.userName)}
            </Text>
          </View>
        );

      case 'PENDING_DECISION':
        return (
          <View style={styles.decisionCard}>
            <View style={styles.decisionHeader}>
              <View style={styles.decisionIconContainer}>
                <Sparkles size={IconSize.action} color={Colors.primary} />
              </View>
              <View style={styles.decisionTextContainer}>
                <Text style={[Typography.h4, styles.decisionTitle]}>
                  Oferta esperando tu respuesta
                </Text>
                <Text style={[Typography.bodySmall, styles.decisionSubtitle]}>
                  {item.topOffer
                    ? `${item.topOffer.psychologistName} envió una propuesta por ${formatMoney(item.topOffer.amount, item.topOffer.currencyCode)}`
                    : `Tienes ${item.offerCount} oferta(s) para tu solicitud`}
                </Text>
              </View>
            </View>
            <AppButton
              label={item.offerCount > 1 ? `Ver todas las ofertas (${item.offerCount})` : 'Revisar oferta'}
              onPress={() => navigation.navigate('Radar')}
              variant="primary"
              size="md"
              fullWidth
              accessibilityLabel="Revisar oferta recibida"
            />
          </View>
        );

      case 'NEXT_APPOINTMENT':
        return (
          <View style={styles.appointmentCard}>
            <View style={styles.appointmentHeader}>
              <Calendar size={IconSize.action} color={Colors.primary} />
              <Text style={[Typography.h4, styles.appointmentTitle]}>
                Próxima cita
              </Text>
            </View>
            <Text style={[Typography.body, styles.appointmentDetails]}>
              {item.appointment.professionalName} · {item.appointment.modality}
            </Text>
            <Text style={styles.appointmentTime}>
              {new Intl.DateTimeFormat(APP_LOCALE, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              }).format(item.appointment.scheduledFor)}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Appointments')}
              style={styles.appointmentAction}
            >
              <Text style={[Typography.button, styles.appointmentActionText]}>
                Ver detalles en Agenda
              </Text>
              <ArrowRight size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        );

      case 'PRIMARY_ACTION':
        return (
          <PrimaryActionCard
            onStartSearch={() => navigation.navigate('Search')}
          />
        );

      case 'MENTA_SUGGESTION':
        return (
          <ContextSuggestionCard
            text={item.text}
            onAction={() => {
              if (item.targetRoute === 'Radar') {
                navigation.navigate('Radar');
              } else if (item.targetRoute === 'Appointments') {
                navigation.navigate('Appointments');
              } else if (item.targetRoute === 'MentaAgent') {
                navigation.navigate('MentaAgent');
              } else {
                navigation.navigate('Search');
              }
            }}
          />
        );

      case 'DIRECTORY_PREVIEW':
        return (
          <View style={styles.directoryContainer}>
            <SectionHeader
              title="Profesionales"
              actionLabel="Ver todos"
              onAction={() => navigation.navigate('Search')}
            />
            <View style={styles.directoryList}>
              {item.professionals.map((psychologist, index) => (
                <ProfessionalCompactCard
                  key={psychologist.id}
                  psychologist={psychologist}
                  isLast={index === item.professionals.length - 1}
                  onPress={() =>
                    navigation.navigate('PsychologistProfile', {
                      psychologistId: psychologist.id,
                    })
                  }
                />
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader showBrand showMenta showInbox />
      <ScreenListContainer edges={['bottom', 'left', 'right']}>
        <FlatList
          data={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderSection}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingPsychologists || isLoadingAppointment}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        />
      </ScreenListContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  greetingContainer: {
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  greetingTitle: {
    color: Colors.textPrimary,
  },
  decisionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadow.sm,
  },
  decisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  decisionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionTextContainer: {
    flex: 1,
  },
  decisionTitle: {
    color: Colors.textPrimary,
  },
  decisionSubtitle: {
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  appointmentCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  appointmentTitle: {
    color: Colors.textPrimary,
  },
  appointmentDetails: {
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  appointmentTime: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  appointmentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  appointmentActionText: {
    color: Colors.primary,
    fontSize: 14,
  },
  directoryContainer: {
    marginTop: Spacing.xs,
  },
  directoryList: {
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
  },
});

function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getPreferredName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || 'Paciente';
}
