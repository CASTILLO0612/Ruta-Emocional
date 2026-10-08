import {
  GoogleIdentityProviderError,
  mapGoogleIdentityProviderError,
} from '../../services/googleIdentityProvider';

describe('Google identity provider errors', () => {
  it.each([
    [
      'DEVELOPER_ERROR',
      'CONFIGURATION',
      'Esta versión no coincide con la configuración de Google. Actualiza la app o solicita soporte.',
    ],
    [
      'PLAY_SERVICES_NOT_AVAILABLE',
      'PLAY_SERVICES',
      'Actualiza los Servicios de Google Play para continuar con Google.',
    ],
    [
      'IN_PROGRESS',
      'IN_PROGRESS',
      'Ya hay un acceso con Google en curso. Espera un momento e inténtalo nuevamente.',
    ],
    [
      'SIGN_IN_CANCELLED',
      'CANCELLED',
      'Cancelaste el acceso con Google.',
    ],
  ] as const)(
    'convierte %s en un error seguro y accionable',
    (nativeCode, expectedCode, expectedMessage) => {
      const result = mapGoogleIdentityProviderError({
        code: nativeCode,
        message: 'detalle nativo que no debe llegar a la interfaz',
      });

      expect(result).toBeInstanceOf(GoogleIdentityProviderError);
      expect(result.code).toBe(expectedCode);
      expect(result.message).toBe(expectedMessage);
    }
  );

  it('oculta mensajes técnicos desconocidos', () => {
    const result = mapGoogleIdentityProviderError(
      new Error('ApiException: 10, DEVELOPER_ERROR at NativeGoogleSignIn')
    );

    expect(result.code).toBe('FAILED');
    expect(result.message).toBe('No pudimos completar el acceso con Google.');
  });
});
