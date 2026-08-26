import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
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
  icon: keyof typeof MaterialIcons.glyphMap;
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
  const underlineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(underlineAnim, {
      toValue: focused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [focused, underlineAnim]);

  const underlineColor = underlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, hasError ? Colors.error : Colors.primary],
  });

  return (
    <View style={fieldStyles.wrapper}>
      <MaterialIcons
        name={icon}
        size={18}
        color={focused ? Colors.primary : Colors.textTertiary}
        style={fieldStyles.icon}
      />
      <View style={fieldStyles.inputArea}>
        <TextInput
          style={[fieldStyles.input, hasError && fieldStyles.inputError]}
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
        <Animated.View style={[fieldStyles.underline, { backgroundColor: underlineColor }]} />
      </View>
      {rightElement && <View style={fieldStyles.right}>{rightElement}</View>}
    </View>
  );
};

const fieldStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  icon: { marginTop: 2 },
  inputArea: { flex: 1 },
  input: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
    padding: 0,
  },
  inputError: { color: Colors.error },
  underline: {
    height: 1.5,
    borderRadius: 1,
    marginTop: 2,
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
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
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
              <MaterialIcons name="favorite" size={26} color={Colors.accent} />
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
                icon="mail-outline"
                placeholder="Correo electrónico"
                value={email}
                onChangeText={(v) => { setEmail(v); setEmailError(false); }}
                keyboardType="email-address"
                autoComplete="email"
                accessibilityLabel="Email input"
                hasError={emailError}
              />
              <Field
                icon="lock-outline"
                placeholder="Contraseña"
                value={password}
                onChangeText={(v) => { setPassword(v); setPassError(false); }}
                secureTextEntry={!showPass}
                accessibilityLabel="Password input"
                hasError={passError}
                rightElement={
                  <TouchableOpacity
                    onPress={() => setShowPass((v) => !v)}
                    accessibilityLabel={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <MaterialIcons
                      name={showPass ? 'visibility-off' : 'visibility'}
                      size={18}
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
              accessibilityLabel="Login button"
              accessibilityRole="button"
            >
              {isLoading ? (
                <Text style={styles.primaryBtnText}>Verificando...</Text>
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Ingresar</Text>
                  <MaterialIcons name="arrow-forward" size={18} color={Colors.textInverse} />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchLink}
              onPress={() => navigation.navigate('Register')}
              accessibilityLabel="Go to register"
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
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
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
              <MaterialIcons name="favorite" size={26} color={Colors.accent} />
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
                  <MaterialIcons
                    name={r === 'patient' ? 'person-outline' : 'psychology'}
                    size={16}
                    color={role === r ? Colors.primary : Colors.textTertiary}
                  />
                  <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                    {r === 'patient' ? 'Paciente' : 'Psicólogo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.fields}>
              <Field
                icon="person-outline"
                placeholder="Nombre completo"
                value={name}
                onChangeText={(v) => { setName(v); setNameError(false); }}
                autoCapitalize="words"
                autoComplete="name"
                accessibilityLabel="Full name input"
                hasError={nameError}
              />
              <Field
                icon="mail-outline"
                placeholder="Correo electrónico"
                value={email}
                onChangeText={(v) => { setEmail(v); setEmailError(false); }}
                keyboardType="email-address"
                autoComplete="email"
                accessibilityLabel="Email input"
                hasError={emailError}
              />
              <Field
                icon="lock-outline"
                placeholder={`Contraseña (mín. ${MINIMUM_PASSWORD_LENGTH} caracteres)`}
                value={password}
                onChangeText={(v) => { setPassword(v); setPassError(false); }}
                secureTextEntry
                accessibilityLabel="Password input"
                hasError={passError}
              />
            </View>

            {/* Conditional MINSA License field for psychologists */}
            {role === 'psychologist' && (
              <View style={styles.fields}>
                <Field
                  icon="verified-user"
                  placeholder="Colegiatura MINSA (ej: MINSA-1234)"
                  value={licenseNumber}
                  onChangeText={(v) => { setLicenseNumber(v); setLicenseError(false); }}
                  accessibilityLabel="MINSA license number input"
                  hasError={licenseError}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}
              accessibilityLabel="Register button"
              accessibilityRole="button"
            >
              {isLoading ? (
                <Text style={styles.primaryBtnText}>Creando cuenta...</Text>
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Crear cuenta</Text>
                  <MaterialIcons name="arrow-forward" size={18} color={Colors.textInverse} />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchLink}
              onPress={() => navigation.navigate('Login')}
              accessibilityLabel="Go to login"
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
    paddingBottom: Spacing.xxl,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: Spacing.xs,
  },
  appName: {
    ...Typography.h1,
    color: Colors.textInverse,
    textAlign: 'center',
  },
  tagline: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },

  scrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  formContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
    gap: Spacing.lg,
    minHeight: 380,
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
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
  },
  roleChipActive: {
    backgroundColor: Colors.primaryFaded,
    borderColor: Colors.primary,
  },
  roleChipText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  roleChipTextActive: { color: Colors.primary },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.base + 2,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    ...Typography.button,
    color: Colors.textInverse,
    fontSize: 15,
  },

  switchLink: { alignItems: 'center', paddingVertical: Spacing.xs },
  switchText: { ...Typography.bodySmall, color: Colors.textSecondary },
  switchBold: { color: Colors.primary, fontWeight: '700' },
});
