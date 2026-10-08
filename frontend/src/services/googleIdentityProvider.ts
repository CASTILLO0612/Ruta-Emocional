import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { getGoogleWebClientId } from '../config/runtimeConfig';
import { GoogleWebIdentityError, requestGoogleWebIdToken } from './googleIdentityWeb';

export class GoogleIdentityProviderError extends Error {
  constructor(
    public readonly code:
      | 'UNAVAILABLE'
      | 'CANCELLED'
      | 'CONFIGURATION'
      | 'PLAY_SERVICES'
      | 'IN_PROGRESS'
      | 'FAILED',
    message: string
  ) {
    super(message);
    this.name = 'GoogleIdentityProviderError';
  }
}

function nativeErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

export function mapGoogleIdentityProviderError(error: unknown): GoogleIdentityProviderError {
  const code = nativeErrorCode(error);

  if (code === 'SIGN_IN_CANCELLED') {
    return new GoogleIdentityProviderError('CANCELLED', 'Cancelaste el acceso con Google.');
  }
  if (code === 'DEVELOPER_ERROR') {
    return new GoogleIdentityProviderError(
      'CONFIGURATION',
      'Esta versión no coincide con la configuración de Google. Actualiza la app o solicita soporte.'
    );
  }
  if (code === 'PLAY_SERVICES_NOT_AVAILABLE') {
    return new GoogleIdentityProviderError(
      'PLAY_SERVICES',
      'Actualiza los Servicios de Google Play para continuar con Google.'
    );
  }
  if (code === 'IN_PROGRESS') {
    return new GoogleIdentityProviderError(
      'IN_PROGRESS',
      'Ya hay un acceso con Google en curso. Espera un momento e inténtalo nuevamente.'
    );
  }

  return new GoogleIdentityProviderError(
    'FAILED',
    'No pudimos completar el acceso con Google.'
  );
}

export async function requestGoogleIdToken(): Promise<string> {
  if (Platform.OS === 'web') {
    try {
      return await requestGoogleWebIdToken();
    } catch (error) {
      if (error instanceof GoogleWebIdentityError && error.code === 'CANCELLED') {
        throw new GoogleIdentityProviderError('CANCELLED', error.message);
      }
      if (error instanceof GoogleWebIdentityError) {
        throw new GoogleIdentityProviderError('FAILED', error.message);
      }
      throw new GoogleIdentityProviderError('FAILED', 'No pudimos completar el acceso con Google.');
    }
  }
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    throw new GoogleIdentityProviderError(
      'UNAVAILABLE',
      'El acceso con Google requiere la versión de desarrollo de Ruta Emocional.'
    );
  }

  try {
    const google = await import('react-native-nitro-google-signin');
    google.GoogleOneTapSignIn.configure({
      webClientId: getGoogleWebClientId(),
      offlineAccess: false,
      autoSelectOnSignIn: false,
    });
    await google.GoogleOneTapSignIn.checkPlayServices();
    let response = await google.GoogleOneTapSignIn.signIn();
    if (google.isNoSavedCredentialFoundResponse(response)) {
      response = await google.GoogleOneTapSignIn.createAccount();
    }
    if (google.isNoSavedCredentialFoundResponse(response)) {
      response = await google.GoogleOneTapSignIn.presentExplicitSignIn();
    }
    if (google.isCancelledResponse(response)) {
      throw new GoogleIdentityProviderError('CANCELLED', 'Cancelaste el acceso con Google.');
    }
    if (!google.isSuccessResponse(response) || !response.data.idToken) {
      throw new GoogleIdentityProviderError(
        'FAILED',
        'No pudimos completar el acceso con Google.'
      );
    }
    return response.data.idToken;
  } catch (error) {
    if (error instanceof GoogleIdentityProviderError) throw error;
    if (__DEV__) {
      console.warn('[GoogleAuth] Native sign-in failed.', {
        code: nativeErrorCode(error) ?? 'UNKNOWN',
      });
    }
    throw mapGoogleIdentityProviderError(error);
  }
}
