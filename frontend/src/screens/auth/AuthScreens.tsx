import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowRight,
  BadgeCheck,
  HeartHandshake,
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-react-native';
import { Eye, EyeOff } from 'lucide';

import { AuthField } from '../../components/auth/AuthField';
import { AuthLegalLinks } from '../../components/auth/AuthLegalLinks';
import { AuthShell } from '../../components/auth/AuthShell';
import { GoogleLogo } from '../../components/auth/GoogleLogo';
import { PasswordStrength } from '../../components/auth/PasswordStrength';
import { AppButton } from '../../components/common/AppButton';
import { AppMorphIcon } from '../../components/common/AppMorphIcon';
import { Toast, useToast } from '../../components/common/Toast';
import type { AuthNavigation } from '../../navigation/navigationTypes';
import { PSYCHOLOGIST_LICENSE_AUTHORITY } from '../../services/AuthService';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { Layout } from '../../theme/layout';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import {
  AuthValidationErrors,
  hasAuthValidationErrors,
  isValidEmail,
  MINIMUM_PASSWORD_LENGTH,
  validateLoginInput,
  validateRegistrationInput,
} from '../../utils/authValidation';
import { presentUserError } from '../../utils/userFacingError';
import { ApiError } from '../../services/apiClient';
import { requestGoogleIdToken } from '../../services/googleIdentityProvider';

const AuthFooter: React.FC<{ navigation: AuthNavigation }> = ({ navigation }) => (
  <AuthLegalLinks navigation={navigation} />
);

