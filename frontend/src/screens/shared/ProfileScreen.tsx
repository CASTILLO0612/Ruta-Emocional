import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  BriefcaseMedical,
  ChevronRight,
  HeartHandshake,
  LogOut,
  RefreshCw,
  UserRound,
} from 'lucide-react-native';

import { AppButton } from '../../components/common/AppButton';
import { CustomAlert } from '../../components/common/CustomAlert';
import { ProfessionalProfileSheet } from '../../components/profile/ProfessionalProfileSheet';
import { AppHeader } from '../../components/shared/AppHeader';
import type { AppNavigation } from '../../navigation/navigationTypes';
import {
  getOwnProfessionalProfile,
  updateProfessionalBio,
} from '../../repositories/ProfessionalProfileRepository';
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
  const isPsychologist = userProfile?.role === 'psychologist';
  const isTabScreen = (navigation.getState() as { type?: string }).type === 'tab';

  const [logoutAlertVisible, setLogoutAlertVisible] = useState(false);
  const [saveSuccessAlertVisible, setSaveSuccessAlertVisible] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [specialty, setSpecialty] = useState(userProfile?.specialty ?? '');
  const [bio, setBio] = useState(userProfile?.bio ?? '');
  const [isLoadingProfessional, setIsLoadingProfessional] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [professionalLoadFailed, setProfessionalLoadFailed] = useState(false);

  const loadProfessionalProfile = useCallback(async (signal?: AbortSignal) => {
    if (!isPsychologist) return;
    setIsLoadingProfessional(true);
    setProfessionalLoadFailed(false);
    try {
      const profile = await getOwnProfessionalProfile(signal);
      setSpecialty(profile.specialties.find(({ isPrimary }) => isPrimary)?.name ?? '');
      setBio(profile.bio ?? '');
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

  const handleSaveProfessional = async () => {
    setIsSaving(true);
    try {
      const updated = await updateProfessionalBio(bio.trim() || null);
      setBio(updated.bio ?? '');
      setEditorVisible(false);
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

  const name = userProfile?.displayName ?? 'Usuario';
  const email = userProfile?.email ?? '';
  const photoURL = userProfile?.photoURL ?? '';
  const roleLabel = getProfileRoleLabel(
    isPsychologist,
    userProfile?.psychologistVerificationStatus
  );

  return (
    <View style={styles.root}>
      <AppHeader title="Mi perfil" showBack={!isTabScreen} showBrandMark={isTabScreen} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentColumn}>
          <View style={styles.identityCard}>
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
            <View style={styles.identityCopy}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.email}>{email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{roleLabel}</Text>
              </View>
            </View>
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
              )}
            </View>
          ) : null}

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
        <ProfessionalProfileSheet
          visible={editorVisible}
          specialty={specialty}
          bio={bio}
          isSaving={isSaving}
          onBioChange={setBio}
          onSave={() => void handleSaveProfessional()}
          onClose={() => setEditorVisible(false)}
        />
      ) : null}

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
        message="La presentación profesional fue actualizada correctamente."
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
  identityCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.base, padding: Spacing.lg,
    borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  avatar: { width: 72, height: 72, borderRadius: BorderRadius.full },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryFaded,
  },
  identityCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
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
