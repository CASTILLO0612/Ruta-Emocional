import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BriefcaseMedical,
  ChevronRight,
  HeartHandshake,
  LogOut,
  UserRound,
  X,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { IconSize, IconStroke } from '../../theme/icons';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomAlert } from '../../components/common/CustomAlert';
import { getOwnProfessionalProfile, updateProfessionalBio } from '../../repositories/ProfessionalProfileRepository';
import { showAlert } from '../../utils/alert';
import type { AppNavigation } from '../../navigation/navigationTypes';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const { userProfile, signOut } = useAuthStore();
  const isPsychologist = userProfile?.role === 'psychologist';
  const isTabScreen = (navigation.getState() as { type?: string }).type === 'tab';

  const [logoutAlertVisible, setLogoutAlertVisible] = useState(false);
  const [saveSuccessAlertVisible, setSaveSuccessAlertVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<'profesional' | null>(null);

  const name = userProfile?.displayName ?? '';
  const email = userProfile?.email ?? '';
  const photoURL = userProfile?.photoURL ?? '';

  // Campos profesionales para psicólogo
  const [specialty, setSpecialty] = useState(userProfile?.specialty ?? '');
  const [bio, setBio] = useState(userProfile?.bio ?? '');

  useEffect(() => {
    if (!isPsychologist) return;
    const controller = new AbortController();
    void getOwnProfessionalProfile(controller.signal)
      .then((profile) => {
        setSpecialty(profile.specialties.find(({ isPrimary }) => isPrimary)?.name ?? '');
        setBio(profile.bio ?? '');
      })
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        showAlert('Perfil profesional', 'No pudimos cargar la información profesional actual.');
      });
    return () => controller.abort();
  }, [isPsychologist]);

  const handleSignOut = () => {
    setLogoutAlertVisible(true);
  };

  const handleConfirmSignOut = async () => {
    setLogoutAlertVisible(false);
    try {
      await signOut();
    } catch {
      console.warn('[Profile] No se pudo revocar la sesión remota; la sesión local fue eliminada.');
    }
  };

  const handleSaveProfessional = async () => {
    try {
      await updateProfessionalBio(bio.trim() || null);
      setActivePanel(null);
      setSaveSuccessAlertVisible(true);
    } catch (error) {
      showAlert(
        'No pudimos actualizar el perfil',
        error instanceof Error ? error.message : 'Inténtalo nuevamente.'
      );
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      
      <SafeAreaView style={styles.appBarSafe}>
        <View style={styles.appBar}>
          {isTabScreen ? (
            <View style={styles.appBarSpacer} />
          ) : (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Volver"
            >
              <ArrowLeft size={IconSize.navigation} strokeWidth={IconStroke.regular} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={styles.appBarTitle}>Mi perfil</Text>
          <View style={styles.appBarSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                {isPsychologist ? (
                  <HeartHandshake size={42} strokeWidth={IconStroke.regular} color={Colors.primary} />
                ) : (
                  <UserRound size={42} strokeWidth={IconStroke.regular} color={Colors.primary} />
                )}
              </View>
            )}
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
          
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {isPsychologist
                ? `Psicólogo ${userProfile?.psychologistVerificationStatus?.toLowerCase() ?? 'pendiente'}`
                : 'Paciente'}
            </Text>
          </View>
        </View>

        {isPsychologist && (
          <View style={styles.menuList}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => setActivePanel('profesional')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconBg}>
                <BriefcaseMedical size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
              </View>
              <Text style={styles.menuLabel}>Perfil profesional y Bio</Text>
              <ChevronRight size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <LogOut size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.error} />
          <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      {isPsychologist && (
        <Modal visible={activePanel === 'profesional'} animationType="slide">
          <SafeAreaView style={styles.panelRoot}>
            <View style={styles.panelHeader}>
              <TouchableOpacity onPress={() => setActivePanel(null)} style={styles.panelCloseBtn}>
                <X size={IconSize.navigation} strokeWidth={IconStroke.regular} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.panelTitle}>Perfil profesional</Text>
              <View style={{ width: 44 }} />
            </View>
            <ScrollView contentContainerStyle={styles.panelBody}>
              <Text style={styles.inputLabel}>Especialidades</Text>
              <TextInput style={styles.panelInput} value={specialty} editable={false} />

              <Text style={styles.inputLabel}>Resumen Profesional / Bio</Text>
              <TextInput
                style={[styles.panelInput, { minHeight: 100, textAlignVertical: 'top' }]}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
              />

              <View style={{ height: Spacing.xl }} />
              <TouchableOpacity style={styles.saveBtn} onPress={() => void handleSaveProfessional()}>
                <Text style={styles.saveBtnText}>Actualizar perfil profesional</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      <CustomAlert
        visible={logoutAlertVisible}
        title="Cerrar sesión"
        message="¿Estás seguro de que deseas cerrar sesión de tu cuenta?"
        confirmText="Cerrar sesión"
        cancelText="Cancelar"
        showCancel
        onConfirm={handleConfirmSignOut}
        onCancel={() => setLogoutAlertVisible(false)}
      />

      <CustomAlert
        visible={saveSuccessAlertVisible}
        title="Perfil actualizado"
        message="La presentación profesional fue actualizada correctamente."
        confirmText="Aceptar"
        onConfirm={() => setSaveSuccessAlertVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  appBarSafe: {
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
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarSpacer: { width: 44, height: 44 },
  appBarTitle: {
    ...Typography.h4,
    fontFamily: FontFamily.brandBold,
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.full,
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  name: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  email: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  roleText: {
    ...Typography.caption,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  availabilityDot: { width: 8, height: 8, borderRadius: 4 },
  dotOnline: { backgroundColor: Colors.accent },
  dotOffline: { backgroundColor: Colors.textDisabled },
  availabilityText: { ...Typography.caption, fontFamily: FontFamily.bodySemiBold, color: Colors.textPrimary },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    margin: Spacing.base,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statVal: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  statLbl: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  menuList: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.divider,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuLabel: {
    flex: 1,
    ...Typography.body,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textPrimary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.errorSurface,
  },
  logoutBtnText: {
    ...Typography.button,
    color: Colors.error,
  },

  panelRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  panelCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  panelTitle: {
    ...Typography.h4,
    fontFamily: FontFamily.brandBold,
    color: Colors.textPrimary,
  },
  panelBody: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -4,
  },
  panelInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    ...Typography.body,
    color: Colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  saveBtnText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
});
