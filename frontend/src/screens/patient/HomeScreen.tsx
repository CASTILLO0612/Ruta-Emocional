import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClipboardCheck, Calendar, ChevronRight } from 'lucide-react-native';

import { APP_LOCALE } from '../../config/localization';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
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

const appointmentScheduleFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

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
          <View style={styles.decisionSection}>
            <View style={styles.decisionHeader}>
              <View style={styles.decisionIconContainer}>
                <ClipboardCheck size={IconSize.action} color={Colors.primary} />
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
          <TouchableOpacity
            onPress={() => navigation.navigate('Appointments')}
            style={styles.appointmentSection}
            activeOpacity={0.76}
            accessibilityRole="button"
            accessibilityLabel={`Próxima cita con ${item.appointment.professionalName}`}
            accessibilityHint="Abre el detalle de la cita en Agenda"
          >
            <View style={styles.appointmentIconContainer}>
              <Calendar size={IconSize.action} color={Colors.primary} />
            </View>

            <View style={styles.appointmentCopy}>
              <Text style={[Typography.label, styles.appointmentLabel]}>
                Próxima cita
              </Text>
              <Text style={[Typography.h4, styles.appointmentTitle]}>
                {item.appointment.professionalName}
              </Text>
              <Text style={[Typography.bodySmall, styles.appointmentDetails]}>
                {item.appointment.modality} · {formatAppointmentSchedule(item.appointment.scheduledFor)}
              </Text>
            </View>

            <ChevronRight size={IconSize.action} color={Colors.textTertiary} />
          </TouchableOpacity>
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
              onAction={() => navigation.navigate('ProfessionalDirectory')}
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
  decisionSection: {
    paddingVertical: Spacing.base,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
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
  appointmentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: BorderRadius.lg,
  },
  appointmentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentCopy: {
    flex: 1,
    gap: Spacing.xxs,
  },
  appointmentLabel: {
    color: Colors.primary,
  },
  appointmentTitle: {
    color: Colors.textPrimary,
  },
  appointmentDetails: {
    color: Colors.textSecondary,
  },
  directoryContainer: {
    marginTop: Spacing.xs,
  },
  directoryList: {
    paddingHorizontal: Spacing.xs,
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

function formatAppointmentSchedule(date: Date): string {
  return appointmentScheduleFormatter.format(date);
}
