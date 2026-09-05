import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowRight, CircleCheck, KeyRound, LockKeyhole, Mail } from 'lucide-react-native';
import { Eye, EyeOff } from 'lucide';

import { AuthField } from '../../components/auth/AuthField';
import { AuthLegalLinks } from '../../components/auth/AuthLegalLinks';
import { AuthShell } from '../../components/auth/AuthShell';
import { PasswordStrength } from '../../components/auth/PasswordStrength';
import { AppButton } from '../../components/common/AppButton';
import { AppMorphIcon } from '../../components/common/AppMorphIcon';
import { Toast, useToast } from '../../components/common/Toast';
import type { AuthNavigation, AuthStackParamList } from '../../navigation/navigationTypes';
import {
  completePasswordReset,
  requestPasswordReset,
  type PasswordResetDelivery,
} from '../../services/AuthService';
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
  validateNewPassword,
  validatePasswordResetRequest,
} from '../../utils/authValidation';
import { presentUserError } from '../../utils/userFacingError';

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

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const { toastConfig, showToast, hideToast } = useToast();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [delivery, setDelivery] = useState<PasswordResetDelivery>();
  const [localQaToken, setLocalQaToken] = useState<string>();

  const handleRequest = async () => {
    if (isLoading) return;
    const errors = validatePasswordResetRequest(email);
    setEmailError(errors.email);
    if (errors.email) return;

    setIsLoading(true);
    try {
      const result = await requestPasswordReset(email.trim());
      setDelivery(result.delivery);
      setLocalQaToken(result.localQaToken);
    } catch (error) {
      showToast(
        presentUserError(error, 'No pudimos iniciar la recuperación. Intenta nuevamente.'),
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (delivery) {
    const unavailable = delivery === 'UNAVAILABLE';
    return (
      <AuthShell
        title={unavailable ? 'Recuperación no disponible' : 'Revisa las instrucciones'}
        subtitle={unavailable
          ? 'El envío de recuperación aún no está configurado en este entorno.'
          : 'Si la cuenta existe, preparamos una forma segura de recuperar el acceso.'}
        onBack={() => navigation.goBack()}
        footer={<AuthLegalLinks navigation={navigation} />}
      >
        <View style={[styles.statusPanel, unavailable && styles.statusPanelWarning]} accessible>
          <CircleCheck
            size={IconSize.state}
            strokeWidth={IconStroke.regular}
            color={unavailable ? Colors.warning : Colors.success}
          />
          <Text style={styles.statusText}>
            {unavailable
              ? 'Puedes intentar más tarde o solicitar ayuda al equipo de Ruta Emocional.'
              : 'El enlace es personal, vence pronto y sólo puede utilizarse una vez.'}
          </Text>
        </View>

        {localQaToken ? (
          <AppButton
            label="Continuar prueba local"
            onPress={() => navigation.navigate('ResetPassword', { token: localQaToken })}
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
        ) : null}

        <AppButton
          label="Volver al inicio de sesión"
          variant="ghost"
          onPress={() => navigation.navigate('Login')}
          fullWidth
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Recuperar acceso"
      subtitle="Escribe el correo asociado a tu cuenta."
      onBack={() => navigation.goBack()}
      footer={<AuthLegalLinks navigation={navigation} />}
      overlay={<Toast {...toastConfig} onHide={hideToast} />}
    >
      <AuthField
        icon={Mail}
        label="Correo electrónico"
        placeholder="nombre@correo.com"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setEmailError(undefined);
        }}
        keyboardType="email-address"
        autoComplete="email"
        errorMessage={emailError}
        valid={email.length > 0 && isValidEmail(email)}
        disabled={isLoading}
        returnKeyType="done"
        onSubmitEditing={() => void handleRequest()}
      />
      <AppButton
        label="Enviar instrucciones"
        loadingLabel="Preparando recuperación"
        onPress={() => void handleRequest()}
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
      <Text style={styles.privacyCopy}>
        Por seguridad, mostramos la misma respuesta exista o no una cuenta con ese correo.
      </Text>
    </AuthShell>
  );
};

export const ResetPasswordScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const route = useRoute<RouteProp<AuthStackParamList, 'ResetPassword'>>();
  const token = route.params?.token?.trim() ?? '';
  const { toastConfig, showToast, hideToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [errors, setErrors] = useState<AuthValidationErrors>({});

  const handleComplete = async () => {
    if (isLoading || !token) return;
    const validationErrors = validateNewPassword(password, confirmation);
    setErrors(validationErrors);
    if (hasAuthValidationErrors(validationErrors)) return;

    setIsLoading(true);
    try {
      await completePasswordReset(token, password);
      setCompleted(true);
    } catch (error) {
      showToast(
        presentUserError(error, 'No pudimos cambiar la contraseña. Solicita un enlace nuevo.'),
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell
        title="Enlace no válido"
        subtitle="Solicita nuevamente la recuperación para continuar."
        onBack={() => navigation.navigate('Login')}
      >
        <AppButton
          label="Solicitar un enlace nuevo"
          onPress={() => navigation.navigate('ForgotPassword')}
          fullWidth
          size="lg"
        />
      </AuthShell>
    );
  }

  if (completed) {
    return (
      <AuthShell
        title="Contraseña actualizada"
        subtitle="Tu cuenta está lista para volver a ingresar."
      >
        <View style={styles.completedIcon} accessible accessibilityLabel="Contraseña actualizada">
          <CircleCheck
            size={IconSize.state}
            strokeWidth={IconStroke.emphasized}
            color={Colors.success}
          />
        </View>
        <AppButton
          label="Iniciar sesión"
          onPress={() => navigation.navigate('Login')}
          fullWidth
          size="lg"
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Nueva contraseña"
      subtitle="Crea una clave que no utilices en otros servicios."
      onBack={() => navigation.navigate('Login')}
      overlay={<Toast {...toastConfig} onHide={hideToast} />}
    >
      <View style={styles.fields}>
        <View style={styles.passwordGroup}>
          <AuthField
            icon={KeyRound}
            label="Nueva contraseña"
            placeholder={`Mínimo ${MINIMUM_PASSWORD_LENGTH} caracteres`}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
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
        <AuthField
          icon={LockKeyhole}
          label="Confirmar contraseña"
          placeholder="Repite tu nueva contraseña"
          value={confirmation}
          onChangeText={(value) => {
            setConfirmation(value);
            setErrors((current) => ({ ...current, passwordConfirmation: undefined }));
          }}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          errorMessage={errors.passwordConfirmation}
          valid={confirmation.length >= MINIMUM_PASSWORD_LENGTH && confirmation === password}
          disabled={isLoading}
          returnKeyType="done"
          onSubmitEditing={() => void handleComplete()}
        />
      </View>
      <AppButton
        label="Guardar contraseña"
        loadingLabel="Actualizando contraseña"
        onPress={() => void handleComplete()}
        isLoading={isLoading}
        fullWidth
        size="lg"
      />
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  fields: { gap: Spacing.lg },
  passwordGroup: { gap: Spacing.sm },
  fieldAction: {
    width: Layout.minimumTouchTarget,
    height: Layout.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -Spacing.sm,
    marginRight: -Spacing.md,
  },
  statusPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.successSurface,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  statusPanelWarning: { backgroundColor: Colors.warningSurface, borderColor: Colors.warningBorder },
  statusText: { ...Typography.bodySmall, flex: 1, color: Colors.textSecondary },
  privacyCopy: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center' },
  completedIcon: {
    width: 72,
    height: 72,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.successSurface,
  },
});
