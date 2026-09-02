import React, { useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
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
import {
  EvidenceUploadPolicy,
  ProfessionalProfile,
  SpecialtyCatalogItem,
} from '../../models/ProfessionalProfile';
import {
  configureProfessionalModality,
  getEvidenceUploadPolicy,
  getOwnProfessionalProfile,
  getProfessionalCatalogs,
  getSpecialtyCatalog,
  replaceProfessionalAvailability,
  replaceProfessionalSpecialties,
  updateProfessionalBio,
  uploadLocalQaEvidence,
} from '../../repositories/ProfessionalProfileRepository';
import { showAlert } from '../../utils/alert';
import { subscribeToPsychologistVerificationUpdates } from '../../services/socketClient';
import { ApiError } from '../../services/apiClient';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;
const PROFESSIONAL_BIO_MIN_LENGTH = 20;
const PROFESSIONAL_BIO_MAX_LENGTH = 3000;

interface SelectedEvidence {
  readonly asset: DocumentPicker.DocumentPickerAsset;
  readonly contentType: 'application/pdf' | 'image/jpeg' | 'image/png';
  readonly licenseId: string;
}

function evidenceContentType(
  asset: DocumentPicker.DocumentPickerAsset,
  accepted: readonly string[]
): SelectedEvidence['contentType'] | null {
  const reported = asset.mimeType?.split(';', 1)[0].trim().toLowerCase();
  if (reported && accepted.includes(reported)) return reported as SelectedEvidence['contentType'];
  const extension = asset.name.toLowerCase().split('.').pop();
  const inferred = extension === 'pdf'
    ? 'application/pdf'
    : extension === 'png'
      ? 'image/png'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : null;
  return inferred && accepted.includes(inferred) ? inferred : null;
}

function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return 'Tamaño no informado';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function normalizeClockTime(value: string): string | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function presentError(error: unknown): string {
  if (error instanceof ApiError && error.fieldErrors.length > 0) {
    return [...new Set(error.fieldErrors.map(({ message }) => message))].join('\n');
  }
  return error instanceof Error ? error.message : 'Inténtalo nuevamente.';
}

export const VerificationScreen: React.FC = () => {
  const userProfile = useAuthStore((state) => state.userProfile);
  const signOut = useAuthStore((state) => state.signOut);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
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
  const [evidencePolicy, setEvidencePolicy] = useState<EvidenceUploadPolicy>({ mode: 'DISABLED' });
  const [selectedEvidence, setSelectedEvidence] = useState<SelectedEvidence | null>(null);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);

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
      getEvidenceUploadPolicy(controller.signal),
    ])
      .then(([ownProfile, specialtyCatalog, catalogs, uploadPolicy]) => {
        setProfile(ownProfile);
        setBio(ownProfile.bio ?? '');
        setSpecialties(specialtyCatalog);
        setSpecialtyCode(ownProfile.specialties.find(({ isPrimary }) => isPrimary)?.code ?? '');
        setModalities(catalogs.modalities);
        setCurrencies(catalogs.currencies);
        setEvidencePolicy(uploadPolicy);
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
        showAlert('No pudimos cargar tu expediente', presentError(error));
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => subscribeToPsychologistVerificationUpdates(() => {
    void refreshProfile().catch((error: unknown) => {
      showAlert(
        'No pudimos actualizar la verificación',
        error instanceof Error ? error.message : 'Vuelve a intentarlo.'
      );
    });
  }), [refreshProfile]);

  const saveSection = async (operation: () => Promise<ProfessionalProfile>, successMessage: string) => {
    setIsSaving(true);
    try {
      const updated = await operation();
      setProfile(updated);
      showAlert('Cambios guardados', successMessage);
    } catch (error) {
      showAlert('No pudimos guardar los cambios', presentError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const normalizedStartTime = normalizeClockTime(startTime);
  const normalizedEndTime = normalizeClockTime(endTime);
  const availabilityIsValid = normalizedStartTime !== null
    && normalizedEndTime !== null
    && normalizedStartTime < normalizedEndTime;
  const normalizedBioLength = bio.trim().length;
  const bioIsValid = normalizedBioLength >= PROFESSIONAL_BIO_MIN_LENGTH;
  const hasPrimarySpecialty = profile?.specialties.some(({ isPrimary }) => isPrimary) ?? false;
  const hasEnabledModality = profile?.modalities.some((item) => item.isEnabled) ?? false;
  const hasSubmittedEvidence = profile?.licenses.some(({ evidenceSubmitted }) => evidenceSubmitted) ?? false;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSelectEvidence = async (licenseId: string) => {
    if (evidencePolicy.mode !== 'LOCAL_QA') return;
    const result = await DocumentPicker.getDocumentAsync({
      type: [...evidencePolicy.acceptedContentTypes],
      multiple: false,
      copyToCacheDirectory: true,
      base64: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const contentType = evidenceContentType(asset, evidencePolicy.acceptedContentTypes);
    if (!contentType) {
      showAlert('Archivo no permitido', 'Selecciona un archivo PDF, JPEG o PNG.');
      return;
    }
    if (asset.size !== undefined && asset.size > evidencePolicy.maximumBytes) {
      showAlert(
        'Archivo demasiado grande',
        `El tamaño máximo es ${formatFileSize(evidencePolicy.maximumBytes)}.`
      );
      return;
    }
    setSelectedEvidence({ asset, contentType, licenseId });
  };

  const handleSubmitEvidence = async () => {
    if (!selectedEvidence || evidencePolicy.mode !== 'LOCAL_QA') return;
    setIsUploadingEvidence(true);
    try {
      const selectedSize = selectedEvidence.asset.size;
      if (selectedSize !== undefined && (selectedSize < 1 || selectedSize > evidencePolicy.maximumBytes)) {
        throw new Error(`El tamaño máximo es ${formatFileSize(evidencePolicy.maximumBytes)}.`);
      }
      const updated = await uploadLocalQaEvidence({
        licenseId: selectedEvidence.licenseId,
        fileName: selectedEvidence.asset.name,
        contentType: selectedEvidence.contentType,
        fileUri: selectedEvidence.asset.uri,
      });
      setProfile(updated);
      setSelectedEvidence(null);
      showAlert('Solicitud enviada', 'La evidencia quedó almacenada de forma privada para revisión local.');
    } catch (error) {
      showAlert(
        'No pudimos enviar la evidencia',
        presentError(error)
      );
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  const handleRefreshVerification = async () => {
    try {
      await refreshProfile();
    } catch (error) {
      showAlert(
        'No pudimos actualizar la verificación',
        error instanceof Error ? error.message : 'Inténtalo nuevamente.'
      );
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

        <View style={styles.progressCard}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionIcon}>
              <MaterialIcons name="checklist" size={22} color={Colors.primary} />
            </View>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.formTitle}>Requisitos para habilitar el panel</Text>
              <Text style={styles.helperText}>
                El acceso profesional se activa automáticamente cuando un administrador aprueba la evidencia y el perfil cumple los requisitos.
              </Text>
            </View>
          </View>
          {[
            { label: 'Presentación profesional', ready: bioIsValid, optional: true },
            { label: 'Especialidad principal', ready: hasPrimarySpecialty, optional: false },
            { label: 'Modalidad y tarifa activa', ready: hasEnabledModality, optional: false },
            { label: 'Evidencia enviada a revisión', ready: hasSubmittedEvidence, optional: false },
          ].map((step) => (
            <View key={step.label} style={styles.progressRow}>
              <MaterialIcons
                name={step.ready ? 'check-circle' : 'radio-button-unchecked'}
                size={20}
                color={step.ready ? Colors.success : Colors.textTertiary}
              />
              <Text style={styles.progressText}>{step.label}</Text>
              {step.optional ? <Text style={styles.optionalText}>Recomendado</Text> : null}
            </View>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <>
            {evidencePolicy.mode === 'LOCAL_QA' ? (
              <View style={styles.formCard}>
                <View style={styles.sectionHeadingRow}>
                  <View style={styles.sectionIcon}>
                    <MaterialIcons name="lock-outline" size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.sectionHeadingCopy}>
                    <Text style={styles.formTitle}>Evidencia profesional</Text>
                    <Text style={styles.helperText}>
                      Flujo privado de QA local. Acepta PDF, JPEG o PNG y no publica el archivo.
                    </Text>
                  </View>
                </View>

                {profile?.licenses.map((license) => {
                  const canSubmit = !license.evidenceSubmitted || license.status === 'REJECTED';
                  const selectedForLicense = selectedEvidence?.licenseId === license.id
                    ? selectedEvidence
                    : null;
                  return (
                    <View key={license.id} style={styles.evidenceLicenseCard}>
                      <Text style={styles.accountLabel}>{license.authority} · {license.number}</Text>
                      {!canSubmit ? (
                        <View style={styles.statusRow}>
                          <MaterialIcons name="schedule" size={18} color={Colors.warning} />
                          <Text style={styles.helperText}>Solicitud pendiente de revisión administrativa.</Text>
                        </View>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => void handleSelectEvidence(license.id)}
                            disabled={isUploadingEvidence}
                            accessibilityRole="button"
                            accessibilityLabel="Seleccionar evidencia profesional"
                          >
                            <MaterialIcons name="attach-file" size={19} color={Colors.primary} />
                            <Text style={styles.secondaryButtonText}>Seleccionar archivo</Text>
                          </TouchableOpacity>
                          {selectedForLicense ? (
                            <View style={styles.selectedFileRow}>
                              <MaterialIcons name="description" size={22} color={Colors.primary} />
                              <View style={styles.selectedFileCopy}>
                                <Text style={styles.selectedFileName} numberOfLines={1}>
                                  {selectedForLicense.asset.name}
                                </Text>
                                <Text style={styles.helperText}>
                                  {formatFileSize(selectedForLicense.asset.size)}
                                </Text>
                              </View>
                            </View>
                          ) : null}
                          <TouchableOpacity
                            style={[
                              styles.saveButton,
                              (!selectedForLicense || isUploadingEvidence) && styles.disabledButton,
                            ]}
                            onPress={() => void handleSubmitEvidence()}
                            disabled={!selectedForLicense || isUploadingEvidence}
                            accessibilityRole="button"
                            accessibilityLabel="Enviar evidencia a revisión"
                            accessibilityState={{ disabled: !selectedForLicense || isUploadingEvidence }}
                          >
                            {isUploadingEvidence ? (
                              <ActivityIndicator color={Colors.textInverse} />
                            ) : (
                              <Text style={styles.saveButtonText}>Enviar a revisión</Text>
                            )}
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.formCard}>
                <View style={styles.sectionHeadingRow}>
                  <View style={styles.sectionIcon}>
                    <MaterialIcons name="lock-outline" size={22} color={Colors.warning} />
                  </View>
                  <View style={styles.sectionHeadingCopy}>
                    <Text style={styles.formTitle}>Carga de evidencia no habilitada</Text>
                    <Text style={styles.helperText}>
                      Este entorno no tiene configurado un proveedor privado de evidencias. No es un error de tu cuenta; la verificación no puede enviarse hasta que el entorno habilite ese flujo.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Presentación profesional</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Describe tu enfoque, experiencia y población atendida"
                multiline
                maxLength={PROFESSIONAL_BIO_MAX_LENGTH}
                accessibilityLabel="Presentación profesional"
              />
              <View style={styles.fieldGuidanceRow}>
                <Text style={[
                  styles.helperText,
                  styles.fieldGuidanceText,
                  bio.length > 0 && !bioIsValid && styles.validationText,
                ]}>
                  Mínimo {PROFESSIONAL_BIO_MIN_LENGTH} caracteres. Describe brevemente tu experiencia y enfoque.
                </Text>
                <Text style={styles.characterCounter}>
                  {normalizedBioLength}/{PROFESSIONAL_BIO_MAX_LENGTH}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.saveButton, (isSaving || !bioIsValid) && styles.disabledButton]}
                disabled={isSaving || !bioIsValid}
                onPress={() => void saveSection(
                  () => updateProfessionalBio(bio.trim()),
                  'Tu presentación profesional fue actualizada.'
                )}
                accessibilityRole="button"
                accessibilityLabel="Guardar presentación"
                accessibilityState={{ disabled: isSaving || !bioIsValid }}
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
                style={[styles.saveButton, (isSaving || !specialtyCode) && styles.disabledButton]}
                disabled={isSaving || !specialtyCode}
                onPress={() => void saveSection(
                  () => replaceProfessionalSpecialties([specialtyCode], specialtyCode),
                  'Tu especialidad principal fue actualizada.'
                )}
                accessibilityRole="button"
                accessibilityLabel="Guardar especialidad"
                accessibilityState={{ disabled: isSaving || !specialtyCode }}
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
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="Inicio 08:00"
                  maxLength={5}
                />
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="Fin 17:00"
                  maxLength={5}
                />
              </View>
              <Text style={startTime || endTime ? (availabilityIsValid ? styles.helperText : styles.validationText) : styles.helperText}>
                {startTime || endTime
                  ? availabilityIsValid
                    ? 'Horario válido en formato de 24 horas.'
                    : 'Escribe un rango válido, por ejemplo 08:00 a 17:00.'
                  : 'Usa formato de 24 horas, por ejemplo 08:00 a 17:00.'}
              </Text>
              <TouchableOpacity
                style={[styles.saveButton, (isSaving || !availabilityIsValid) && styles.disabledButton]}
                disabled={isSaving || !availabilityIsValid}
                onPress={() => {
                  if (!normalizedStartTime || !normalizedEndTime) return;
                  setStartTime(normalizedStartTime);
                  setEndTime(normalizedEndTime);
                  void saveSection(
                    () => replaceProfessionalAvailability(timezone, [{
                      weekday,
                      startTime: normalizedStartTime,
                      endTime: normalizedEndTime,
                      isActive: true,
                    }]),
                    'Tu disponibilidad semanal fue actualizada.'
                  );
                }}
              >
                <Text style={styles.saveButtonText}>Guardar disponibilidad</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void handleRefreshVerification()}
          accessibilityRole="button"
          accessibilityLabel="Actualizar estado de verificación"
        >
          <MaterialIcons name="refresh" size={19} color={Colors.primary} />
          <Text style={styles.refreshButtonText}>Actualizar estado</Text>
        </TouchableOpacity>

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
  progressCard: {
    width: '100%',
    maxWidth: 600,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  optionalText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  formTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.borderSubtle,
  },
  sectionHeadingCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  evidenceLicenseCard: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  secondaryButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
  },
  secondaryButtonText: {
    ...Typography.button,
    color: Colors.primary,
  },
  selectedFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.borderSubtle,
  },
  selectedFileCopy: {
    flex: 1,
  },
  selectedFileName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
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
  fieldGuidanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  fieldGuidanceText: {
    flex: 1,
  },
  validationText: {
    color: Colors.error,
    flex: 1,
  },
  characterCounter: {
    ...Typography.caption,
    color: Colors.textTertiary,
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
  refreshButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  refreshButtonText: {
    ...Typography.button,
    color: Colors.primary,
  },
  disabledButton: {
    opacity: 0.6,
  },
  signOutText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
});
