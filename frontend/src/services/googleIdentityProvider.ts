import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { getGoogleWebClientId } from '../config/runtimeConfig';
import { requestGoogleWebIdToken } from './googleIdentityWeb';

export class GoogleIdentityProviderError extends Error {
  constructor(public readonly code: 'UNAVAILABLE' | 'CANCELLED' | 'FAILED', message: string) {
    super(message);
    this.name = 'GoogleIdentityProviderError';
  }
}

export async function requestGoogleIdToken(): Promise<string> {
  if (Platform.OS === 'web') {
    try {
      return await requestGoogleWebIdToken();
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'CANCELLED') {
        throw new GoogleIdentityProviderError('CANCELLED', error.message);
      }
      throw new GoogleIdentityProviderError(
        'FAILED',
        error instanceof Error
          ? error.message
          : 'No pudimos completar el acceso con Google.'
      );
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
    throw new GoogleIdentityProviderError(
      'FAILED',
      'No pudimos completar el acceso con Google.'
    );
  }
}
