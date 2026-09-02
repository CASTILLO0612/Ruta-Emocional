import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowRight,
  BadgeCheck,
  HeartHandshake,
  LockKeyhole,
  Mail,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { Eye, EyeOff } from 'lucide';
import { useNavigation } from '@react-navigation/native';

import { AppMorphIcon } from '../../components/common/AppMorphIcon';
import { Colors } from '../../theme/colors';
import { FontFamily, Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { MotionDuration } from '../../theme/motion';
import { PSYCHOLOGIST_LICENSE_AUTHORITY } from '../../services/AuthService';
import { useAuthStore } from '../../store/useAuthStore';
import { Toast, useToast } from '../../components/common/Toast';

const MINIMUM_PASSWORD_LENGTH = 12;
const MINIMUM_LICENSE_NUMBER_LENGTH = 4;
const MAXIMUM_LICENSE_NUMBER_LENGTH = 80;

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface FieldProps {
  icon: LucideIcon;
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
  autoComplete?: 'email' | 'password' | 'name' | 'off';
  accessibilityLabel?: string;
  hasError?: boolean;
  rightElement?: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({
  icon,
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete = 'off',
  accessibilityLabel,
  hasError,
  rightElement,
}) => {
  const [focused, setFocused] = useState(false);
  const FieldIcon = icon;

  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View
        style={[
          fieldStyles.inputShell,
          focused && fieldStyles.inputShellFocused,
          hasError && fieldStyles.inputShellError,
        ]}
      >
        <FieldIcon
          size={IconSize.action}
          strokeWidth={IconStroke.regular}
          color={focused ? Colors.primary : Colors.textTertiary}
        />
        <TextInput
          style={fieldStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textDisabled}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          accessibilityLabel={accessibilityLabel}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightElement && <View style={fieldStyles.right}>{rightElement}</View>}
      </View>
    </View>
  );
};

const fieldStyles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textSecondary,
  },
  inputShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  inputShellFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  inputShellError: { borderColor: Colors.error },
  input: {
    ...Typography.bodyLarge,
    flex: 1,
    color: Colors.textPrimary,
    paddingVertical: Spacing.md,
    padding: 0,
  },
  right: { marginLeft: Spacing.xs },
});

