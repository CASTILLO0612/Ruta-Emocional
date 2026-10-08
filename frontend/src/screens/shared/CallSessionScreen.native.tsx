import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import {
  AudioSession,
  isTrackReference,
  LiveKitRoom,
  registerGlobals,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import { ArrowLeft, Mic, MicOff, Phone, PhoneOff, UserRound, Video, VideoOff } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, BackHandler, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppNavigation, AppStackParamList } from '../../navigation/navigationTypes';
import {
  CallConnection,
  CallSession,
  declineCall,
  finishCall,
  getCall,
  joinCall,
  startCall,
} from '../../repositories/CallRepository';
import { subscribeToCallUpdates } from '../../services/socketClient';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';

registerGlobals();

type CallRoute = RouteProp<AppStackParamList, 'CallSession'>;

export const CallSessionScreen: React.FC = () => {
  const route = useRoute<CallRoute>();
  const navigation = useNavigation<AppNavigation>();
  const { conversationId, direction, mediaType } = route.params;
  const [call, setCall] = React.useState<CallSession | null>(null);
  const [credentials, setCredentials] = React.useState<CallConnection['credentials'] | null>(null);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [callState, setCallState] = React.useState<'RINGING' | 'CONNECTING' | 'CONNECTED' | 'FINISHED'>('RINGING');
  const [connecting, setConnecting] = React.useState(false);
  const endedByUser = React.useRef(false);

  const close = React.useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Consultation', { conversationId });
  }, [conversationId, navigation]);

  React.useEffect(() => {
    let active = true;
    setBusy(true);
    if (direction === 'OUTGOING') {
      void startCall(conversationId, mediaType)
        .then((result) => {
          if (!active) {
            void finishCall(result.call.id).catch(() => undefined);
            return;
          }
          setCall(result.call);
          setCredentials(result.credentials);
          setCallState('CONNECTING');
        })
        .catch(() => {
          if (active) setError('No pudimos iniciar la llamada. Verifica tu conexión e inténtalo nuevamente.');
        })
        .finally(() => { if (active) setBusy(false); });
    } else if (route.params.callId) {
      void getCall(route.params.callId)
        .then((result) => {
          if (!active) return;
          if (result.conversationId !== conversationId || result.status !== 'RINGING') {
            setError('Esta llamada ya no está disponible.');
            setCallState('FINISHED');
            return;
          }
          setCall(result);
          setCallState('RINGING');
        })
        .catch(() => {
          if (active) setError('Esta llamada ya no está disponible.');
        })
        .finally(() => { if (active) setBusy(false); });
    } else {
      setError('No pudimos encontrar esta llamada.');
      setBusy(false);
    }
    return () => { active = false; };
  }, [conversationId, direction, mediaType, route.params.callId]);

  React.useEffect(() => {
    if (!credentials) return;
    void AudioSession.startAudioSession().catch(() => undefined);
    return () => { void AudioSession.stopAudioSession().catch(() => undefined); };
  }, [credentials]);

  React.useEffect(() => {
    if (!call) return;
    return subscribeToCallUpdates(call.id, (event) => {
      if (event.status === 'ACTIVE') {
        setCall((current) => current ? { ...current, status: 'ACTIVE' } : current);
      }
      else {
        setCallState('FINISHED');
        setCredentials(null);
        setTimeout(close, 900);
      }
    });
  }, [call, close]);

  React.useEffect(() => {
    if (!call || direction !== 'OUTGOING' || call.status !== 'RINGING' || callState === 'FINISHED') return;
    const delay = Math.max(0, new Date(call.expiresAt).getTime() - Date.now());
    const timer = setTimeout(() => {
      setCallState('FINISHED');
      setCredentials(null);
      void finishCall(call.id).catch(() => undefined);
      setError('No hubo respuesta. Puedes volver a intentarlo desde la conversación.');
    }, delay);
    return () => clearTimeout(timer);
  }, [call, callState, direction]);

  const accept = React.useCallback(async () => {
    if (!call || connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const joined = await joinCall(call.id);
      setCall(joined.call);
      setCredentials(joined.credentials);
      setCallState('CONNECTING');
    } catch {
      setError('No pudimos conectar la llamada. Puede que ya haya finalizado.');
    } finally {
      setConnecting(false);
    }
  }, [call, connecting]);

  const retryConnection = React.useCallback(async () => {
    if (!call || connecting || call.status !== 'ACTIVE') return;
    setConnecting(true);
    setError(null);
    try {
      const joined = await joinCall(call.id);
      setCall(joined.call);
      setCredentials(joined.credentials);
      setCallState('CONNECTING');
    } catch {
      setError('No pudimos restablecer la llamada. Revisa tu conexión o finalízala para volver a intentarlo más tarde.');
    } finally {
      setConnecting(false);
    }
  }, [call, connecting]);

  const hangUp = React.useCallback(async () => {
    if (endedByUser.current) return;
    endedByUser.current = true;
    setCallState('FINISHED');
    setCredentials(null);
    if (call) await finishCall(call.id).catch(() => undefined);
    close();
  }, [call, close]);

  const decline = React.useCallback(async () => {
    if (!call) return close();
    endedByUser.current = true;
    await declineCall(call.id).catch(() => undefined);
    close();
  }, [call, close]);

  const leaveCall = React.useCallback(() => {
    if (direction === 'INCOMING' && call?.status === 'RINGING' && !credentials) void decline();
    else void hangUp();
  }, [call?.status, credentials, decline, direction, hangUp]);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      leaveCall();
      return true;
    });
    return () => subscription.remove();
  }, [leaveCall]);

  const displayName = call?.counterpart.displayName ?? call?.initiator.displayName ?? 'Contacto';
  const isIncoming = direction === 'INCOMING' && call?.status === 'RINGING' && !credentials;
  const isRecovering = !busy && call?.status === 'ACTIVE' && !credentials && callState !== 'FINISHED';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.callBackground} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Finalizar llamada" onPress={leaveCall} style={styles.backButton}>
          <ArrowLeft size={23} color={Colors.textInverse} />
        </Pressable>
        <Text style={styles.headerLabel}>{mediaType === 'VIDEO' ? 'Videollamada' : 'Llamada de audio'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {credentials ? (
        <LiveKitRoom
          serverUrl={credentials.serverUrl}
          token={credentials.accessToken}
          connect
          audio
          video={mediaType === 'VIDEO'}
          options={{ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true }}
          onConnected={() => setCallState('CONNECTING')}
          onDisconnected={() => {
            if (!endedByUser.current) {
              setCredentials(null);
              setCallState('CONNECTING');
              setError('La conexión se interrumpió. Puedes reintentarla cuando tu red esté disponible.');
            }
          }}
          onError={() => setError('Se interrumpió la conexión de audio. Revisa tu red e inténtalo nuevamente.')}
        >
          <CallRoomContent
            call={call}
            mediaType={mediaType}
            callState={callState}
            onHangUp={() => void hangUp()}
            onPeerConnected={() => setCallState('CONNECTED')}
            onControlResult={(succeeded) => setError(succeeded ? null : 'No pudimos cambiar el audio o video. Revisa los permisos del dispositivo e inténtalo nuevamente.')}
            controlError={error}
          />
        </LiveKitRoom>
      ) : (
        <View style={styles.waitingContent}>
          <View style={styles.avatar}>
            <UserRound size={58} color={Colors.accent} strokeWidth={1.55} />
          </View>
          <Text style={styles.contactName}>{displayName}</Text>
          <Text style={styles.statusText}>
            {busy ? 'Preparando llamada' : callState === 'FINISHED' ? 'Llamada finalizada' : isIncoming ? 'Llamada entrante' : isRecovering ? 'Conexión interrumpida' : 'Llamando…'}
          </Text>
          {busy ? <ActivityIndicator color={Colors.accent} style={styles.loader} /> : null}
          {error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : null}

          {!busy && isIncoming && call ? (
            <View style={styles.incomingActions}>
              <CallAction icon={<PhoneOff size={23} color={Colors.textInverse} />} label="Rechazar" destructive onPress={() => void decline()} />
              <CallAction icon={<Phone size={23} color={Colors.textInverse} />} label="Contestar" onPress={() => void accept()} disabled={connecting} />
            </View>
          ) : null}
          {!busy && !isIncoming ? (
            <CallAction icon={<PhoneOff size={23} color={Colors.textInverse} />} label="Cancelar llamada" destructive onPress={() => void hangUp()} />
          ) : null}
          {isRecovering ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reintentar conexión"
              disabled={connecting}
              onPress={() => void retryConnection()}
              style={({ pressed }) => [styles.backToChat, styles.retryButton, connecting && styles.actionDisabled, pressed && styles.actionPressed]}
            >
              <Text style={styles.backToChatText}>{connecting ? 'Reconectando…' : 'Reintentar conexión'}</Text>
            </Pressable>
          ) : null}
          {error && callState === 'FINISHED' ? (
            <Pressable onPress={close} style={styles.backToChat} accessibilityRole="button">
              <Text style={styles.backToChatText}>Volver a la conversación</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
};

function CallRoomContent(props: {
  readonly call: CallSession | null;
  readonly mediaType: 'AUDIO' | 'VIDEO';
  readonly callState: 'RINGING' | 'CONNECTING' | 'CONNECTED' | 'FINISHED';
  readonly onHangUp: () => void;
  readonly onPeerConnected: () => void;
  readonly onControlResult: (succeeded: boolean) => void;
  readonly controlError: string | null;
}) {
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const [microphoneEnabled, setMicrophoneEnabled] = React.useState(true);
  const [cameraEnabled, setCameraEnabled] = React.useState(props.mediaType === 'VIDEO');
  const tracks = useTracks([Track.Source.Camera]);
  const remoteVideo = tracks.find((track) => (
    isTrackReference(track) && track.participant.identity !== room.localParticipant.identity
  ));

  React.useEffect(() => {
    if (remoteParticipants.length > 0) props.onPeerConnected();
  }, [remoteParticipants.length]);

  const toggleMicrophone = async () => {
    const next = !microphoneEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicrophoneEnabled(next);
      props.onControlResult(true);
    } catch {
      props.onControlResult(false);
    }
  };
  const toggleCamera = async () => {
    const next = !cameraEnabled;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCameraEnabled(next);
      props.onControlResult(true);
    } catch {
      props.onControlResult(false);
    }
  };

  return (
    <View style={styles.roomContent}>
      {props.mediaType === 'VIDEO' && remoteVideo && isTrackReference(remoteVideo) ? (
        <VideoTrack trackRef={remoteVideo} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <View style={styles.roomBackdrop}>
          <View style={styles.avatarLarge}>
            <UserRound size={64} color={Colors.accent} strokeWidth={1.5} />
          </View>
        </View>
      )}
      {props.mediaType === 'VIDEO' ? (
        <View pointerEvents="none" style={styles.videoContactLabel}>
          <Text numberOfLines={1} style={styles.videoContactName}>{props.call?.counterpart.displayName}</Text>
        </View>
      ) : (
        <View style={styles.roomTitle}>
          <Text style={styles.contactName}>{props.call?.counterpart.displayName ?? 'Contacto'}</Text>
          <Text style={styles.statusText}>{remoteParticipants.length ? 'Conectado' : 'Llamando…'}</Text>
        </View>
      )}
      {props.mediaType === 'VIDEO' && remoteParticipants.length === 0 ? (
        <Text style={styles.videoWaiting}>Esperando respuesta…</Text>
      ) : null}
      {props.controlError ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{props.controlError}</Text> : null}
      <View style={styles.controls}>
        <CallAction
          icon={microphoneEnabled ? <Mic size={22} color={Colors.textInverse} /> : <MicOff size={22} color={Colors.textInverse} />}
          label={microphoneEnabled ? 'Silenciar' : 'Activar micrófono'}
          onPress={() => void toggleMicrophone()}
          quiet
        />
        {props.mediaType === 'VIDEO' ? (
          <CallAction
            icon={cameraEnabled ? <Video size={22} color={Colors.textInverse} /> : <VideoOff size={22} color={Colors.textInverse} />}
            label={cameraEnabled ? 'Apagar cámara' : 'Activar cámara'}
            onPress={() => void toggleCamera()}
            quiet
          />
        ) : null}
        <CallAction icon={<PhoneOff size={23} color={Colors.textInverse} />} label="Finalizar" destructive onPress={props.onHangUp} />
      </View>
    </View>
  );
}

function CallAction(props: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onPress: () => void;
  readonly destructive?: boolean;
  readonly quiet?: boolean;
  readonly disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [styles.action, props.destructive && styles.actionDestructive, props.quiet && styles.actionQuiet, props.disabled && styles.actionDisabled, pressed && styles.actionPressed]}
    >
      {props.icon}
      <Text style={styles.actionLabel}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.callBackground },
  header: { height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { ...Typography.label, color: Colors.textOnBrandMuted, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 44 },
  waitingContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.giant },
  avatar: { width: 132, height: 132, borderRadius: 66, backgroundColor: Colors.callControl, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
  avatarLarge: { width: 156, height: 156, borderRadius: 78, backgroundColor: Colors.callControl, alignItems: 'center', justifyContent: 'center' },
  contactName: { ...Typography.h2, color: Colors.textInverse, textAlign: 'center' },
  statusText: { ...Typography.body, color: Colors.textOnBrandMuted, textAlign: 'center', marginTop: Spacing.sm },
  loader: { marginTop: Spacing.xl },
  errorText: { ...Typography.bodySmall, color: Colors.callErrorText, textAlign: 'center', marginTop: Spacing.lg },
  incomingActions: { flexDirection: 'row', gap: Spacing.xxl, marginTop: Spacing.giant },
  backToChat: { marginTop: Spacing.xl, padding: Spacing.md },
  retryButton: { borderWidth: 1, borderColor: Colors.borderOnBrand, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg },
  backToChatText: { ...Typography.button, color: Colors.textInverse },
  roomContent: { flex: 1, justifyContent: 'flex-end' },
  roomBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  roomTitle: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  videoContactLabel: { position: 'absolute', top: Spacing.xl, left: Spacing.xl, right: Spacing.xl, alignItems: 'center' },
  videoContactName: { ...Typography.h3, color: Colors.textInverse, textShadowColor: Colors.primaryDark, textShadowRadius: 6 },
  videoWaiting: { position: 'absolute', alignSelf: 'center', top: '62%', ...Typography.body, color: Colors.textInverse },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.base, paddingTop: Spacing.xl, paddingBottom: Spacing.xl },
  action: { minWidth: 88, minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.success },
  actionDestructive: { backgroundColor: Colors.error },
  actionQuiet: { backgroundColor: Colors.callControl },
  actionDisabled: { opacity: 0.5 },
  actionPressed: { opacity: 0.82 },
  actionLabel: { ...Typography.caption, color: Colors.textInverse, fontFamily: FontFamily.bodyMedium, textAlign: 'center' },
});
