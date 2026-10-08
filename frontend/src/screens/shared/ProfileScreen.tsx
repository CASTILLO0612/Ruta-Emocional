import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import {
  BriefcaseMedical,
  Camera,
  ChevronRight,
  HeartHandshake,
  Info,
  LogOut,
  MapPin,
  MessageSquareQuote,
  Pencil,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react-native';

import { AppButton } from '../../components/common/AppButton';
import { CustomAlert } from '../../components/common/CustomAlert';
import { ProfessionalProfileSheet } from '../../components/profile/ProfessionalProfileSheet';
import {
  ProfessionalPracticeDraft,
  ProfessionalPracticeSheet,
} from '../../components/profile/ProfessionalPracticeSheet';
import { PracticeLocationSheet } from '../../components/profile/PracticeLocationSheet';
import { ProfileDetailsSheet } from '../../components/profile/ProfileDetailsSheet';
import { ReceivedReviewsSheet } from '../../components/profile/ReceivedReviewsSheet';
import { AppHeader } from '../../components/shared/AppHeader';
import type { AppNavigation } from '../../navigation/navigationTypes';
import {
  getOwnProfessionalProfile,
  getProfessionalCatalogs,
  getSpecialtyCatalog,
  configureProfessionalModality,
  replaceProfessionalSpecialties,
  updatePracticeLocation,
  updateProfessionalBio,
} from '../../repositories/ProfessionalProfileRepository';
import type {
  PracticeLocation,
  ProfessionalCatalogs,
  ProfessionalProfile,
  SpecialtyCatalogItem,
} from '../../models/ProfessionalProfile';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { showAlert } from '../../utils/alert';
import { presentUserError } from '../../utils/userFacingError';
import { getProfileRoleLabel } from '../../utils/profilePresentation';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const userProfile = useAuthStore((state) => state.userProfile);
  const signOut = useAuthStore((state) => state.signOut);
  const signOutAll = useAuthStore((state) => state.signOutAll);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const replaceProfilePhoto = useAuthStore((state) => state.replaceProfilePhoto);
  const removeProfilePhoto = useAuthStore((state) => state.removeProfilePhoto);
  const isPsychologist = userProfile?.role === 'psychologist';
  const isTabScreen = (navigation.getState() as { type?: string }).type === 'tab';

  const [logoutAlertVisible, setLogoutAlertVisible] = useState(false);
  const [logoutAllAlertVisible, setLogoutAllAlertVisible] = useState(false);
  const [saveSuccessAlertVisible, setSaveSuccessAlertVisible] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('Tus cambios se guardaron correctamente.');
  const [editorVisible, setEditorVisible] = useState(false);
  const [practiceEditorVisible, setPracticeEditorVisible] = useState(false);
  const [locationEditorVisible, setLocationEditorVisible] = useState(false);
  const [accountEditorVisible, setAccountEditorVisible] = useState(false);
  const [removePhotoAlertVisible, setRemovePhotoAlertVisible] = useState(false);
  const [reviewsVisible, setReviewsVisible] = useState(false);
  const [draftName, setDraftName] = useState(userProfile?.displayName ?? '');
  const [draftPhone, setDraftPhone] = useState(userProfile?.phone ?? '');
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [specialty, setSpecialty] = useState(userProfile?.specialty ?? '');
  const [bio, setBio] = useState(userProfile?.bio ?? '');
  const [isLoadingProfessional, setIsLoadingProfessional] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [professionalLoadFailed, setProfessionalLoadFailed] = useState(false);
  const [professionalProfile, setProfessionalProfile] = useState<ProfessionalProfile | null>(null);
  const [specialtyCatalog, setSpecialtyCatalog] = useState<readonly SpecialtyCatalogItem[]>([]);
  const [professionalCatalogs, setProfessionalCatalogs] = useState<ProfessionalCatalogs | null>(null);
  const [isLoadingPractice, setIsLoadingPractice] = useState(false);
  const [practiceLocation, setPracticeLocation] = useState<PracticeLocation | null>(null);
  const [practiceName, setPracticeName] = useState('');
  const [practiceAddress, setPracticeAddress] = useState('');
  const [practiceDirections, setPracticeDirections] = useState('');
  const [practiceCoordinates, setPracticeCoordinates] = useState<{
    readonly latitude: number;
    readonly longitude: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const loadProfessionalProfile = useCallback(async (signal?: AbortSignal) => {
    if (!isPsychologist) return;
    setIsLoadingProfessional(true);
    setProfessionalLoadFailed(false);
    try {
      const profile = await getOwnProfessionalProfile(signal);
      setProfessionalProfile(profile);
      setSpecialty(profile.specialties.find(({ isPrimary }) => isPrimary)?.name ?? '');
      setBio(profile.bio ?? '');
      setPracticeLocation(profile.practiceLocation);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setProfessionalLoadFailed(true);
    } finally {
      if (!signal?.aborted) setIsLoadingProfessional(false);
    }
  }, [isPsychologist]);

  useEffect(() => {
    const controller = new AbortController();
    void loadProfessionalProfile(controller.signal);
    return () => controller.abort();
  }, [loadProfessionalProfile]);

  const handleConfirmSignOut = async () => {
    setLogoutAlertVisible(false);
    try {
      await signOut();
    } catch {
      showAlert(
        'Sesión cerrada localmente',
        'No fue posible confirmar la revocación remota. Vuelve a iniciar sesión solo en un dispositivo seguro.'
      );
    }
  };

  const handleConfirmSignOutAll = async () => {
    setLogoutAllAlertVisible(false);
    try {
      await signOutAll();
    } catch {
      showAlert(
        'Sesiones cerradas localmente',
        'No fue posible confirmar la revocación remota. Cambia tu contraseña si sospechas un acceso no autorizado.'
      );
    }
  };

  const handleOpenAccountEditor = () => {
    setDraftName(userProfile?.displayName ?? '');
    setDraftPhone(userProfile?.phone ?? '');
    setAccountEditorVisible(true);
  };

  const handleSaveAccount = async () => {
    setIsSavingAccount(true);
    try {
      await updateProfile(draftName.trim(), draftPhone.trim() || null);
      setAccountEditorVisible(false);
      setSaveSuccessMessage('Tus datos personales fueron actualizados correctamente.');
      setSaveSuccessAlertVisible(true);
    } catch (error) {
      showAlert(
        'No pudimos actualizar tus datos',
        presentUserError(error, 'Tus cambios no se guardaron. Inténtalo nuevamente.')
      );
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleSelectPhoto = async () => {
    setIsUpdatingPhoto(true);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showAlert('Permiso necesario', 'Permite el acceso a tus fotos para elegir una imagen de perfil.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const optimized = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1024, height: 1024 } }],
        { compress: 0.82, format: SaveFormat.JPEG }
      );
      await replaceProfilePhoto(optimized.uri, 'image/jpeg');
    } catch (error) {
      showAlert(
        'No pudimos actualizar la foto',
        presentUserError(error, 'Selecciona otra imagen e inténtalo nuevamente.')
      );
    } finally {
      setIsUpdatingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setRemovePhotoAlertVisible(false);
    setIsUpdatingPhoto(true);
    try {
      await removeProfilePhoto();
    } catch (error) {
      showAlert(
        'No pudimos eliminar la foto',
        presentUserError(error, 'La foto no fue modificada. Inténtalo nuevamente.')
      );
    } finally {
      setIsUpdatingPhoto(false);
    }
  };

  const handleSaveProfessional = async () => {
    setIsSaving(true);
    try {
      const updated = await updateProfessionalBio(bio.trim() || null);
      setProfessionalProfile(updated);
      setBio(updated.bio ?? '');
      setEditorVisible(false);
      setSaveSuccessMessage('Tu presentación profesional fue actualizada correctamente.');
      setSaveSuccessAlertVisible(true);
    } catch (error) {
      showAlert(
        'No pudimos actualizar el perfil',
        presentUserError(error, 'Tus cambios no se guardaron. Inténtalo nuevamente.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPracticeEditor = async () => {
    setPracticeEditorVisible(true);
    if (specialtyCatalog.length > 0 && professionalCatalogs) return;
    setIsLoadingPractice(true);
    try {
      const [nextSpecialties, nextCatalogs] = await Promise.all([
        getSpecialtyCatalog(),
        getProfessionalCatalogs(),
      ]);
      setSpecialtyCatalog(nextSpecialties);
      setProfessionalCatalogs(nextCatalogs);
    } catch (error) {
      setPracticeEditorVisible(false);
      showAlert(
        'No pudimos cargar los servicios',
        presentUserError(error, 'Verifica tu conexión e inténtalo nuevamente.')
      );
    } finally {
      setIsLoadingPractice(false);
    }
  };

  const handleSavePractice = async (draft: ProfessionalPracticeDraft) => {
    setIsSaving(true);
    try {
      let updated = await replaceProfessionalSpecialties(
        draft.specialtyCodes,
        draft.primarySpecialtyCode
      );
      for (const modality of draft.modalities) {
        const wasConfigured = professionalProfile?.modalities.some(({ code }) => code === modality.code) ?? false;
        if (!modality.isEnabled && !wasConfigured) continue;
        updated = await configureProfessionalModality(
          modality.code,
          modality.amount.trim(),
          modality.currency,
          modality.isEnabled
        );
      }
      setProfessionalProfile(updated);
      setSpecialty(updated.specialties.find(({ isPrimary }) => isPrimary)?.name ?? '');
      setPracticeEditorVisible(false);
      setSaveSuccessMessage('Tus servicios y tarifas fueron actualizados correctamente.');
      setSaveSuccessAlertVisible(true);
    } catch (error) {
      await loadProfessionalProfile();
      showAlert(
        'No pudimos guardar todos los servicios',
        presentUserError(error, 'Revisamos los cambios aplicados. Verifica los datos e inténtalo nuevamente.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenLocationEditor = () => {
    setPracticeName(practiceLocation?.name ?? '');
    setPracticeAddress(practiceLocation?.address ?? '');
    setPracticeDirections(practiceLocation?.directions ?? '');
    setPracticeCoordinates(practiceLocation
      ? { latitude: practiceLocation.latitude, longitude: practiceLocation.longitude }
      : null);
    setLocationEditorVisible(true);
  };

  const handleLocatePractice = async () => {
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        showAlert(
          'Ubicación no disponible',
          'Activa el permiso de ubicación mientras estés en el consultorio e inténtalo nuevamente.'
        );
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPracticeCoordinates({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch (error) {
      showAlert(
        'No pudimos obtener la ubicación',
        presentUserError(error, 'Verifica que la ubicación del dispositivo esté activa e inténtalo nuevamente.')
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handleSavePracticeLocation = async () => {
    if (!practiceCoordinates) {
      showAlert('Ubicación pendiente', 'Registra la ubicación del consultorio antes de guardar.');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updatePracticeLocation({
        name: practiceName.trim(),
        address: practiceAddress.trim(),
        ...(practiceDirections.trim() ? { directions: practiceDirections.trim() } : {}),
        latitude: practiceCoordinates.latitude,
        longitude: practiceCoordinates.longitude,
      });
      setProfessionalProfile(updated);
      setPracticeLocation(updated.practiceLocation);
      setLocationEditorVisible(false);
      setSaveSuccessMessage('La ubicación del consultorio fue actualizada correctamente.');
      setSaveSuccessAlertVisible(true);
    } catch (error) {
      showAlert(
        'No pudimos guardar la ubicación',
        presentUserError(error, 'La ubicación no fue modificada. Inténtalo nuevamente.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const name = userProfile?.displayName ?? 'Usuario';
  const email = userProfile?.email ?? '';
  const photoURL = userProfile?.photoURL ?? '';
  const roleLabel = getProfileRoleLabel(
    isPsychologist,
    userProfile?.psychologistVerificationStatus
  );

  return (
    <View style={styles.root}>
      <AppHeader title="Perfil" showBack={!isTabScreen} showBrandMark={isTabScreen} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentColumn}>
          <View style={styles.identityHeader}>
            <Pressable
              onPress={() => void handleSelectPhoto()}
              disabled={isUpdatingPhoto}
              style={styles.avatarAction}
              accessibilityRole="button"
              accessibilityLabel={photoURL ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'}
            >
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.avatar} accessibilityLabel={`Foto de ${name}`} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  {isPsychologist ? (
                    <HeartHandshake size={36} strokeWidth={IconStroke.regular} color={Colors.primary} />
                  ) : (
                    <UserRound size={36} strokeWidth={IconStroke.regular} color={Colors.primary} />
                  )}
                </View>
              )}
              <View style={styles.photoActionBadge}>
                {isUpdatingPhoto ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <Camera size={IconSize.inline} strokeWidth={IconStroke.regular} color={Colors.textInverse} />
                )}
              </View>
            </Pressable>
            <View style={styles.identityCopy}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.email}>{email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{roleLabel}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleOpenAccountEditor}
              style={styles.editIdentityButton}
              accessibilityRole="button"
              accessibilityLabel="Editar datos personales"
            >
              <Pencil size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.photoActions}>
            <TouchableOpacity
              onPress={() => void handleSelectPhoto()}
              disabled={isUpdatingPhoto}
              accessibilityRole="button"
            >
              <Text style={styles.photoActionText}>{photoURL ? 'Cambiar foto' : 'Agregar foto'}</Text>
            </TouchableOpacity>
            {photoURL ? (
              <TouchableOpacity
                onPress={() => setRemovePhotoAlertVisible(true)}
                disabled={isUpdatingPhoto}
                accessibilityRole="button"
              >
                <Text style={styles.removePhotoText}>Eliminar</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isPsychologist ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cuenta profesional</Text>
              {isLoadingProfessional ? (
                <View style={styles.feedbackRow} accessibilityRole="progressbar">
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.feedbackText}>Cargando información profesional…</Text>
                </View>
              ) : professionalLoadFailed ? (
                <View style={styles.feedbackRow} accessibilityRole="alert">
                  <Text style={styles.feedbackText}>No pudimos cargar la información profesional.</Text>
                  <TouchableOpacity
                    onPress={() => void loadProfessionalProfile()}
                    style={styles.retryButton}
                    accessibilityRole="button"
                    accessibilityLabel="Reintentar carga del perfil profesional"
                  >
                    <RefreshCw size={IconSize.inline} color={Colors.primary} strokeWidth={IconStroke.regular} />
                    <Text style={styles.retryText}>Reintentar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => setEditorVisible(true)}
                    activeOpacity={0.76}
                    accessibilityRole="button"
                    accessibilityLabel="Editar presentación profesional"
                    accessibilityHint={specialty ? `Especialidad principal: ${specialty}` : 'Especialidad aún no configurada'}
                  >
                    <View style={styles.menuIcon}>
                      <BriefcaseMedical size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
                    </View>
                    <View style={styles.menuCopy}>
                      <Text style={styles.menuLabel}>Presentación profesional</Text>
                      <Text style={styles.menuDetail} numberOfLines={1}>
                        {specialty || 'Completa tu especialidad principal'}
                      </Text>
                    </View>
                    <ChevronRight size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => void handleOpenPracticeEditor()}
                    activeOpacity={0.76}
                    accessibilityRole="button"
                    accessibilityLabel="Configurar especialidades, modalidades y tarifas"
                  >
                    <View style={styles.menuIcon}>
                      <SlidersHorizontal size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
                    </View>
                    <View style={styles.menuCopy}>
                      <Text style={styles.menuLabel}>Servicios y tarifas</Text>
                      <Text style={styles.menuDetail} numberOfLines={1}>
                        Especialidades y modalidades de atención
                      </Text>
                    </View>
                    <ChevronRight size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={handleOpenLocationEditor}
                    activeOpacity={0.76}
                    accessibilityRole="button"
                    accessibilityLabel="Configurar ubicación del consultorio"
                  >
                    <View style={styles.menuIcon}>
                      <MapPin size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
                    </View>
                    <View style={styles.menuCopy}>
                      <Text style={styles.menuLabel}>Consultorio</Text>
                      <Text style={styles.menuDetail} numberOfLines={1}>
                        {practiceLocation?.address ?? 'Configura la ubicación presencial'}
                      </Text>
                    </View>
                    <ChevronRight size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textTertiary} />
                  </TouchableOpacity>

                  {userProfile?.capabilities.includes('review:read:self') ? (
                    <TouchableOpacity
                      style={styles.menuRow}
                      onPress={() => setReviewsVisible(true)}
                      activeOpacity={0.76}
                      accessibilityRole="button"
                      accessibilityLabel="Consultar opiniones recibidas"
                    >
                      <View style={styles.menuIcon}>
                        <MessageSquareQuote size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
                      </View>
                      <View style={styles.menuCopy}>
                        <Text style={styles.menuLabel}>Opiniones recibidas</Text>
                        <Text style={styles.menuDetail}>Feedback de tus atenciones completadas</Text>
                      </View>
                      <ChevronRight size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seguridad</Text>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => setLogoutAllAlertVisible(true)}
              activeOpacity={0.76}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión en todos los dispositivos"
            >
              <View style={styles.menuIcon}>
                <ShieldCheck size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuLabel}>Cerrar todas las sesiones</Text>
                <Text style={styles.menuDetail}>Revoca el acceso en todos tus dispositivos</Text>
              </View>
              <ChevronRight size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acerca de</Text>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => navigation.navigate('LegalNotices')}
              activeOpacity={0.76}
              accessibilityRole="button"
              accessibilityLabel="Avisos legales"
              accessibilityHint="Consulta las atribuciones y licencias de navegación"
            >
              <View style={styles.menuIcon}>
                <Info size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuLabel}>Avisos legales</Text>
                <Text style={styles.menuDetail}>Mapas y licencias</Text>
              </View>
              <ChevronRight size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <AppButton
            label="Cerrar sesión"
            onPress={() => setLogoutAlertVisible(true)}
            variant="dangerGhost"
            fullWidth
            icon={<LogOut size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.error} />}
          />
        </View>
      </ScrollView>

      {isPsychologist ? (
        <>
          <ProfessionalProfileSheet
            visible={editorVisible}
            specialty={specialty}
            bio={bio}
            isSaving={isSaving}
            onBioChange={setBio}
            onSave={() => void handleSaveProfessional()}
            onClose={() => setEditorVisible(false)}
          />
          <ProfessionalPracticeSheet
            visible={practiceEditorVisible}
            profile={professionalProfile}
            specialties={specialtyCatalog}
            catalogs={professionalCatalogs}
            isLoading={isLoadingPractice}
            isSaving={isSaving}
            onSave={(draft) => void handleSavePractice(draft)}
            onClose={() => setPracticeEditorVisible(false)}
          />
          <PracticeLocationSheet
            visible={locationEditorVisible}
            name={practiceName}
            address={practiceAddress}
            directions={practiceDirections}
            coordinates={practiceCoordinates}
            isLocating={isLocating}
            isSaving={isSaving}
            onNameChange={setPracticeName}
            onAddressChange={setPracticeAddress}
            onDirectionsChange={setPracticeDirections}
            onLocate={() => void handleLocatePractice()}
            onSave={() => void handleSavePracticeLocation()}
            onClose={() => setLocationEditorVisible(false)}
          />
        </>
      ) : null}

      <ProfileDetailsSheet
        visible={accountEditorVisible}
        displayName={draftName}
        phone={draftPhone}
        isSaving={isSavingAccount}
        onDisplayNameChange={setDraftName}
        onPhoneChange={setDraftPhone}
        onSave={() => void handleSaveAccount()}
        onClose={() => setAccountEditorVisible(false)}
      />

      <ReceivedReviewsSheet
        visible={reviewsVisible}
        onClose={() => setReviewsVisible(false)}
      />

      <CustomAlert
        visible={removePhotoAlertVisible}
        title="Eliminar foto"
        message="Tu perfil volverá a mostrar el avatar predeterminado."
        confirmText="Eliminar"
        cancelText="Cancelar"
        tone="warning"
        showCancel
        onConfirm={() => void handleRemovePhoto()}
        onCancel={() => setRemovePhotoAlertVisible(false)}
      />

      <CustomAlert
        visible={logoutAllAlertVisible}
        title="Cerrar todas las sesiones"
        message="Se revocará el acceso en todos tus dispositivos, incluido este. Tendrás que iniciar sesión nuevamente."
        confirmText="Cerrar todas"
        cancelText="Cancelar"
        tone="warning"
        showCancel
        onConfirm={() => void handleConfirmSignOutAll()}
        onCancel={() => setLogoutAllAlertVisible(false)}
      />

      <CustomAlert
        visible={logoutAlertVisible}
        title="Cerrar sesión"
        message="¿Deseas cerrar la sesión en este dispositivo?"
        confirmText="Cerrar sesión"
        cancelText="Cancelar"
        tone="warning"
        showCancel
        onConfirm={() => void handleConfirmSignOut()}
        onCancel={() => setLogoutAlertVisible(false)}
      />

      <CustomAlert
        visible={saveSuccessAlertVisible}
        title="Perfil actualizado"
        message={saveSuccessMessage}
        confirmText="Aceptar"
        tone="success"
        onConfirm={() => setSaveSuccessAlertVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, alignItems: 'center', padding: Spacing.base, paddingBottom: Spacing.xxxl },
  contentColumn: { width: '100%', maxWidth: 680, gap: Spacing.xl },
  identityHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.base,
    paddingHorizontal: Spacing.xs, paddingTop: Spacing.md,
  },
  avatarAction: { width: 76, height: 76 },
  avatar: { width: 72, height: 72, borderRadius: BorderRadius.full },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryFaded,
  },
  identityCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  photoActionBadge: {
    position: 'absolute', right: 0, bottom: 0, width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.background,
  },
  editIdentityButton: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.full, backgroundColor: Colors.primaryTint,
  },
  photoActions: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    marginTop: -Spacing.md, paddingLeft: 84 + Spacing.base,
  },
  photoActionText: { ...Typography.label, color: Colors.primary },
  removePhotoText: { ...Typography.label, color: Colors.error },
  name: { ...Typography.h3, color: Colors.textPrimary },
  email: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xxs },
  roleBadge: {
    marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, backgroundColor: Colors.primaryFaded,
  },
  roleText: { ...Typography.caption, fontFamily: FontFamily.bodySemiBold, color: Colors.primary },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary },
  menuRow: {
    minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.base,
    borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  menuIcon: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.full, backgroundColor: Colors.primaryTint,
  },
  menuCopy: { flex: 1, minWidth: 0 },
  menuLabel: { ...Typography.body, fontFamily: FontFamily.bodySemiBold, color: Colors.textPrimary },
  menuDetail: { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.xxs },
  feedbackRow: {
    minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.base,
    borderRadius: BorderRadius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  feedbackText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },
  retryButton: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm,
  },
  retryText: { ...Typography.label, color: Colors.primary },
});
