import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  StatusBar,
  Modal,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomAlert } from '../../components/common/CustomAlert';
import { getOwnProfessionalProfile, updateProfessionalBio } from '../../repositories/ProfessionalProfileRepository';
import { showAlert } from '../../utils/alert';
import type { AppNavigation } from '../../navigation/navigationTypes';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const { userProfile, signOut } = useAuthStore();
  const isPsychologist = userProfile?.role === 'psychologist';

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
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back button"
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Mi perfil</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialIcons
                  name={isPsychologist ? 'psychology' : 'person'}
                  size={42}
                  color={Colors.primary}
                />
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
                <MaterialIcons name="medical-services" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.menuLabel}>Perfil profesional y Bio</Text>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textDisabled} />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Feather name="log-out" size={18} color={Colors.error} />
          <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      {isPsychologist && (
        <Modal visible={activePanel === 'profesional'} animationType="slide">
          <SafeAreaView style={styles.panelRoot}>
            <View style={styles.panelHeader}>
              <TouchableOpacity onPress={() => setActivePanel(null)} style={styles.panelCloseBtn}>
                <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '700',
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
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  email: {
    fontSize: 13,
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
    fontSize: 11,
    fontWeight: '700',
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
  availabilityText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },

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
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLbl: {
    fontSize: 11,
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
    fontSize: 15,
    fontWeight: '600',
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
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: '#EF444408',
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
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
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  panelBody: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -4,
  },
  panelInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});
