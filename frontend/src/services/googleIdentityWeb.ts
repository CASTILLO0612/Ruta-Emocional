import { getGoogleWebClientId } from '../config/runtimeConfig';

interface GoogleCredentialResponse {
  readonly credential?: string;
}

interface GooglePromptMomentNotification {
  readonly isNotDisplayed?: () => boolean;
  readonly isSkippedMoment?: () => boolean;
}

interface GoogleIdentityApi {
  readonly accounts: {
    readonly id: {
      readonly initialize: (input: {
        readonly client_id: string;
        readonly callback: (response: GoogleCredentialResponse) => void;
        readonly auto_select: boolean;
        readonly cancel_on_tap_outside: boolean;
        readonly context: 'signin';
      }) => void;
      readonly prompt: (
        listener: (notification: GooglePromptMomentNotification) => void
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services';
const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
let googleIdentityLoader: Promise<GoogleIdentityApi> | null = null;

export class GoogleWebIdentityError extends Error {
  constructor(public readonly code: 'CANCELLED' | 'FAILED', message: string) {
    super(message);
    this.name = 'GoogleWebIdentityError';
  }
}

function resolveLoadedApi(): GoogleIdentityApi | null {
  if (typeof window === 'undefined') return null;
  return window.google ?? null;
}

function loadGoogleIdentityApi(): Promise<GoogleIdentityApi> {
  const loadedApi = resolveLoadedApi();
  if (loadedApi) return Promise.resolve(loadedApi);
  if (googleIdentityLoader) return googleIdentityLoader;

  googleIdentityLoader = new Promise<GoogleIdentityApi>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new GoogleWebIdentityError('FAILED', 'Google no está disponible en este navegador.'));
      return;
    }

    const complete = () => {
      const api = resolveLoadedApi();
      if (api) {
        resolve(api);
        return;
      }
      googleIdentityLoader = null;
      reject(new GoogleWebIdentityError(
        'FAILED',
        'No pudimos cargar el acceso con Google. Revisa tu conexión e inténtalo nuevamente.'
      ));
    };

    const existingScript = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener('load', complete, { once: true });
      existingScript.addEventListener('error', complete, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = GOOGLE_IDENTITY_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', complete, { once: true });
    script.addEventListener('error', complete, { once: true });
    document.head.appendChild(script);
  });

  return googleIdentityLoader;
}

export async function requestGoogleWebIdToken(): Promise<string> {
  const google = await loadGoogleIdentityApi();
  return new Promise<string>((resolve, reject) => {
    let completed = false;
    const finish = (result: { readonly token: string } | { readonly error: GoogleWebIdentityError }) => {
      if (completed) return;
      completed = true;
      if ('token' in result) resolve(result.token);
      else reject(result.error);
    };

    google.accounts.id.initialize({
      client_id: getGoogleWebClientId(),
      auto_select: false,
      cancel_on_tap_outside: true,
      context: 'signin',
      callback: ({ credential }) => {
        if (credential) {
          finish({ token: credential });
          return;
        }
        finish({
          error: new GoogleWebIdentityError(
            'FAILED',
            'No pudimos validar tu cuenta de Google.'
          ),
        });
      },
    });

    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed?.()) {
        finish({
          error: new GoogleWebIdentityError(
            'FAILED',
            'El navegador bloqueó el acceso con Google. Habilita las ventanas de autenticación e inténtalo nuevamente.'
          ),
        });
        return;
      }
      if (notification.isSkippedMoment?.()) {
        finish({
          error: new GoogleWebIdentityError('CANCELLED', 'Cancelaste el acceso con Google.'),
        });
      }
    });
  });
}
