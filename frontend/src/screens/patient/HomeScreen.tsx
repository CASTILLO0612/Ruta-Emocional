import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  ScrollView,
  Modal,
  Platform,
  StatusBar,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  HeartHandshake,
  LockKeyhole,
  RefreshCw,
  Route,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  X,
  Zap,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { FontFamily, Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { MotionDuration } from '../../theme/motion';
import { AppButton } from '../../components/common/AppButton';
import { ModalitySelector } from '../../components/patient/ModalitySelector';
import { BudgetInput } from '../../components/patient/BudgetInput';
import { StarRating } from '../../components/common/StarRating';
import { Modality } from '../../models/Psychologist';
import { useRequestStore } from '../../store/useRequestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { usePsychologistStore } from '../../store/usePsychologistStore';
import { showAlert } from '../../utils/alert';
import type { PatientHomeNavigation } from '../../navigation/navigationTypes';
import {
  getServiceRequestPolicy,
  ServiceRequestPolicy,
} from '../../repositories/RequestRepository';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

interface CalendarDay {
  readonly id: string;
  readonly date: Date | null;
  readonly dayNumber: number | null;
  readonly disabled: boolean;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function createCalendarDays(month: Date, maximumDate?: Date): CalendarDay[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDayIndex = new Date(year, monthIndex, 1).getDay();
  const emptySpaces = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const numberOfDays = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const maximumDay = maximumDate
    ? new Date(maximumDate.getFullYear(), maximumDate.getMonth(), maximumDate.getDate())
    : null;
  const days: CalendarDay[] = Array.from({ length: emptySpaces }, (_, index) => ({
    id: `empty-${year}-${monthIndex}-${index}`,
    date: null,
    dayNumber: null,
    disabled: true,
  }));

  for (let dayNumber = 1; dayNumber <= numberOfDays; dayNumber += 1) {
    const date = new Date(year, monthIndex, dayNumber);
    days.push({
      id: `day-${year}-${monthIndex}-${dayNumber}`,
      date,
      dayNumber,
      disabled: date < todayStart || Boolean(maximumDay && date > maximumDay),
    });
  }
  return days;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<PatientHomeNavigation>();
  const { userProfile } = useAuthStore();
  const { createSessionRequest, isLoading, error, clearError } = useRequestStore();
  const {
    psychologists,
    isLoading: isDirectoryLoading,
    error: directoryError,
    fetchAvailablePsychologists,
  } = usePsychologistStore();

  const [modality, setModality] = useState<Modality>('chat');
  const [budget, setBudget] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestPolicy, setRequestPolicy] = useState<ServiceRequestPolicy | null>(null);

  const [isScheduleLater, setIsScheduleLater] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [showCalendarGrid, setShowCalendarGrid] = useState(false);
  const [schedTime, setSchedTime] = useState('15:00');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const maximumScheduleDate = requestPolicy
    ? new Date(Date.now() + requestPolicy.maximumScheduleDays * 86_400_000)
    : undefined;
  const calendarDays = createCalendarDays(calendarMonth, maximumScheduleDate);
  const currentMonthLabel = MONTH_NAMES[calendarMonth.getMonth()];
  const selectedFormattedDayLabel = `${selectedDate.getDate()} de ${MONTH_NAMES[selectedDate.getMonth()]}`;
  const currentMonthStart = startOfMonth(new Date());
  const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  const canGoToPreviousMonth = calendarMonth.getTime() > currentMonthStart.getTime();
  const canGoToNextMonth = !maximumScheduleDate || nextMonth <= maximumScheduleDate;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: MotionDuration.normal,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    const controller = new AbortController();
    void fetchAvailablePsychologists(controller.signal);
    void getServiceRequestPolicy(controller.signal)
      .then((policy) => {
        setRequestPolicy(policy);
        setBudget((current) => {
          const minimum = Number(policy.minimumAmount);
          const maximum = Number(policy.maximumAmount);
          return current >= minimum && current <= maximum ? current : minimum;
        });
      })
      .catch((policyError) => {
        if (policyError instanceof Error && policyError.name === 'AbortError') return;
        showAlert('Configuración no disponible', 'No pudimos cargar las reglas de solicitudes.');
      });

    return () => {
      controller.abort();
    };
  }, [fetchAvailablePsychologists]);

  useEffect(() => {
    if (error) {
      showAlert('Error', error);
      clearError();
    }
  }, [error]);

  const handleRequest = async () => {
    if (!userProfile) {
      showAlert('Sesión requerida', 'Por favor inicia sesión primero.');
      return;
    }
    if (!requestPolicy) {
      showAlert('Espera un momento', 'Las reglas de solicitudes todavía se están cargando.');
      return;
    }

    const minimumAmount = Number(requestPolicy.minimumAmount);
    const maximumAmount = Number(requestPolicy.maximumAmount);
    const currencyCode = requestPolicy.supportedCurrencies[0];
    if (!currencyCode) {
      showAlert('Configuración inválida', 'No existe una moneda habilitada para solicitudes.');
      return;
    }
    if (!Number.isFinite(budget) || budget < minimumAmount || budget > maximumAmount) {
      showAlert(
        'Presupuesto fuera de rango',
        `El monto debe estar entre ${currencyCode} ${requestPolicy.minimumAmount} y ${currencyCode} ${requestPolicy.maximumAmount}.`
      );
      return;
    }

    let scheduledFor: Date | undefined;
    if (isScheduleLater) {
      const timeMatch = /^(\d{2}):(\d{2})$/.exec(schedTime.trim());
      if (!timeMatch) {
        showAlert('Hora inválida', 'Usa el formato de 24 horas HH:mm, por ejemplo 15:30.');
        return;
      }
      const hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      if (hours > 23 || minutes > 59) {
        showAlert('Hora inválida', 'La hora seleccionada no es válida.');
        return;
      }
      scheduledFor = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        hours,
        minutes
      );
      const earliest = Date.now() + requestPolicy.scheduledLeadMinutes * 60_000;
      const latest = Date.now() + requestPolicy.maximumScheduleDays * 86_400_000;
      if (scheduledFor.getTime() < earliest || scheduledFor.getTime() > latest) {
        showAlert(
          'Fecha fuera de rango',
          `Programa la sesión con al menos ${requestPolicy.scheduledLeadMinutes} minutos de anticipación y dentro de los próximos ${requestPolicy.maximumScheduleDays} días.`
        );
        return;
      }
    }

    try {
      await createSessionRequest({
        modality,
        proposedBudget: budget,
        currencyCode,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(scheduledFor ? { scheduledFor } : {}),
      });

      setShowRequestModal(false);
      navigation.navigate('Radar');
    } catch {
      return;
    }
  };

  const firstName = userProfile?.displayName?.split(' ')[0] ?? 'ahí';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      <SafeAreaView style={styles.appBarWrapper}>
        <View style={styles.appBar}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Route size={18} strokeWidth={IconStroke.emphasized} color={Colors.accent} />
            </View>
            <Text style={styles.appName}>Ruta Emocional</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.profileBtn}
            accessibilityLabel="Mi perfil"
          >
            <UserRound size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
      >
        <View style={styles.greetSection}>
          <Text style={styles.greeting}>{getGreeting()}, {firstName}.</Text>
          <Text style={styles.greetingSub}>
            ¿Cómo te gustaría recibir apoyo hoy?
          </Text>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => setShowRequestModal(true)}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconBg}>
              <HeartHandshake size={28} strokeWidth={IconStroke.regular} color={Colors.textInverse} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Buscar acompañamiento</Text>
              <Text style={styles.actionDesc}>
                Define lo que necesitas y encuentra profesionales disponibles
              </Text>
            </View>
            <ChevronRight
              size={IconSize.navigation}
              strokeWidth={IconStroke.regular}
              color={Colors.textOnBrandMuted}
            />
          </TouchableOpacity>

        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Psicólogos disponibles</Text>
          <View style={styles.livePill}>
            <BadgeCheck size={IconSize.inline} strokeWidth={IconStroke.emphasized} color={Colors.accentDark} />
            <Text style={styles.liveText}>Verificados</Text>
          </View>
        </View>

        {psychologists.length > 0 ? (
          <FlatList
            data={psychologists}
            keyExtractor={(p) => p.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.psychList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.psychCard}
                onPress={() => navigation.navigate('PsychologistProfile', { psychologistId: item.id })}
                activeOpacity={0.85}
              >
                <View style={styles.psychAvatarWrapper}>
                  {item.photoURL ? (
                    <Image source={{ uri: item.photoURL }} style={styles.psychAvatar} />
                  ) : (
                    <View style={styles.psychAvatarFallback}>
                      <UserRound size={IconSize.navigation} strokeWidth={IconStroke.regular} color={Colors.primary} />
                    </View>
                  )}
                </View>
                <Text style={styles.psychName} numberOfLines={2}>
                  {item.displayName}
                </Text>
                <Text style={styles.psychSpecialty} numberOfLines={1}>
                  {item.specialty}
                </Text>
                <StarRating rating={item.rating} size={11} showValue />
                <Text style={styles.psychPrice}>
                  {item.currencyCode} {item.pricePerHour}/hr
                </Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <TouchableOpacity
            style={styles.emptyPsych}
            onPress={() => void fetchAvailablePsychologists()}
            disabled={isDirectoryLoading}
            accessibilityRole="button"
            accessibilityLabel="Volver a cargar el directorio"
          >
            {isDirectoryLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              directoryError ? (
                <RefreshCw size={IconSize.state} strokeWidth={IconStroke.regular} color={Colors.textDisabled} />
              ) : (
                <Search size={IconSize.state} strokeWidth={IconStroke.regular} color={Colors.textDisabled} />
              )
            )}
            <Text style={styles.emptyText}>
              {isDirectoryLoading
                ? 'Cargando profesionales verificados...'
                : directoryError
                  ? 'No pudimos cargar el directorio. Toca para reintentar.'
                  : 'Aún no hay profesionales disponibles con estos criterios.'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoRow}>
          <View style={styles.infoChip}>
            <LockKeyhole size={IconSize.inline} strokeWidth={IconStroke.regular} color={Colors.primary} />
            <Text style={styles.infoChipText}>Directorio protegido</Text>
          </View>
          <View style={styles.infoChip}>
            <ShieldCheck size={IconSize.inline} strokeWidth={IconStroke.regular} color={Colors.primary} />
            <Text style={styles.infoChipText}>Sin datos de contacto públicos</Text>
          </View>
        </View>
      </Animated.ScrollView>

      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowRequestModal(false)}
              >
                <X size={IconSize.navigation} strokeWidth={IconStroke.regular} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Nueva solicitud</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <ModalitySelector selected={modality} onSelect={setModality} />

              <View style={styles.gap} />

              {requestPolicy ? (
                <BudgetInput
                  value={budget}
                  onChange={setBudget}
                  currencyCode={requestPolicy.supportedCurrencies[0]}
                  minimumAmount={Number(requestPolicy.minimumAmount)}
                  maximumAmount={Number(requestPolicy.maximumAmount)}
                />
              ) : (
                <ActivityIndicator color={Colors.primary} />
              )}

              <View style={styles.gap} />

              <Text style={styles.fieldLabel}>¿CUÁNDO DESEAS TU SESIÓN?</Text>
              <View style={styles.timeSelectorRow}>
                <TouchableOpacity
                  style={[styles.timeOption, !isScheduleLater && styles.timeOptionActive]}
                  onPress={() => setIsScheduleLater(false)}
                  activeOpacity={0.8}
                >
                  <Zap size={IconSize.inline} strokeWidth={IconStroke.regular} color={!isScheduleLater ? Colors.textInverse : Colors.primary} />
                  <Text style={[styles.timeOptionText, !isScheduleLater && styles.timeOptionTextActive]}>Ahora mismo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.timeOption, isScheduleLater && styles.timeOptionActive]}
                  onPress={() => setIsScheduleLater(true)}
                  activeOpacity={0.8}
                >
                  <Clock3 size={IconSize.inline} strokeWidth={IconStroke.regular} color={isScheduleLater ? Colors.textInverse : Colors.primary} />
                  <Text style={[styles.timeOptionText, isScheduleLater && styles.timeOptionTextActive]}>Programar</Text>
                </TouchableOpacity>
              </View>

              {isScheduleLater && (
                <View style={styles.scheduleWrapper}>
                  <Text style={styles.fieldSubLabel}>Fecha de Sesión</Text>
                  <TouchableOpacity
                    style={styles.calendarTrigger}
                    onPress={() => setShowCalendarGrid(!showCalendarGrid)}
                    activeOpacity={0.85}
                  >
                    <CalendarDays size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
                    <Text style={styles.calendarTriggerText}>
                      {selectedFormattedDayLabel}
                    </Text>
                    {showCalendarGrid ? (
                      <ChevronUp size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textSecondary} />
                    ) : (
                      <ChevronDown size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {showCalendarGrid && (
                    <View style={styles.calendarCard}>
                      <View style={styles.calendarMonthRow}>
                        <TouchableOpacity
                          disabled={!canGoToPreviousMonth}
                          onPress={() => setCalendarMonth(
                            new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                          )}
                          accessibilityLabel="Mes anterior"
                        >
                          <ChevronLeft
                            size={IconSize.navigation}
                            strokeWidth={IconStroke.regular}
                            color={canGoToPreviousMonth ? Colors.primary : Colors.textDisabled}
                          />
                        </TouchableOpacity>
                        <Text style={styles.calendarMonthHeader}>
                          {currentMonthLabel} {calendarMonth.getFullYear()}
                        </Text>
                        <TouchableOpacity
                          disabled={!canGoToNextMonth}
                          onPress={() => setCalendarMonth(nextMonth)}
                          accessibilityLabel="Mes siguiente"
                        >
                          <ChevronRight
                            size={IconSize.navigation}
                            strokeWidth={IconStroke.regular}
                            color={canGoToNextMonth ? Colors.primary : Colors.textDisabled}
                          />
                        </TouchableOpacity>
                      </View>
                      
                      <View style={styles.calendarWeekdays}>
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
                          <Text key={idx} style={styles.weekdayLabel}>{day}</Text>
                        ))}
                      </View>

                      <View style={styles.calendarGrid}>
                        {calendarDays.map((day, idx) => {
                          const isSelected = Boolean(
                            day.date && day.date.toDateString() === selectedDate.toDateString()
                          );

                          return (
                            <TouchableOpacity
                              key={day.id || idx}
                              style={[
                                styles.calendarDayCell,
                                isSelected && styles.calendarDayCellActive,
                                day.disabled && styles.calendarDayCellDisabled,
                              ]}
                              disabled={day.disabled}
                              onPress={() => {
                                if (day.date) {
                                  setSelectedDate(day.date);
                                  setShowCalendarGrid(false);
                                }
                              }}
                            >
                              <Text style={[
                                styles.calendarDayText,
                                isSelected && styles.calendarDayTextActive,
                                day.disabled && styles.calendarDayTextDisabled,
                              ]}>
                                {day.dayNumber || ''}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  <View style={{ marginTop: Spacing.md }}>
                    <Text style={styles.fieldSubLabel}>Hora de Inicio</Text>
                    <TextInput
                      style={styles.scheduleInput}
                      value={schedTime}
                      onChangeText={setSchedTime}
                      placeholder="Ej: 15:30"
                      placeholderTextColor={Colors.textDisabled}
                    />
                  </View>
                </View>
              )}

              <View style={styles.gap} />

              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>DESCRIPCIÓN (OPCIONAL)</Text>
                <Text style={styles.charCounter}>
                  {description.length}/{requestPolicy?.maximumDescriptionLength ?? 0}
                </Text>
              </View>
              <View style={styles.textAreaWrapper}>
                <TextInput
                  style={styles.textArea}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="¿Cómo te sientes hoy?"
                  placeholderTextColor={Colors.textDisabled}
                  multiline
                  maxLength={requestPolicy?.maximumDescriptionLength}
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.gap} />

              <AppButton
                label="Publicar solicitud"
                onPress={handleRequest}
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                disabled={!requestPolicy}
                icon={<Send size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textInverse} />}
              />

              <Text style={styles.disclaimer}>
                <LockKeyhole size={IconSize.inline} strokeWidth={IconStroke.regular} color={Colors.textTertiary} />
                {'  '}Revisa los detalles antes de publicar tu solicitud
              </Text>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  appBarWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  logoMark: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    ...Typography.h4,
    fontFamily: FontFamily.brandBold,
    color: Colors.textPrimary,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xxxl,
  },
  greetSection: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: 4,
  },
  greeting: {
    ...Typography.h1,
    color: Colors.textPrimary,
  },
  greetingSub: {
    ...Typography.body,
    color: Colors.textSecondary,
  },

  quickActions: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  actionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.surfaceOnBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    gap: 3,
  },
  actionTitle: {
    ...Typography.h4,
    fontFamily: FontFamily.bodyBold,
    color: Colors.textInverse,
  },
  actionDesc: {
    ...Typography.bodySmall,
    color: Colors.textOnBrandMuted,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  liveText: {
    ...Typography.caption,
    fontFamily: FontFamily.bodyBold,
    color: Colors.accentDark,
  },

  psychList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  psychCard: {
    width: 140,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  psychAvatarWrapper: {
    alignSelf: 'center',
    marginBottom: Spacing.xs,
    position: 'relative',
  },
  psychAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  psychAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  psychName: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  psychSpecialty: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  psychPrice: {
    ...Typography.caption,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
    textAlign: 'center',
  },
  emptyPsych: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  infoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  infoChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: 'transparent',
    paddingVertical: Spacing.sm,
  },
  infoChipText: {
    ...Typography.caption,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.textSecondary,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    maxHeight: '88%',
    ...Shadow.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  modalBody: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  gap: {
    height: Spacing.lg,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.overline,
    color: Colors.textTertiary,
  },
  charCounter: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  fieldSubLabel: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: Spacing.sm,
  },
  textAreaWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  textArea: {
    ...Typography.body,
    color: Colors.textPrimary,
    minHeight: 72,
  },
  disclaimer: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.base,
  },

  timeSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  timeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 48,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  timeOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timeOptionText: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.primary,
  },
  timeOptionTextActive: {
    color: Colors.textInverse,
  },
  scheduleWrapper: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  scheduleInput: {
    minHeight: 52,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    color: Colors.textPrimary,
  },

  calendarTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  calendarTriggerText: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
  },

  calendarCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.xs,
    ...Shadow.sm,
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  calendarMonthHeader: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.bodyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.xs,
  },
  weekdayLabel: {
    width: 32,
    textAlign: 'center',
    ...Typography.caption,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textSecondary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 4,
  },
  calendarDayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  calendarDayCellActive: {
    backgroundColor: Colors.primary,
  },
  calendarDayCellDisabled: {
    opacity: 0.25,
  },
  calendarDayText: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textPrimary,
  },
  calendarDayTextActive: {
    color: Colors.textInverse,
  },
  calendarDayTextDisabled: {
    color: Colors.textDisabled,
    textDecorationLine: 'line-through',
  },
});
