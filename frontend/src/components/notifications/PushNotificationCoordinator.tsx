import React from 'react';
import { appNavigationRef } from '../../navigation/navigationRoot';
import {
  configurePushPresentation,
  listenForPushNavigation,
  PushNavigationData,
  synchronizePushDevice,
} from '../../services/pushNotifications';
import { useAuthStore } from '../../store/useAuthStore';
import { subscribeToIncomingCalls } from '../../services/socketClient';

interface PushNotificationCoordinatorProps {
  readonly navigationReady: boolean;
}

export const PushNotificationCoordinator: React.FC<PushNotificationCoordinatorProps> = ({
  navigationReady,
}) => {
  const userId = useAuthStore((state) => state.userProfile?.id ?? null);
  const role = useAuthStore((state) => state.role);
  const pending = React.useRef<PushNavigationData | null>(null);

  const navigate = React.useCallback((data: PushNavigationData) => {
    if (!navigationReady || !appNavigationRef.isReady()) {
      pending.current = data;
      return;
    }
    if (data.kind === 'MESSAGE') {
      appNavigationRef.navigate('Consultation', { conversationId: data.conversationId });
      return;
    }
    if (data.kind === 'CALL') {
      appNavigationRef.navigate('CallSession', {
        callId: data.callId,
        conversationId: data.conversationId,
        mediaType: data.mediaType,
        direction: 'INCOMING',
      });
      return;
    }
    if (data.kind === 'VERIFICATION') {
      appNavigationRef.navigate('PsychologistVerification');
      return;
    }
    if (role === 'psychologist') {
      appNavigationRef.navigate('PsychologistMain', { screen: 'History' });
    } else {
      appNavigationRef.navigate('PatientMain', { screen: 'Appointments' });
    }
  }, [navigationReady, role]);

  React.useEffect(() => {
    if (!userId) return;
    return subscribeToIncomingCalls((event) => navigate({
      kind: 'CALL',
      callId: event.callId,
      conversationId: event.conversationId,
      mediaType: event.mediaType,
    }));
  }, [navigate, userId]);

  React.useEffect(() => {
    void configurePushPresentation();
  }, []);

  React.useEffect(() => {
    if (!userId) return;
    void synchronizePushDevice().catch(() => undefined);
  }, [userId]);

  React.useEffect(() => {
    if (!userId) return;
    let dispose: () => void = () => undefined;
    let active = true;
    void listenForPushNavigation(navigate).then((listener) => {
      if (!active) listener();
      else dispose = listener;
    }).catch(() => undefined);
    return () => {
      active = false;
      dispose();
    };
  }, [navigate, userId]);

  React.useEffect(() => {
    if (!navigationReady || !pending.current) return;
    const destination = pending.current;
    pending.current = null;
    navigate(destination);
  }, [navigate, navigationReady]);

  return null;
};
