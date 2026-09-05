import React, { useEffect, useState } from 'react';
import { File } from 'expo-file-system';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CircleAlert,
  Clock3,
  FileText,
  ListChecks,
  LockKeyhole,
  LogOut,
  Paperclip,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import { Circle, CircleCheck } from 'lucide';
import { AppMorphIcon } from '../../components/common/AppMorphIcon';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
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
import { presentUserError } from '../../utils/userFacingError';
import { formatModalityLabel } from '../../utils/modality';
import {
  PROFESSIONAL_BIO_MAX_LENGTH,
  PROFESSIONAL_BIO_MIN_LENGTH,
} from '../../config/professionalProfile';
import { getDeviceTimeZone } from '../../config/localization';
import { normalizeClockTime } from '../../utils/availability';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;
type VerificationSection = 'SPECIALTY' | 'MODALITY' | 'EVIDENCE' | 'BIO' | 'AVAILABILITY';

const VERIFICATION_SECTIONS: readonly { readonly key: VerificationSection; readonly label: string }[] = [
  { key: 'SPECIALTY', label: 'Especialidad' },
  { key: 'MODALITY', label: 'Modalidad' },
  { key: 'EVIDENCE', label: 'Evidencia' },
  { key: 'BIO', label: 'Presentación' },
  { key: 'AVAILABILITY', label: 'Disponibilidad' },
];

interface SelectedEvidence {
  readonly file: File;
  readonly fileName: string;
  readonly contentType: 'application/pdf' | 'image/jpeg' | 'image/png';
  readonly licenseId: string;
}

function evidenceContentType(
  file: File,
  accepted: readonly string[]
): SelectedEvidence['contentType'] | null {
  const reported = file.type.split(';', 1)[0].trim().toLowerCase();
  if (reported && accepted.includes(reported)) return reported as SelectedEvidence['contentType'];
  const extension = file.name.toLowerCase().split('.').pop();
  const inferred = extension === 'pdf'
    ? 'application/pdf'
    : extension === 'png'
      ? 'image/png'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : null;
  return inferred && accepted.includes(inferred) ? inferred : null;
}

const EVIDENCE_FILE_EXTENSIONS: Readonly<Record<SelectedEvidence['contentType'], string>> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

function evidenceFileName(file: File, contentType: SelectedEvidence['contentType']): string {
  const extension = EVIDENCE_FILE_EXTENSIONS[contentType];
  const sanitized = file.name
    .replace(/[\\/\u0000-\u001F\u007F]/g, '_')
    .trim();
  const nameWithExtension = sanitized.toLowerCase().endsWith(extension)
    ? sanitized
    : `${sanitized || 'evidencia'}${extension}`;
  if (nameWithExtension.length <= 180) return nameWithExtension;
  return `${nameWithExtension.slice(0, 180 - extension.length)}${extension}`;
}