const PasswordVisibilityButton: React.FC<{
  readonly visible: boolean;
  readonly onPress: () => void;
}> = ({ visible, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.fieldAction}
    accessibilityRole="button"
    accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
  >
    <AppMorphIcon
      icon={visible ? EyeOff : Eye}
      size={IconSize.action}
      strokeWidth={IconStroke.regular}
      color={Colors.textTertiary}
    />
  </TouchableOpacity>
);

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const authenticate = useAuthStore((state) => state.authenticate);
  const authenticateWithGoogle = useAuthStore((state) => state.authenticateWithGoogle);
  const { toastConfig, showToast, hideToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<AuthValidationErrors>({});
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleRole, setGoogleRole] = useState<'patient' | 'psychologist'>('patient');
  const [googleLicense, setGoogleLicense] = useState('');

  const handleLogin = async () => {
    if (isLoading) return;
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
        presentUserError(error, 'No pudimos iniciar sesión. Revisa tus datos e intenta nuevamente.'),
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const idToken = await requestGoogleIdToken();
      try {
        await authenticateWithGoogle(idToken);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'REGISTRATION_ROLE_REQUIRED') {
          setGoogleToken(idToken);
          return;
        }
        throw error;
      }
    } catch (error) {
      showToast(presentUserError(error, 'No pudimos completar el acceso con Google.'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const completeGoogleRegistration = async () => {
    if (!googleToken || isLoading) return;
    if (googleRole === 'psychologist' && googleLicense.trim().length < 4) {
      showToast('Ingresa tu número de licencia profesional para continuar.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      await authenticateWithGoogle(googleToken, googleRole, googleLicense.trim());
      setGoogleToken(null);
    } catch (error) {
      showToast(presentUserError(error, 'No pudimos crear tu cuenta con Google.'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Inicia sesión"
      footer={<AuthFooter navigation={navigation} />}
      overlay={<Toast {...toastConfig} onHide={hideToast} />}
    >
      <View style={styles.fields}>
        <AuthField
          icon={Mail}
          label="Correo electrónico"
          placeholder="nombre@correo.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          keyboardType="email-address"
          autoComplete="email"
          errorMessage={errors.email}
          valid={email.length > 0 && isValidEmail(email)}
          disabled={isLoading}
          returnKeyType="next"
        />
        <View style={styles.passwordGroup}>
          <AuthField
            icon={LockKeyhole}
            label="Contraseña"
            placeholder="Ingresa tu contraseña"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            secureTextEntry={!showPassword}
            autoComplete="password"
            errorMessage={errors.password}
            disabled={isLoading}
            returnKeyType="done"
            onSubmitEditing={() => void handleLogin()}
            rightElement={(
              <PasswordVisibilityButton
                visible={showPassword}
                onPress={() => setShowPassword((current) => !current)}
              />
            )}
          />
          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => navigation.navigate('ForgotPassword')}
            accessibilityRole="link"
            accessibilityLabel="Recuperar contraseña"
            disabled={isLoading}
          >
            <Text style={styles.linkText}>Olvidé mi contraseña</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AppButton
        label="Iniciar sesión"
        loadingLabel="Iniciando sesión"
        onPress={() => void handleLogin()}
        isLoading={isLoading}
        fullWidth
        size="lg"
      />

      <View style={styles.authDivider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>o</Text>
        <View style={styles.dividerLine} />
      </View>

      <AppButton
        label="Continuar con Google"
        onPress={() => void handleGoogleLogin()}
        variant="google"
        fullWidth
        size="lg"
        disabled={isLoading}
        icon={<GoogleLogo />}
        accessibilityLabel="Continuar con Google"
      />

      <View style={styles.accountPrompt}>
        <Text style={styles.secondaryText}>¿No tienes cuenta?</Text>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => navigation.navigate('Register')}
          accessibilityRole="link"
          accessibilityLabel="Crear cuenta"
          disabled={isLoading}
        >
          <Text style={styles.linkText}>Crear cuenta</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={googleToken !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setGoogleToken(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.roleModal}>
            <Text style={styles.roleModalTitle}>Completa tu cuenta</Text>
            <Text style={styles.roleModalText}>Selecciona cómo utilizarás Ruta Emocional.</Text>
            <View style={styles.roleRow}>
              <RoleOption
                active={googleRole === 'patient'}
                icon={UserRound}
                title="Paciente"
                description="Busco apoyo"
                onPress={() => setGoogleRole('patient')}
              />
              <RoleOption
                active={googleRole === 'psychologist'}
                icon={HeartHandshake}
                title="Psicólogo"
                description="Ofrezco atención"
                onPress={() => setGoogleRole('psychologist')}
              />
            </View>
            {googleRole === 'psychologist' ? (
              <View style={styles.googleLicenseGroup}>
                <Text style={styles.sectionLabel}>Licencia MINSA</Text>
                <TextInput
                  value={googleLicense}
                  onChangeText={setGoogleLicense}
                  placeholder="Número de licencia"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="characters"
                  style={styles.googleLicenseInput}
                  accessibilityLabel="Número de licencia profesional"
                />
              </View>
            ) : null}
            <AppButton
              label="Crear cuenta"
              loadingLabel="Creando cuenta"
              onPress={() => void completeGoogleRegistration()}
              isLoading={isLoading}
              fullWidth
            />
            <AppButton
              label="Cancelar"
              onPress={() => setGoogleToken(null)}
              variant="ghost"
              fullWidth
              disabled={isLoading}
            />
          </View>
        </View>
      </Modal>

    </AuthShell>
  );
};

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const registerAccount = useAuthStore((state) => state.registerAccount);
  const { toastConfig, showToast, hideToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'patient' | 'psychologist'>('patient');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<AuthValidationErrors>({});

  const handleRegister = async () => {
    if (isLoading) return;
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
        presentUserError(error, 'No pudimos crear tu cuenta. Intenta nuevamente.'),
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title={role === 'psychologist' ? 'Crear cuenta profesional' : 'Crear cuenta'}
      subtitle={role === 'psychologist'
        ? 'Verificaremos tu perfil antes de habilitar la atención.'
        : 'Empieza tu ruta con un espacio personal.'}
      onBack={() => navigation.goBack()}
      footer={<AuthFooter navigation={navigation} />}
      overlay={<Toast {...toastConfig} onHide={hideToast} />}
    >
      <View style={styles.roleSection} accessibilityRole="radiogroup">
        <Text style={styles.sectionLabel}>¿Cómo usarás Ruta Emocional?</Text>
        <View style={styles.roleRow}>
          <RoleOption
            active={role === 'patient'}
            icon={UserRound}
            title="Paciente"
            description="Busco apoyo"
            onPress={() => {
              setRole('patient');
              setErrors((current) => ({ ...current, licenseNumber: undefined }));
            }}
          />
          <RoleOption
            active={role === 'psychologist'}
            icon={HeartHandshake}
            title="Psicólogo"
            description="Ofrezco atención"
            onPress={() => setRole('psychologist')}
          />
        </View>
      </View>

      <View style={styles.fields}>
        <AuthField
          icon={UserRound}
          label="Nombre completo"
          placeholder="Escribe tu nombre"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setErrors((current) => ({ ...current, name: undefined }));
          }}
          autoCapitalize="words"
          autoComplete="name"
          errorMessage={errors.name}
          valid={name.trim().length >= 2}
          disabled={isLoading}
        />
        <AuthField
          icon={Mail}
          label="Correo electrónico"
          placeholder="nombre@correo.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          keyboardType="email-address"
          autoComplete="email"
          errorMessage={errors.email}
          valid={email.length > 0 && isValidEmail(email)}
          disabled={isLoading}
        />
        <View style={styles.passwordGroup}>
          <AuthField
            icon={LockKeyhole}
            label="Contraseña"
            placeholder={`Mínimo ${MINIMUM_PASSWORD_LENGTH} caracteres`}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            secureTextEntry={!showPassword}
            autoComplete="password"
            errorMessage={errors.password}
            helperText={`Usa al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`}
            disabled={isLoading}
            rightElement={(
              <PasswordVisibilityButton
                visible={showPassword}
                onPress={() => setShowPassword((current) => !current)}
              />
            )}
          />
          <PasswordStrength password={password} />
        </View>
        {role === 'psychologist' ? (
          <AuthField
            icon={BadgeCheck}
            label="Registro profesional MINSA"
            placeholder="Ejemplo: MINSA-1234"
            value={licenseNumber}
            onChangeText={(value) => {
              setLicenseNumber(value);
              setErrors((current) => ({ ...current, licenseNumber: undefined }));
            }}
            errorMessage={errors.licenseNumber}
            helperText="Después podrás enviar la evidencia para revisión."
            valid={licenseNumber.trim().length >= 4}
            disabled={isLoading}
          />
        ) : null}
      </View>

      <AppButton
        label={role === 'psychologist' ? 'Crear cuenta profesional' : 'Crear cuenta'}
        loadingLabel="Creando cuenta"
        onPress={() => void handleRegister()}
        isLoading={isLoading}
        fullWidth
        size="lg"
        icon={(
          <ArrowRight
            size={IconSize.action}
            strokeWidth={IconStroke.emphasized}
            color={Colors.textInverse}
          />
        )}
      />

      <Text style={styles.legalNotice}>
        Antes de crear tu cuenta, consulta nuestros{' '}
        <Text
          style={styles.inlineLink}
          onPress={() => navigation.navigate('LegalInformation', { section: 'terms' })}
          accessibilityRole="link"
        >
          Términos
        </Text>
        {' '}y la información de{' '}
        <Text
          style={styles.inlineLink}
          onPress={() => navigation.navigate('LegalInformation', { section: 'privacy' })}
          accessibilityRole="link"
        >
          Privacidad
        </Text>
        .
      </Text>

      <View style={styles.accountPrompt}>
        <Text style={styles.secondaryText}>¿Ya tienes cuenta?</Text>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => navigation.navigate('Login')}
          accessibilityRole="link"
          accessibilityLabel="Iniciar sesión"
          disabled={isLoading}
        >
          <Text style={styles.linkText}>Iniciar sesión</Text>
        </TouchableOpacity>
      </View>

    </AuthShell>
  );
};

interface RoleOptionProps {
  readonly active: boolean;
  readonly icon: typeof UserRound;
  readonly title: string;
  readonly description: string;
  readonly onPress: () => void;
}

const RoleOption: React.FC<RoleOptionProps> = ({
  active,
  icon: RoleIcon,
  title,
  description,
  onPress,
}) => (
  <TouchableOpacity
    style={[styles.roleOption, active && styles.roleOptionActive]}
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ checked: active }}
    aria-checked={active}
    accessibilityLabel={`${title}. ${description}`}
  >
    <RoleIcon
      size={IconSize.action}
      strokeWidth={active ? IconStroke.emphasized : IconStroke.regular}
      color={active ? Colors.primary : Colors.textTertiary}
    />
    <View style={styles.roleCopy}>
      <Text style={[styles.roleTitle, active && styles.roleTitleActive]}>{title}</Text>
      <Text style={styles.roleDescription}>{description}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  fields: { gap: Spacing.base },
  passwordGroup: { gap: Spacing.sm },
  fieldAction: {
    width: Layout.minimumTouchTarget,
    height: Layout.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -Spacing.sm,
    marginRight: -Spacing.md,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    minHeight: Layout.minimumTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    marginTop: -Spacing.xs,
  },
  linkText: { ...Typography.bodySmall, fontFamily: FontFamily.bodySemiBold, color: Colors.primary },
  accountPrompt: {
    minHeight: Layout.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  secondaryText: { ...Typography.bodySmall, color: Colors.textSecondary },
  secondaryAction: {
    minHeight: Layout.minimumTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  roleSection: { gap: Spacing.sm },
  sectionLabel: { ...Typography.bodySmall, fontFamily: FontFamily.bodySemiBold, color: Colors.textSecondary },
  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleOption: {
    flex: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  roleOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryTint },
  roleCopy: { flex: 1, gap: Spacing.xxs },
  roleTitle: { ...Typography.bodySmall, fontFamily: FontFamily.bodySemiBold, color: Colors.textPrimary },
  roleTitleActive: { color: Colors.primary },
  roleDescription: { ...Typography.caption, color: Colors.textTertiary },
  legalNotice: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center' },
  inlineLink: { color: Colors.primary, fontFamily: FontFamily.bodySemiBold },
  authDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.divider },
  dividerText: { ...Typography.caption, color: Colors.textTertiary },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.overlay,
  },
  roleModal: {
    gap: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
  },
  roleModalTitle: { ...Typography.h3, color: Colors.textPrimary },
  roleModalText: { ...Typography.body, color: Colors.textSecondary },
  googleLicenseGroup: { gap: Spacing.sm },
  googleLicenseInput: {
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    ...Typography.body,
    color: Colors.textPrimary,
  },
});
