import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

export const VerificationScreen: React.FC = () => {
  const userProfile = useAuthStore((state) => state.userProfile);
  const signOut = useAuthStore((state) => state.signOut);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const rejected = userProfile?.psychologistVerificationStatus === 'REJECTED';
  const title = rejected ? 'Verificación no aprobada' : 'Verificación en proceso';
  const detail = rejected
    ? 'Tu solicitud necesita correcciones. El equipo de Ruta Emocional deberá indicarte qué documento debes actualizar.'
    : 'Estamos verificando tu licencia profesional. Mientras el proceso esté pendiente no podrás consultar pacientes, crear ofertas ni acceder a información clínica.';

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
      <View style={styles.container}>
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
        </View>

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
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
