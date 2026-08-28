import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { DirectoryModality } from '../../models/Psychologist';
import { ProfessionalProfile, SpecialtyCatalogItem } from '../../models/ProfessionalProfile';
import {
  configureProfessionalModality,
  getOwnProfessionalProfile,
  getProfessionalCatalogs,
  getSpecialtyCatalog,
  replaceProfessionalAvailability,
  replaceProfessionalSpecialties,
  updateProfessionalBio,
} from '../../repositories/ProfessionalProfileRepository';
import { showAlert } from '../../utils/alert';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

export const VerificationScreen: React.FC = () => {
  const userProfile = useAuthStore((state) => state.userProfile);
  const signOut = useAuthStore((state) => state.signOut);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [specialties, setSpecialties] = useState<readonly SpecialtyCatalogItem[]>([]);
  const [modalities, setModalities] = useState<readonly DirectoryModality[]>([]);
  const [currencies, setCurrencies] = useState<readonly string[]>([]);
  const [bio, setBio] = useState('');
  const [specialtyCode, setSpecialtyCode] = useState('');
  const [modality, setModality] = useState<DirectoryModality | null>(null);
  const [currency, setCurrency] = useState('');
  const [price, setPrice] = useState('');
  const [weekday, setWeekday] = useState(new Date().getDay());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const rejected = userProfile?.psychologistVerificationStatus === 'REJECTED';
  const title = rejected ? 'Verificación no aprobada' : 'Verificación en proceso';
  const detail = rejected
    ? 'Tu solicitud necesita correcciones. El equipo de Ruta Emocional deberá indicarte qué documento debes actualizar.'
    : 'Estamos verificando tu licencia profesional. Mientras el proceso esté pendiente no podrás consultar pacientes, crear ofertas ni acceder a información clínica.';

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      getOwnProfessionalProfile(controller.signal),
      getSpecialtyCatalog(controller.signal),
      getProfessionalCatalogs(controller.signal),
    ])
      .then(([ownProfile, specialtyCatalog, catalogs]) => {
        setProfile(ownProfile);
        setBio(ownProfile.bio ?? '');
        setSpecialties(specialtyCatalog);
        setSpecialtyCode(ownProfile.specialties.find(({ isPrimary }) => isPrimary)?.code ?? '');
        setModalities(catalogs.modalities);
        setCurrencies(catalogs.currencies);
        const configuredModality = ownProfile.modalities[0];
        setModality(configuredModality?.code ?? catalogs.modalities[0] ?? null);
        setPrice(configuredModality?.pricePerHour.amount ?? '');
        setCurrency(configuredModality?.pricePerHour.currency ?? catalogs.currencies[0] ?? '');
        const rule = ownProfile.availability.weeklyRules[0];
        if (rule) {
          setWeekday(rule.weekday);
          setStartTime(rule.startTime);
          setEndTime(rule.endTime);
        }
      })
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        showAlert('No pudimos cargar tu expediente', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, []);

  const saveSection = async (operation: () => Promise<ProfessionalProfile>, successMessage: string) => {
    setIsSaving(true);
    try {
      const updated = await operation();
      setProfile(updated);
      showAlert('Cambios guardados', successMessage);
    } catch (error) {
      showAlert('No pudimos guardar los cambios', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.iconContainer, rejected && styles.rejectedIconContainer]}>
          <MaterialIcons
            name={rejected ? 'error-outline' : 'verified-user'}
            size={48}
            color={rejected ? Colors.error : Colors.primary}
          />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>

        <View style={styles.accountCard}>
          <Text style={styles.accountLabel}>Cuenta profesional</Text>
          <Text style={styles.accountName}>{userProfile?.displayName}</Text>
          <Text style={styles.accountEmail}>{userProfile?.email}</Text>
          {profile?.licenses.map((license) => (
            <View key={license.id} style={styles.licenseRow}>
              <Text style={styles.accountLabel}>{license.authority} · {license.number}</Text>
              <Text style={styles.licenseStatus}>
                {license.evidenceSubmitted ? 'Evidencia recibida' : 'Evidencia documental pendiente'}
              </Text>
              {license.latestPublicDecisionReason ? (
                <Text style={styles.decisionReason}>{license.latestPublicDecisionReason}</Text>
              ) : null}
            </View>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Presentación profesional</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Describe tu enfoque, experiencia y población atendida"
                multiline
                maxLength={3000}
              />
              <TouchableOpacity
                style={styles.saveButton}
                disabled={isSaving || bio.trim().length < 20}
                onPress={() => void saveSection(
                  () => updateProfessionalBio(bio.trim()),
                  'Tu presentación profesional fue actualizada.'
                )}
              >
                <Text style={styles.saveButtonText}>Guardar presentación</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Especialidad principal</Text>
              <View style={styles.chipGroup}>
                {specialties.map((specialty) => (
                  <TouchableOpacity
                    key={specialty.code}
                    style={[styles.chip, specialtyCode === specialty.code && styles.selectedChip]}
                    onPress={() => setSpecialtyCode(specialty.code)}
                  >
                    <Text style={specialtyCode === specialty.code ? styles.selectedChipText : styles.chipText}>
                      {specialty.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {specialties.length === 0 ? (
                <Text style={styles.helperText}>El catálogo aún no contiene especialidades activas.</Text>
              ) : null}
              <TouchableOpacity
                style={styles.saveButton}
                disabled={isSaving || !specialtyCode}
                onPress={() => void saveSection(
                  () => replaceProfessionalSpecialties([specialtyCode], specialtyCode),
                  'Tu especialidad principal fue actualizada.'
                )}
              >
                <Text style={styles.saveButtonText}>Guardar especialidad</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Modalidad y tarifa</Text>
              <View style={styles.chipGroup}>
                {modalities.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, modality === item && styles.selectedChip]}
                    onPress={() => setModality(item)}
                  >
                    <Text style={modality === item ? styles.selectedChipText : styles.chipText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="Tarifa por hora"
                  keyboardType="decimal-pad"
                />
                <View style={styles.currencyBox}>
                  <Text style={styles.currencyText}>{currency || currencies[0]}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.saveButton}
                disabled={isSaving || !modality || !currency || !price}
                onPress={() => modality && void saveSection(
                  () => configureProfessionalModality(modality, price.trim(), currency, true),
                  'Tu modalidad y tarifa fueron actualizadas.'
                )}
              >
                <Text style={styles.saveButtonText}>Guardar modalidad</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Disponibilidad semanal básica</Text>
              <Text style={styles.helperText}>Zona horaria: {timezone}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipGroup}>
                {WEEKDAYS.map((label, index) => (
                  <TouchableOpacity
                    key={label}
                    style={[styles.chip, weekday === index && styles.selectedChip]}
                    onPress={() => setWeekday(index)}
                  >
                    <Text style={weekday === index ? styles.selectedChipText : styles.chipText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.rowInputs}>
                <TextInput style={[styles.input, styles.flexInput]} value={startTime} onChangeText={setStartTime} placeholder="Inicio HH:mm" />
                <TextInput style={[styles.input, styles.flexInput]} value={endTime} onChangeText={setEndTime} placeholder="Fin HH:mm" />
              </View>
              <TouchableOpacity
                style={styles.saveButton}
                disabled={isSaving || !startTime || !endTime}
                onPress={() => void saveSection(
                  () => replaceProfessionalAvailability(timezone, [{ weekday, startTime, endTime, isActive: true }]),
                  'Tu disponibilidad semanal fue actualizada.'
                )}
              >
                <Text style={styles.saveButtonText}>Guardar disponibilidad</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.signOutButton, isSigningOut && styles.disabledButton]}
          onPress={handleSignOut}
          disabled={isSigningOut}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          {isSigningOut ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <>
              <MaterialIcons name="logout" size={19} color={Colors.textInverse} />
              <Text style={styles.signOutText}>Cerrar sesión</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFaded,
  },
  rejectedIconContainer: {
    backgroundColor: '#FDECEC',
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  detail: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 520,
    lineHeight: 23,
  },
  accountCard: {
    width: '100%',
    maxWidth: 460,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  accountLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  accountName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  accountEmail: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  licenseRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.xs,
  },
  licenseStatus: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  decisionReason: {
    ...Typography.bodySmall,
    color: Colors.error,
  },
  formCard: {
    width: '100%',
    maxWidth: 600,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  formTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  bioInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  selectedChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
  },
  selectedChipText: {
    ...Typography.bodySmall,
    color: Colors.textInverse,
    fontWeight: '700',
  },
  helperText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  flexInput: {
    flex: 1,
  },
  currencyBox: {
    minWidth: 76,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  currencyText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
  },
  saveButtonText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
  signOutButton: {
    minWidth: 190,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  disabledButton: {
    opacity: 0.6,
  },
  signOutText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
});
