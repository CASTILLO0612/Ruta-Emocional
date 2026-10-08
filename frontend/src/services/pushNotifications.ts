import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Colors } from '../theme/colors';
import { apiV1Request } from './apiClient';

const INSTALLATION_ID_KEY = 'ruta-emocional.push-installation-id.v1';
const KEYCHAIN_SERVICE = 'ruta-emocional.notifications';
const CHANNEL_ID = 'ruta-emocional';

export type PushNavigationData =
  | { readonly kind: 'MESSAGE'; readonly conversationId: string }
  | { readonly kind: 'CALL'; readonly callId: string; readonly conversationId: string; readonly mediaType: 'AUDIO' | 'VIDEO' }
  | { readonly kind: 'APPOINTMENT'; readonly appointmentId: string }
  | { readonly kind: 'VERIFICATION' };

function isNative(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

function projectId(): string | null {
  return Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId
    ?? null;
}

async function installationId(): Promise<string> {
  const options: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    keychainService: KEYCHAIN_SERVICE,
  };
  const stored = await SecureStore.getItemAsync(INSTALLATION_ID_KEY, options);
  if (stored) return stored;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, created, options);
  return created;
}

export async function synchronizePushDevice(): Promise<boolean> {
  if (!isNative() || !Device.isDevice) return false;
  const easProjectId = projectId();
  if (!easProjectId) return false;
  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Ruta Emocional',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: Colors.primary,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return false;
  const token = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId });
  await apiV1Request('/notifications/devices/current', 'PUT', {
    installationId: await installationId(),
    expoPushToken: token.data,
    platform: Platform.OS === 'android' ? 'ANDROID' : 'IOS',
  });
  return true;
}

export async function deactivateCurrentPushDevice(): Promise<void> {
  if (!isNative()) return;
  const options: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    keychainService: KEYCHAIN_SERVICE,
  };
  const currentInstallationId = await SecureStore.getItemAsync(INSTALLATION_ID_KEY, options);
  if (!currentInstallationId) return;
  await apiV1Request(`/notifications/devices/${currentInstallationId}`, 'DELETE');
}

export function readPushNavigationData(data: Record<string, unknown>): PushNavigationData | null {
  if (data.kind === 'MESSAGE' && typeof data.conversationId === 'string') {
    return { kind: 'MESSAGE', conversationId: data.conversationId };
  }
  if (
    data.kind === 'CALL'
    && typeof data.callId === 'string'
    && typeof data.conversationId === 'string'
    && (data.mediaType === 'AUDIO' || data.mediaType === 'VIDEO')
  ) {
    return {
      kind: 'CALL',
      callId: data.callId,
      conversationId: data.conversationId,
      mediaType: data.mediaType,
    };
  }
  if (data.kind === 'APPOINTMENT' && typeof data.appointmentId === 'string') {
    return { kind: 'APPOINTMENT', appointmentId: data.appointmentId };
  }
  if (data.kind === 'VERIFICATION') return { kind: 'VERIFICATION' };
  return null;
}

export async function configurePushPresentation(): Promise<void> {
  if (!isNative()) return;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function listenForPushNavigation(
  onOpen: (data: PushNavigationData) => void
): Promise<() => void> {
  if (!isNative()) return () => undefined;
  const Notifications = await import('expo-notifications');
  const handle = (response: import('expo-notifications').NotificationResponse) => {
    const data = readPushNavigationData(response.notification.request.content.data ?? {});
    if (data) onOpen(data);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  const initial = await Notifications.getLastNotificationResponseAsync();
  if (initial) handle(initial);
  return () => subscription.remove();
}
