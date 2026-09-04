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

import { AppButton } from '../../components/common/AppButton';
import { AppMorphIcon } from '../../components/common/AppMorphIcon';
import { BrandLogo } from '../../components/common/BrandLogo';
import { Colors } from '../../theme/colors';
import { FontFamily, Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';
import { MotionDuration } from '../../theme/motion';
import { PSYCHOLOGIST_LICENSE_AUTHORITY } from '../../services/AuthService';
import { useAuthStore } from '../../store/useAuthStore';
import { Toast, useToast } from '../../components/common/Toast';
import type { AppNavigation } from '../../navigation/navigationTypes';
import {
  AuthValidationErrors,
  hasAuthValidationErrors,
  MINIMUM_PASSWORD_LENGTH,
  validateLoginInput,
  validateRegistrationInput,
} from '../../utils/authValidation';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import { presentUserError } from '../../utils/userFacingError';

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
  errorMessage?: string;
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
  errorMessage,
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
          errorMessage && fieldStyles.inputShellError,
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
          autoCorrect={false}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={errorMessage}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightElement && <View style={fieldStyles.right}>{rightElement}</View>}
      </View>
      {errorMessage ? (
        <Text style={fieldStyles.errorText} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
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
  errorText: {
    ...Typography.caption,
    color: Colors.error,
  },
  input: {
    ...Typography.bodyLarge,
    flex: 1,
    color: Colors.textPrimary,
    paddingVertical: Spacing.md,
    padding: 0,
  },
  right: { marginLeft: Spacing.xs },
});

function presentAuthError(error: unknown, fallback: string): string {
  return presentUserError(error, fallback);
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginScreen
// ─────────────────────────────────────────────────────────────────────────────

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const authenticate = useAuthStore((state) => state.authenticate);
  const { toastConfig, showToast, hideToast } = useToast();
  const reduceMotion = useReducedMotionPreference();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<AuthValidationErrors>({});

  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: reduceMotion ? 0 : MotionDuration.normal,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: reduceMotion ? 0 : MotionDuration.slow,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [fadeAnim, reduceMotion, slideAnim]);

  const handleLogin = async () => {
    const validationErrors = validateLoginInput(email, password);
    setErrors(validationErrors);
    if (hasAuthValidationErrors(validationErrors)) {
      showToast('Revisa los campos indicados para continuar.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      await authenticate(email.trim(), password);
    } catch (error: unknown) {
      showToast(
        presentAuthError(error, 'No pudimos iniciar sesión. Verifica tus credenciales.'),
        'error'
      );
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
            <BrandLogo size="hero" variant="negative" />
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
                onChangeText={(v) => { setEmail(v); setErrors((current) => ({ ...current, email: undefined })); }}
                keyboardType="email-address"
                autoComplete="email"
                accessibilityLabel="Correo electrónico"
                errorMessage={errors.email}
              />
              <Field
                icon={LockKeyhole}
                label="Contraseña"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((current) => ({ ...current, password: undefined })); }}
                secureTextEntry={!showPass}
                accessibilityLabel="Contraseña"
                errorMessage={errors.password}
                rightElement={
                  <TouchableOpacity
                    onPress={() => setShowPass((v) => !v)}
                    style={styles.fieldAction}
                    accessibilityRole="button"
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

            <AppButton
              label="Ingresar"
              onPress={() => void handleLogin()}
              isLoading={isLoading}
              fullWidth
              size="lg"
              accessibilityLabel="Iniciar sesión"
              icon={<ArrowRight size={IconSize.action} strokeWidth={IconStroke.emphasized} color={Colors.textInverse} />}
            />

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
  const navigation = useNavigation<AppNavigation>();
  const registerAccount = useAuthStore((state) => state.registerAccount);
  const { toastConfig, showToast, hideToast } = useToast();
  const reduceMotion = useReducedMotionPreference();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState<'patient' | 'psychologist'>('patient');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<AuthValidationErrors>({});

  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: reduceMotion ? 0 : MotionDuration.normal,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: reduceMotion ? 0 : MotionDuration.slow,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [fadeAnim, reduceMotion, slideAnim]);

  const handleRegister = async () => {
    const normalizedLicenseNumber = licenseNumber.trim();
    const validationErrors = validateRegistrationInput({
      name,
      email,
      password,
      role,
      licenseNumber,
    });
    setErrors(validationErrors);
    if (hasAuthValidationErrors(validationErrors)) {
      showToast('Revisa los campos indicados para crear tu cuenta.', 'warning');
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
    } catch (error: unknown) {
      showToast(
        presentAuthError(error, 'No pudimos crear tu cuenta. Intenta nuevamente.'),
        'error'
      );
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
            <BrandLogo size="hero" variant="negative" />
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
                  onPress={() => {
                    setRole(r);
                    setErrors((current) => ({ ...current, licenseNumber: undefined }));
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={r === 'patient' ? 'Soy paciente' : 'Soy psicólogo'}
                  accessibilityState={{ checked: role === r }}
                  aria-checked={role === r}
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
                onChangeText={(v) => { setName(v); setErrors((current) => ({ ...current, name: undefined })); }}
                autoCapitalize="words"
                autoComplete="name"
                accessibilityLabel="Nombre completo"
                errorMessage={errors.name}
              />
              <Field
                icon={Mail}
                label="Correo electrónico"
                placeholder="nombre@correo.com"
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors((current) => ({ ...current, email: undefined })); }}
                keyboardType="email-address"
                autoComplete="email"
                accessibilityLabel="Correo electrónico"
                errorMessage={errors.email}
              />
              <Field
                icon={LockKeyhole}
                label="Contraseña"
                placeholder={`Mínimo ${MINIMUM_PASSWORD_LENGTH} caracteres`}
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((current) => ({ ...current, password: undefined })); }}
                secureTextEntry={!showPass}
                accessibilityLabel="Contraseña"
                errorMessage={errors.password}
                rightElement={
                  <TouchableOpacity
                    onPress={() => setShowPass((value) => !value)}
                    style={styles.fieldAction}
                    accessibilityRole="button"
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

            {/* Conditional MINSA License field for psychologists */}
            {role === 'psychologist' && (
              <View style={styles.fields}>
                <Field
                  icon={BadgeCheck}
                  label="Colegiatura MINSA"
                  placeholder="Ejemplo: MINSA-1234"
                  value={licenseNumber}
                  onChangeText={(v) => { setLicenseNumber(v); setErrors((current) => ({ ...current, licenseNumber: undefined })); }}
                  accessibilityLabel="Número de colegiatura MINSA"
                  errorMessage={errors.licenseNumber}
                />
              </View>
            )}

            <AppButton
              label="Crear cuenta"
              onPress={() => void handleRegister()}
              isLoading={isLoading}
              fullWidth
              size="lg"
              icon={<ArrowRight size={IconSize.action} strokeWidth={IconStroke.emphasized} color={Colors.textInverse} />}
            />

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
