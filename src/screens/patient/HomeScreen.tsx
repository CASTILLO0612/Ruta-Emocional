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
import { Modality, Psychologist } from '../../models/Psychologist';
import { useRequestStore } from '../../store/useRequestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getAvailablePsychologists } from '../../repositories/PsychologistRepository';
import { showAlert } from '../../utils/alert';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { userProfile } = useAuthStore();
  const { createSessionRequest, isLoading, error, clearError } = useRequestStore();

  const [modality, setModality] = useState<Modality>('chat');
  const [budget, setBudget] = useState<number>(350);
  const [description, setDescription] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);

  const [isScheduleLater, setIsScheduleLater] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [showCalendarGrid, setShowCalendarGrid] = useState(false);
  const [schedTime, setSchedTime] = useState('15:00');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const getDaysInMonth = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthLabel = monthNames[month];

    const firstDayIndex = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();

    const emptySpaces = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    
    const days = [];
    for (let i = 0; i < emptySpaces; i++) {
      days.push({ id: `empty-${i}`, dayNum: null, isPast: true });
    }

    const todayNum = new Date().getDate();

    for (let d = 1; d <= numDays; d++) {
      days.push({
        id: `day-${d}`,
        dayNum: d,
        isPast: d < todayNum,
        formattedLabel: `${d} de ${monthLabel}`
      });
    }

    return { days, monthLabel, year };
  };

  const { days: calendarDays, monthLabel: currentMonthLabel } = getDaysInMonth();
  const selectedFormattedDayLabel = `${selectedDay} de ${currentMonthLabel}`;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    getAvailablePsychologists()
      .then(setPsychologists)
      .catch(() => {});
  }, []);

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
    if (budget < 100) {
      showAlert('Presupuesto muy bajo', 'El presupuesto mínimo es C$100.');
      return;
    }

    try {
      const timeString = isScheduleLater ? `${selectedFormattedDayLabel} a las ${schedTime}` : 'Inmediata (Ahora)';
      const requestDescription = description.trim() 
        ? `${description.trim()}\n\n[Horario: ${timeString}]` 
        : `Solicitud de sesión. [Horario: ${timeString}]`;

      await createSessionRequest({
        patientId: userProfile.id,
        patientName: userProfile.displayName,
        patientPhotoURL: userProfile.photoURL,
        modality,
        proposedBudget: budget,
        description: requestDescription,
      });

      setShowRequestModal(false);
      navigation.navigate('Radar');
    } catch {
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
                Propón tu presupuesto y recibe ofertas en minutos
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
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>En línea</Text>
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
                onPress={() => {
                  const { createdAt, ...serializablePsy } = item as any;
                  navigation.navigate('PsychologistProfile', { psychologist: serializablePsy });
                }}
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
                  <View style={styles.onlineBadge} />
                </View>
                <Text style={styles.psychName} numberOfLines={2}>
                  {item.displayName}
                </Text>
                <Text style={styles.psychSpecialty} numberOfLines={1}>
                  {item.specialty}
                </Text>
                <StarRating rating={item.rating} size={11} showValue />
                <Text style={styles.psychPrice}>C${item.pricePerHour}/hr</Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={styles.emptyPsych}>
            <MaterialIcons name="search" size={32} color={Colors.textDisabled} />
            <Text style={styles.emptyText}>Cargando psicólogos...</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <View style={styles.infoChip}>
            <MaterialIcons name="lock" size={14} color={Colors.primary} />
            <Text style={styles.infoChipText}>100% confidencial</Text>
          </View>
          <View style={styles.infoChip}>
            <MaterialIcons name="flash-on" size={14} color={Colors.primary} />
            <Text style={styles.infoChipText}>Respuesta en minutos</Text>
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

              <BudgetInput value={budget} onChange={setBudget} />

              <View style={styles.gap} />

              <Text style={styles.fieldLabel}>¿Cuándo deseas tu sesión?</Text>
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
                      <Text style={styles.calendarMonthHeader}>{currentMonthLabel} 2026</Text>
                      
                      <View style={styles.calendarWeekdays}>
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
                          <Text key={idx} style={styles.weekdayLabel}>{day}</Text>
                        ))}
                      </View>

                      <View style={styles.calendarGrid}>
                        {calendarDays.map((day, idx) => {
                          const isSelected = day.dayNum === selectedDay;
                          const isDisabled = day.isPast || day.dayNum === null;

                          return (
                            <TouchableOpacity
                              key={day.id || idx}
                              style={[
                                styles.calendarDayCell,
                                isSelected && styles.calendarDayCellActive,
                                isDisabled && styles.calendarDayCellDisabled,
                              ]}
                              disabled={isDisabled}
                              onPress={() => {
                                if (day.dayNum) {
                                  setSelectedDay(day.dayNum);
                                  setShowCalendarGrid(false);
                                }
                              }}
                            >
                              <Text style={[
                                styles.calendarDayText,
                                isSelected && styles.calendarDayTextActive,
                                isDisabled && styles.calendarDayTextDisabled,
                              ]}>
                                {day.dayNum || ''}
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

              <Text style={styles.fieldLabel}>Descripción (opcional)</Text>
              <View style={styles.textAreaWrapper}>
                <TextInput
                  style={styles.textArea}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="¿Cómo te sientes hoy?"
                  placeholderTextColor={Colors.textDisabled}
                  multiline
                  maxLength={200}
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
                icon={<MaterialIcons name="search" size={20} color={Colors.primary} />}
              />

              <Text style={styles.disclaimer}>
                Sesión cifrada y confidencial
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
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
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
    backgroundColor: '#39D35315',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
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
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.background,
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
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
  calendarMonthHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    textTransform: 'capitalize',
    marginBottom: Spacing.sm,
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