// ─────────────────────────────────────────────────────────────────────────────
// LoginScreen
// ─────────────────────────────────────────────────────────────────────────────

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const authenticate = useAuthStore((state) => state.authenticate);
  const { toastConfig, showToast, hideToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passError, setPassError] = useState(false);

  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: MotionDuration.normal,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: MotionDuration.slow,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleLogin = async () => {
    let valid = true;
    if (!email.trim()) { setEmailError(true); valid = false; }
    if (!password) { setPassError(true); valid = false; }
    if (!valid) {
      showToast('Completa todos los campos para continuar.', 'warning');
      return;
    }
    setEmailError(false);
    setPassError(false);
    setIsLoading(true);
    try {
      await authenticate(email.trim(), password);
    } catch (error: any) {
      const msg = error?.message || 'No pudimos iniciar sesión. Verifica tus credenciales.';
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Hero Header */}
      <View style={styles.hero}>
        <SafeAreaView>
          <View style={styles.heroContent}>
            <View style={styles.logoMark}>
              <HeartHandshake
                size={28}
                strokeWidth={IconStroke.emphasized}
                color={Colors.accent}
              />
            </View>
            <Text style={styles.appName}>Ruta Emocional</Text>
            <Text style={styles.tagline}>Apoyo profesional, cuando lo necesitas</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* Form area */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.formContainer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={styles.formTitle}>Bienvenido de vuelta</Text>
            <Text style={styles.formSub}>Inicia sesión para continuar</Text>

            <View style={styles.fields}>
              <Field
                icon={Mail}
                label="Correo electrónico"
                placeholder="nombre@correo.com"
                value={email}
                onChangeText={(v) => { setEmail(v); setEmailError(false); }}
                keyboardType="email-address"
                autoComplete="email"
                accessibilityLabel="Correo electrónico"
                hasError={emailError}
              />
              <Field
                icon={LockKeyhole}
                label="Contraseña"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChangeText={(v) => { setPassword(v); setPassError(false); }}
                secureTextEntry={!showPass}
                accessibilityLabel="Contraseña"
                hasError={passError}
                rightElement={
                  <TouchableOpacity
                    onPress={() => setShowPass((v) => !v)}
                    style={styles.fieldAction}
                    accessibilityLabel={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <AppMorphIcon
                      icon={showPass ? EyeOff : Eye}
                      size={IconSize.action}
                      strokeWidth={IconStroke.regular}
                      color={Colors.textTertiary}
                    />
                  </TouchableOpacity>
                }
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
              accessibilityLabel="Iniciar sesión"
              accessibilityRole="button"
            >
              {isLoading ? (
                <Text style={styles.primaryBtnText}>Verificando...</Text>
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Ingresar</Text>
                  <ArrowRight
                    size={IconSize.action}
                    strokeWidth={IconStroke.emphasized}
                    color={Colors.textInverse}
                  />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchLink}
              onPress={() => navigation.navigate('Register')}
              accessibilityLabel="Ir al registro"
            >
              <Text style={styles.switchText}>
                ¿No tienes cuenta?{'  '}
                <Text style={styles.switchBold}>Regístrate gratis</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast {...toastConfig} onHide={hideToast} />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RegisterScreen
// ─────────────────────────────────────────────────────────────────────────────

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const registerAccount = useAuthStore((state) => state.registerAccount);
  const { toastConfig, showToast, hideToast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'patient' | 'psychologist'>('patient');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passError, setPassError] = useState(false);
  const [licenseError, setLicenseError] = useState(false);

  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: MotionDuration.normal,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: MotionDuration.slow,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleRegister = async () => {
    let valid = true;
    const normalizedLicenseNumber = licenseNumber.trim();
    const licenseIsInvalid = role === 'psychologist' && (
      normalizedLicenseNumber.length < MINIMUM_LICENSE_NUMBER_LENGTH
      || normalizedLicenseNumber.length > MAXIMUM_LICENSE_NUMBER_LENGTH
    );

    if (!name.trim()) { setNameError(true); valid = false; }
    if (!email.trim()) { setEmailError(true); valid = false; }
    if (password.length < MINIMUM_PASSWORD_LENGTH) { setPassError(true); valid = false; }
    if (licenseIsInvalid) {
      setLicenseError(true);
      valid = false;
    }
    if (!valid) {
      const msg = licenseIsInvalid
        ? 'La colegiatura debe contener entre 4 y 80 caracteres.'
        : `Completa todos los campos. La contraseña debe tener al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`;
      showToast(msg, 'warning');
      return;
    }
    setIsLoading(true);
    try {
      await registerAccount({
        email: email.trim(),
        password,
        displayName: name.trim(),
        role,
        ...(role === 'psychologist'
          ? {
              license: {
                authority: PSYCHOLOGIST_LICENSE_AUTHORITY,
                number: normalizedLicenseNumber,
              },
            }
          : {}),
      });
    } catch (error: any) {
      const msg = error?.message || 'No pudimos crear tu cuenta. Intenta nuevamente.';
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <View style={styles.hero}>
        <SafeAreaView>
          <View style={styles.heroContent}>
            <View style={styles.logoMark}>
              <HeartHandshake
                size={28}
                strokeWidth={IconStroke.emphasized}
                color={Colors.accent}
              />
            </View>
            <Text style={styles.appName}>Ruta Emocional</Text>
            <Text style={styles.tagline}>Crea tu cuenta en segundos</Text>
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.formContainer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={styles.formTitle}>Crear cuenta</Text>
            <Text style={styles.formSub}>¿Cómo utilizarás la plataforma?</Text>

            {/* Role selector */}
            <View style={styles.roleRow}>
              {(['patient', 'psychologist'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                  onPress={() => setRole(r)}
                  accessibilityLabel={r === 'patient' ? 'Soy paciente' : 'Soy psicólogo'}
                  accessibilityState={{ selected: role === r }}
                >
                  {r === 'patient' ? (
                    <UserRound
                      size={IconSize.action}
                      strokeWidth={IconStroke.regular}
                      color={role === r ? Colors.primary : Colors.textTertiary}
                    />
                  ) : (
                    <HeartHandshake
                      size={IconSize.action}
                      strokeWidth={IconStroke.regular}
                      color={role === r ? Colors.primary : Colors.textTertiary}
                    />
                  )}
                  <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                    {r === 'patient' ? 'Paciente' : 'Psicólogo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.fields}>
              <Field
                icon={UserRound}
                label="Nombre completo"
                placeholder="Escribe tu nombre"
                value={name}
                onChangeText={(v) => { setName(v); setNameError(false); }}
                autoCapitalize="words"
                autoComplete="name"
                accessibilityLabel="Nombre completo"
                hasError={nameError}
              />
              <Field
                icon={Mail}
                label="Correo electrónico"
                placeholder="nombre@correo.com"
                value={email}
                onChangeText={(v) => { setEmail(v); setEmailError(false); }}
                keyboardType="email-address"
                autoComplete="email"
                accessibilityLabel="Correo electrónico"
                hasError={emailError}
              />
              <Field
                icon={LockKeyhole}
                label="Contraseña"
                placeholder={`Mínimo ${MINIMUM_PASSWORD_LENGTH} caracteres`}
                value={password}
                onChangeText={(v) => { setPassword(v); setPassError(false); }}
                secureTextEntry
                accessibilityLabel="Contraseña"
                hasError={passError}
              />
            </View>

            {/* Conditional MINSA License field for psychologists */}
            {role === 'psychologist' && (
              <View style={styles.fields}>
                <Field
                  icon={BadgeCheck}
                  label="Colegiatura MINSA"
                  placeholder="Ejemplo: MINSA-1234"
                  value={licenseNumber}
                  onChangeText={(v) => { setLicenseNumber(v); setLicenseError(false); }}
                  accessibilityLabel="Número de colegiatura MINSA"
                  hasError={licenseError}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}
              accessibilityLabel="Crear cuenta"
              accessibilityRole="button"
            >
              {isLoading ? (
                <Text style={styles.primaryBtnText}>Creando cuenta...</Text>
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Crear cuenta</Text>
                  <ArrowRight
                    size={IconSize.action}
                    strokeWidth={IconStroke.emphasized}
                    color={Colors.textInverse}
                  />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchLink}
              onPress={() => navigation.navigate('Login')}
              accessibilityLabel="Ir al inicio de sesión"
            >
              <Text style={styles.switchText}>
                ¿Ya tienes cuenta?{'  '}
                <Text style={styles.switchBold}>Inicia sesión</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast {...toastConfig} onHide={hideToast} />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },
  flex: { flex: 1 },

  hero: {
    backgroundColor: Colors.primary,
    paddingBottom: Spacing.xl,
  },
  heroContent: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.surfaceOnBrand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderOnBrand,
    marginBottom: Spacing.xs,
  },
  appName: {
    ...Typography.h1,
    color: Colors.textInverse,
    textAlign: 'center',
  },
  tagline: {
    ...Typography.body,
    color: Colors.textOnBrandMuted,
    textAlign: 'center',
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
  },
  formContainer: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
    gap: Spacing.lg,
    minHeight: 380,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  formTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  formSub: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: -Spacing.sm,
  },

  fields: { gap: Spacing.lg },

  roleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 48,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
  },
  roleChipActive: {
    backgroundColor: Colors.primaryFaded,
    borderColor: Colors.primary,
  },
  roleChipText: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textTertiary,
  },
  roleChipTextActive: { color: Colors.primary },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    minHeight: 52,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    ...Typography.button,
    color: Colors.textInverse,
    fontSize: 15,
  },

  fieldAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -Spacing.sm,
    marginRight: -Spacing.md,
  },
  switchLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  switchText: { ...Typography.bodySmall, color: Colors.textSecondary },
  switchBold: { color: Colors.primary, fontFamily: FontFamily.bodyBold },
});