function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return 'Tamaño no informado';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function presentError(error: unknown): string {
  return presentUserError(error, 'No pudimos completar la acción. Inténtalo nuevamente.');
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
  const [activeSetupSection, setActiveSetupSection] = useState<VerificationSection>('SPECIALTY');

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
        const primarySpecialtyExists = ownProfile.specialties.some(({ isPrimary }) => isPrimary);
        const enabledModalityExists = ownProfile.modalities.some(({ isEnabled }) => isEnabled);
        const submittedEvidenceExists = ownProfile.licenses.some(({ evidenceSubmitted }) => evidenceSubmitted);
        setActiveSetupSection(
          !primarySpecialtyExists
            ? 'SPECIALTY'
            : !enabledModalityExists
              ? 'MODALITY'
              : !submittedEvidenceExists
                ? 'EVIDENCE'
                : 'BIO'
        );
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
        presentError(error)
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

  const timezone = getDeviceTimeZone();
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
    const result = await File.pickFileAsync({
      mimeTypes: [...evidencePolicy.acceptedContentTypes],
      multipleFiles: false,
    });
    if (result.canceled) return;
    const file = result.result;
    const contentType = evidenceContentType(file, evidencePolicy.acceptedContentTypes);
    if (!contentType) {
      showAlert('Archivo no permitido', 'Selecciona un archivo PDF, JPEG o PNG.');
      return;
    }
    if (!file.exists || file.size < 1) {
      showAlert('No pudimos leer el archivo', 'Selecciona nuevamente el documento desde el explorador de archivos.');
      return;
    }
    if (file.size > evidencePolicy.maximumBytes) {
      showAlert(
        'Archivo demasiado grande',
        `El tamaño máximo es ${formatFileSize(evidencePolicy.maximumBytes)}.`
      );
      return;
    }
    setSelectedEvidence({
      file,
      fileName: evidenceFileName(file, contentType),
      contentType,
      licenseId,
    });
  };

  const handleSubmitEvidence = async () => {
    if (!selectedEvidence || evidencePolicy.mode !== 'LOCAL_QA') return;
    setIsUploadingEvidence(true);
    try {
      const selectedSize = selectedEvidence.file.size;
      if (selectedSize < 1 || selectedSize > evidencePolicy.maximumBytes) {
        throw new Error(`El tamaño máximo es ${formatFileSize(evidencePolicy.maximumBytes)}.`);
      }
      const updated = await uploadLocalQaEvidence({
        licenseId: selectedEvidence.licenseId,
        fileName: selectedEvidence.fileName,
        contentType: selectedEvidence.contentType,
        file: selectedEvidence.file,
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
        presentError(error)
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.iconContainer, rejected && styles.rejectedIconContainer]}>
          {rejected
            ? <CircleAlert size={48} color={Colors.error} strokeWidth={1.6} />
            : <ShieldCheck size={48} color={Colors.primary} strokeWidth={1.6} />}
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
              <ListChecks size={22} color={Colors.primary} strokeWidth={1.9} />
            </View>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.formTitle}>Requisitos para habilitar el panel</Text>
              <Text style={styles.helperText}>
                El acceso profesional se activa automáticamente cuando un administrador aprueba la evidencia y el perfil cumple los requisitos.
              </Text>
            </View>
          </View>
          {[
            { label: 'Especialidad principal', ready: hasPrimarySpecialty, optional: false, section: 'SPECIALTY' as const },
            { label: 'Modalidad y tarifa activa', ready: hasEnabledModality, optional: false, section: 'MODALITY' as const },
            { label: 'Evidencia enviada a revisión', ready: hasSubmittedEvidence, optional: false, section: 'EVIDENCE' as const },
            { label: 'Presentación profesional', ready: bioIsValid, optional: true, section: 'BIO' as const },
          ].map((step) => (
            <TouchableOpacity
              key={step.label}
              style={styles.progressRow}
              onPress={() => setActiveSetupSection(step.section)}
              accessibilityRole="button"
              accessibilityLabel={`${step.label}: ${step.ready ? 'completado' : 'pendiente'}`}
            >
              <AppMorphIcon
                icon={step.ready ? CircleCheck : Circle}
                size={IconSize.action}
                color={step.ready ? Colors.success : Colors.textTertiary}
                strokeWidth={step.ready ? IconStroke.emphasized : IconStroke.regular}
              />
              <Text style={styles.progressText}>{step.label}</Text>
              {step.optional ? <Text style={styles.optionalText}>Recomendado</Text> : null}
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.setupNavigation}
              accessibilityRole="tablist"
            >
              {VERIFICATION_SECTIONS.map((section) => {
                const selected = activeSetupSection === section.key;
                return (
                  <TouchableOpacity
                    key={section.key}
                    onPress={() => setActiveSetupSection(section.key)}
                    style={[styles.setupTab, selected && styles.setupTabSelected]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    aria-selected={selected}
                  >
                    <Text style={[styles.setupTabText, selected && styles.setupTabTextSelected]}>
                      {section.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {activeSetupSection === 'EVIDENCE' ? (evidencePolicy.mode === 'LOCAL_QA' ? (
              <View style={styles.formCard}>
                <View style={styles.sectionHeadingRow}>
                  <View style={styles.sectionIcon}>
                    <LockKeyhole size={22} color={Colors.primary} strokeWidth={1.9} />
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
                          <Clock3 size={18} color={Colors.warning} strokeWidth={1.9} />
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
                            <Paperclip size={19} color={Colors.primary} strokeWidth={2} />
                            <Text style={styles.secondaryButtonText}>Seleccionar archivo</Text>
                          </TouchableOpacity>
                          {selectedForLicense ? (
                            <View style={styles.selectedFileRow}>
                              <FileText size={22} color={Colors.primary} strokeWidth={1.9} />
                              <View style={styles.selectedFileCopy}>
                                <Text style={styles.selectedFileName} numberOfLines={1}>
                                  {selectedForLicense.fileName}
                                </Text>
                                <Text style={styles.helperText}>
                                  {formatFileSize(selectedForLicense.file.size)}
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
                    <LockKeyhole size={22} color={Colors.warning} strokeWidth={1.9} />
                  </View>
                  <View style={styles.sectionHeadingCopy}>
                    <Text style={styles.formTitle}>Carga de evidencia no habilitada</Text>
                    <Text style={styles.helperText}>
                      Este entorno no tiene configurado un proveedor privado de evidencias. No es un error de tu cuenta; la verificación no puede enviarse hasta que el entorno habilite ese flujo.
                    </Text>
                  </View>
                </View>
              </View>
            )) : null}

            {activeSetupSection === 'BIO' ? <View style={styles.formCard}>
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
            </View> : null}

            {activeSetupSection === 'SPECIALTY' ? <View style={styles.formCard}>
              <Text style={styles.formTitle}>Especialidad principal</Text>
              <View style={styles.chipGroup}>
                {specialties.map((specialty) => (
                  <TouchableOpacity
                    key={specialty.code}
                    style={[styles.chip, specialtyCode === specialty.code && styles.selectedChip]}
                    onPress={() => setSpecialtyCode(specialty.code)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: specialtyCode === specialty.code }}
                    aria-checked={specialtyCode === specialty.code}
                    accessibilityLabel={`Especialidad ${specialty.name}`}
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
            </View> : null}

            {activeSetupSection === 'MODALITY' ? <View style={styles.formCard}>
              <Text style={styles.formTitle}>Modalidad y tarifa</Text>
              <View style={styles.chipGroup}>
                {modalities.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, modality === item && styles.selectedChip]}
                    onPress={() => setModality(item)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: modality === item }}
                    aria-checked={modality === item}
                    accessibilityLabel={`Modalidad ${formatModalityLabel(item)}`}
                  >
                    <Text style={modality === item ? styles.selectedChipText : styles.chipText}>
                      {formatModalityLabel(item)}
                    </Text>
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
                  accessibilityLabel="Tarifa por hora"
                />
                <View style={styles.currencyBox}>
                  <Text style={styles.currencyText}>{currency || currencies[0]}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.saveButton, (isSaving || !modality || !currency || !price) && styles.disabledButton]}
                disabled={isSaving || !modality || !currency || !price}
                onPress={() => modality && void saveSection(
                  () => configureProfessionalModality(modality, price.trim(), currency, true),
                  'Tu modalidad y tarifa fueron actualizadas.'
                )}
                accessibilityRole="button"
                accessibilityLabel="Guardar modalidad y tarifa"
                accessibilityState={{ disabled: isSaving || !modality || !currency || !price }}
              >
                <Text style={styles.saveButtonText}>Guardar modalidad</Text>
              </TouchableOpacity>
            </View> : null}

            {activeSetupSection === 'AVAILABILITY' ? <View style={styles.formCard}>
              <Text style={styles.formTitle}>Disponibilidad semanal básica</Text>
              <Text style={styles.helperText}>Zona horaria: {timezone}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipGroup}>
                {WEEKDAYS.map((label, index) => (
                  <TouchableOpacity
                    key={label}
                    style={[styles.chip, weekday === index && styles.selectedChip]}
                    onPress={() => setWeekday(index)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: weekday === index }}
                    aria-checked={weekday === index}
                    accessibilityLabel={`Día ${label}`}
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
                  accessibilityLabel="Hora de inicio"
                />
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="Fin 17:00"
                  maxLength={5}
                  accessibilityLabel="Hora de fin"
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
            </View> : null}
          </>
        )}

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void handleRefreshVerification()}
          accessibilityRole="button"
          accessibilityLabel="Actualizar estado de verificación"
        >
          <RefreshCw size={19} color={Colors.primary} strokeWidth={2} />
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
              <LogOut size={19} color={Colors.textInverse} strokeWidth={2} />
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
    backgroundColor: Colors.errorSurface,
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
    ...Shadow.sm,
  },
  accountLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  accountName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bodyBold,
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
    fontFamily: FontFamily.bodySemiBold,
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
    ...Shadow.sm,
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
    ...Shadow.sm,
  },
  progressRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  setupNavigation: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  setupTab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  setupTabSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryTint,
  },
  setupTabText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  setupTabTextSelected: {
    color: Colors.primary,
    fontFamily: FontFamily.bodySemiBold,
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
    fontFamily: FontFamily.bodySemiBold,
  },
  input: {
    ...Typography.body,
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
    minHeight: 44,
    justifyContent: 'center',
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
    fontFamily: FontFamily.bodyBold,
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
    fontFamily: FontFamily.bodyBold,
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
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  refreshButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
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
