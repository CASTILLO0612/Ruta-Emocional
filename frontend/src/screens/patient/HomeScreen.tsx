import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
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
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
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
      duration: 500,
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
              <MaterialIcons name="favorite" size={16} color={Colors.accent} />
            </View>
            <Text style={styles.appName}>Ruta Emocional</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.profileBtn}
            accessibilityLabel="Mi perfil"
          >
            <MaterialIcons name="person-outline" size={20} color={Colors.primary} />
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
              <MaterialIcons name="gavel" size={28} color={Colors.textInverse} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Solicitar Terapia</Text>
              <Text style={styles.actionDesc}>
                Propón tu presupuesto y consulta las ofertas disponibles
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => navigation.navigate('Menta')}
            activeOpacity={0.85}
          >
            <View style={styles.mentaIconBg}>
              <MaterialIcons name="psychology" size={22} color={Colors.primary} />
            </View>
            <View style={styles.actionText}>
              <View style={styles.mentaBadgeRow}>
                <Text style={styles.mentaActionTitle}>Hablar con MENTA</Text>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>IA</Text>
                </View>
              </View>
              <Text style={styles.mentaActionDesc}>
                Cuéntame cómo te sientes y te orientaré
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={Colors.textDisabled} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Psicólogos disponibles</Text>
          <View style={styles.livePill}>
            <MaterialIcons name="verified" size={13} color={Colors.accentDark} />
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
                      <MaterialIcons name="person" size={24} color={Colors.primary} />
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
              <MaterialIcons
                name={directoryError ? 'refresh' : 'search'}
                size={32}
                color={Colors.textDisabled}
              />
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
            <MaterialIcons name="lock" size={14} color={Colors.primary} />
            <Text style={styles.infoChipText}>Directorio protegido</Text>
          </View>
          <View style={styles.infoChip}>
            <MaterialIcons name="privacy-tip" size={14} color={Colors.primary} />
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
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
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
                  <MaterialIcons name="flash-on" size={16} color={!isScheduleLater ? Colors.textInverse : Colors.primary} />
                  <Text style={[styles.timeOptionText, !isScheduleLater && styles.timeOptionTextActive]}>Ahora mismo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.timeOption, isScheduleLater && styles.timeOptionActive]}
                  onPress={() => setIsScheduleLater(true)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="schedule" size={16} color={isScheduleLater ? Colors.textInverse : Colors.primary} />
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
                    <MaterialIcons name="calendar-today" size={18} color={Colors.primary} />
                    <Text style={styles.calendarTriggerText}>
                      {selectedFormattedDayLabel}
                    </Text>
                    <MaterialIcons 
                      name={showCalendarGrid ? 'expand-less' : 'expand-more'} 
                      size={20} 
                      color={Colors.textSecondary} 
                    />
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
                          <MaterialIcons
                            name="chevron-left"
                            size={22}
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
                          <MaterialIcons
                            name="chevron-right"
                            size={22}
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
                icon={<MaterialIcons name="send" size={18} color={Colors.primary} />}
              />

              <Text style={styles.disclaimer}>
                <MaterialIcons name="lock-outline" size={12} color={Colors.textTertiary} />
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
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
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
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  actionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    gap: 3,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  actionDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mentaIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  mentaActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  aiBadge: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  mentaActionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
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
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accentDark,
  },

  psychList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  psychCard: {
    width: 140,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
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
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
  },
  psychSpecialty: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  psychPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
  },
  emptyPsych: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textDisabled,
  },

  infoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
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
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,36,99,0.25)',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
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
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: Spacing.sm,
  },
  textAreaWrapper: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  textArea: {
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 72,
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.textDisabled,
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
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  timeOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timeOptionText: {
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    color: Colors.textPrimary,
  },

  calendarTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  calendarTriggerText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
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
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 11,
    fontWeight: '600',
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
    fontSize: 13,
    fontWeight: '600',
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
