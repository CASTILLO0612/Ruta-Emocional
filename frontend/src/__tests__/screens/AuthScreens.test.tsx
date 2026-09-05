import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { LoginScreen, RegisterScreen } from '../../screens/auth/AuthScreens';
import {
  ForgotPasswordScreen,
  ResetPasswordScreen,
} from '../../screens/auth/PasswordRecoveryScreens';
import { LegalInformationScreen } from '../../screens/auth/LegalInformationScreen';
import { completePasswordReset, requestPasswordReset } from '../../services/AuthService';
import { renderWithStackNavigation } from '../helpers/renderWithNavigation';

jest.mock('../../services/AuthService', () => ({
  ...jest.requireActual('../../services/AuthService'),
  requestPasswordReset: jest.fn(),
  completePasswordReset: jest.fn(),
}));

const requestPasswordResetMock = jest.mocked(requestPasswordReset);
const completePasswordResetMock = jest.mocked(completePasswordReset);

const authScreens = [
  { name: 'Login', component: LoginScreen },
  { name: 'Register', component: RegisterScreen },
  { name: 'ForgotPassword', component: ForgotPasswordScreen },
  { name: 'ResetPassword', component: ResetPasswordScreen },
  {
    name: 'LegalInformation',
    component: LegalInformationScreen,
    initialParams: { section: 'privacy' },
  },
] as const;

describe('Auth screens', () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
    completePasswordResetMock.mockReset();
  });

  it('presenta un acceso compacto con recuperación, confianza y enlaces informativos', async () => {
    const view = await renderWithStackNavigation({
      screens: authScreens,
      initialRouteName: 'Login',
    });

    expect(view.getByRole('image', { name: 'Ruta Emocional' })).toBeTruthy();
    expect(view.getByText('Bienvenido de vuelta')).toBeTruthy();
    expect(view.getByText('Continúa tu ruta de forma segura.')).toBeTruthy();
    expect(view.getByText('Acceso protegido a tu cuenta')).toBeTruthy();
    expect(view.getByText('¿Olvidaste tu contraseña?')).toBeTruthy();
    expect(view.getByText('Privacidad')).toBeTruthy();
    expect(view.getByText('Términos')).toBeTruthy();
    expect(view.getByText('Ayuda')).toBeTruthy();
  });

  it('explica cómo corregir campos inválidos sin consultar la red', async () => {
    const view = await renderWithStackNavigation({
      screens: authScreens,
      initialRouteName: 'Login',
    });

    await fireEvent.press(view.getByText('Iniciar sesión'));

    await waitFor(() => {
      expect(view.getByText('El correo es obligatorio.')).toBeTruthy();
      expect(view.getByText('La contraseña es obligatoria.')).toBeTruthy();
      expect(view.getByText('Revisa los campos indicados para continuar.')).toBeTruthy();
    });
  });

  it('diferencia el alta profesional y anticipa su verificación real', async () => {
    const view = await renderWithStackNavigation({
      screens: authScreens,
      initialRouteName: 'Register',
    });

    expect(view.getByText('Busco apoyo')).toBeTruthy();
    expect(view.getByText('Ofrezco atención')).toBeTruthy();
    await fireEvent.press(view.getByText('Psicólogo'));

    await waitFor(() => {
      expect(view.getAllByText('Crear cuenta profesional')).toHaveLength(2);
      expect(view.getByText('Verificaremos tu perfil antes de habilitar la atención.')).toBeTruthy();
      expect(view.getByText('Después podrás enviar la evidencia para revisión.')).toBeTruthy();
    });
  });

  it('valida el correo antes de iniciar una recuperación', async () => {
    const view = await renderWithStackNavigation({
      screens: authScreens,
      initialRouteName: 'ForgotPassword',
    });

    await fireEvent.changeText(view.getByLabelText('Correo electrónico'), 'correo-invalido');
    await fireEvent.press(view.getByText('Enviar instrucciones'));

    await waitFor(() => {
      expect(view.getByText('Escribe un correo electrónico válido.')).toBeTruthy();
    });
  });

  it('completa la recuperación local sin revelar datos de la cuenta', async () => {
    const localQaToken = 'local-qa-token-with-more-than-forty-characters-123';
    const nextPassword = 'NuevaClaveSegura123!';
    requestPasswordResetMock.mockResolvedValue({
      accepted: true,
      delivery: 'LOCAL_QA',
      localQaToken,
    });
    completePasswordResetMock.mockResolvedValue();

    const view = await renderWithStackNavigation({
      screens: authScreens,
      initialRouteName: 'ForgotPassword',
    });

    await fireEvent.changeText(view.getByLabelText('Correo electrónico'), 'persona@ruta.test');
    await fireEvent.press(view.getByText('Enviar instrucciones'));

    await waitFor(() => {
      expect(requestPasswordResetMock).toHaveBeenCalledWith('persona@ruta.test');
      expect(view.getByText('Continuar prueba local')).toBeTruthy();
    });

    await fireEvent.press(view.getByText('Continuar prueba local'));
    await fireEvent.changeText(view.getByLabelText('Nueva contraseña'), nextPassword);
    await fireEvent.changeText(view.getByLabelText('Confirmar contraseña'), nextPassword);
    await fireEvent.press(view.getByText('Guardar contraseña'));

    await waitFor(() => {
      expect(completePasswordResetMock).toHaveBeenCalledWith(localQaToken, nextPassword);
      expect(view.getByText('Contraseña actualizada')).toBeTruthy();
    });
  });
});
