import {
  ArrowUp,
  ArrowUpRight,
  BrainCircuit,
  CircleAlert,
  ClipboardCheck,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react-native';
import { Square, SquareCheckBig } from 'lucide';
import { randomUUID } from 'expo-crypto';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppMorphIcon } from '../../components/common/AppMorphIcon';
import { AppButton } from '../../components/common/AppButton';
import { MentaMessageContent } from '../../components/menta/MentaMessageContent';
import { AppHeader } from '../../components/shared/AppHeader';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import {
  fetchMentaBootstrap,
  MentaBootstrap,
  MentaConversation,
  MentaScope,
  openMentaConversation,
  restartMentaConversation,
  sendMentaMessageStream,
} from '../../repositories/MentaRepository';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { IconSize, IconStroke } from '../../theme/icons';
import { Layout } from '../../theme/layout';
import { StreamingCadence } from '../../theme/motion';
import { showAlert } from '../../utils/alert';
import { takeNextMentaStreamChunk } from '../../utils/mentaStreamPresentation';
import { presentUserError } from '../../utils/userFacingError';

function errorMessage(error: unknown): string {
  return presentUserError(error, 'No pudimos conectar con MENTA. Inténtalo nuevamente.');
}

function AssistantMessage({
  message,
  isStreaming = false,
}: {
  readonly message: string;
  readonly isStreaming?: boolean;
}) {
  return (
    <View style={styles.assistantRow}>
      <View style={styles.agentAvatar}>
        <BrainCircuit size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
      </View>
      <View style={styles.assistantContent} accessibilityLiveRegion={isStreaming ? 'polite' : undefined}>
        <MentaMessageContent message={message} />
        {isStreaming ? <View style={styles.streamCursor} accessibilityElementsHidden /> : null}
      </View>
    </View>
  );
}

interface StreamingReply {
  readonly text: string;
  readonly status: string;
}

export function MentaAgentScreen() {
  const role = useAuthStore((state) => state.role);
  const scope: MentaScope = role === 'psychologist' ? 'PSYCHOLOGIST' : 'PATIENT';
  const turnsRef = useRef<FlatList<MentaConversation['turns'][number]>>(null);
  const streamAbortController = useRef<AbortController | null>(null);
  const streamPresentationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotionPreference();
  const [bootstrap, setBootstrap] = useState<MentaBootstrap | null>(null);
  const [conversation, setConversation] = useState<MentaConversation | null>(null);
  const [consentGranted, setConsentGranted] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState<StreamingReply | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtitle = useMemo(() => scope === 'PATIENT'
    ? 'Tu asistente en Ruta Emocional'
    : 'Asistente para tu práctica', [scope]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    void fetchMentaBootstrap(scope, controller.signal)
      .then((result) => {
        setBootstrap(result);
        setConversation(result.conversation);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [scope]);

  useEffect(() => () => {
    streamAbortController.current?.abort();
    if (streamPresentationTimer.current) clearTimeout(streamPresentationTimer.current);
  }, []);

  const handleOpenConversation = async () => {
    if (!consentGranted || isOpening) return;
    setIsOpening(true);
    setError(null);
    try {
      setConversation(await openMentaConversation(scope));
    } catch (openError) {
      setError(errorMessage(openError));
    } finally {
      setIsOpening(false);
    }
  };

  const handleSend = async (suggestedMessage?: string) => {
    const selectedMessage = (suggestedMessage ?? message).trim();
    if (!conversation || !selectedMessage || isSending) return;
    const controller = new AbortController();
    streamAbortController.current = controller;
    setMessage('');
    setPendingMessage(selectedMessage);
    setStreamingReply({ text: '', status: 'MENTA está preparando una respuesta.' });
    setIsSending(true);
    setError(null);

    let bufferedText = '';
    let isPresenting = false;
    let sourceCompleted = false;
    let presentationCompleted = false;
    let resolvePresentation: () => void = () => undefined;
    const presentationDone = new Promise<void>((resolve) => {
      resolvePresentation = resolve;
    });

    const finishPresentation = () => {
      if (!sourceCompleted || isPresenting || bufferedText) return;
      presentationCompleted = true;
      resolvePresentation();
    };

    const presentNextChunk = () => {
      if (controller.signal.aborted) {
        isPresenting = false;
        streamPresentationTimer.current = null;
        resolvePresentation();
        return;
      }

      const nextChunk = takeNextMentaStreamChunk(bufferedText);
      if (!nextChunk) {
        isPresenting = false;
        streamPresentationTimer.current = null;
        finishPresentation();
        return;
      }

      bufferedText = nextChunk.remaining;
      setStreamingReply((current) => current
        ? { ...current, text: `${current.text}${nextChunk.value}` }
        : current);
      streamPresentationTimer.current = setTimeout(
        presentNextChunk,
        reduceMotion ? 0 : StreamingCadence.mentaWord
      );
    };

    const enqueueStreamDelta = (delta: string) => {
      bufferedText += delta;
      if (isPresenting) return;
      isPresenting = true;
      presentNextChunk();
    };

    const stopPresentation = () => {
      bufferedText = '';
      isPresenting = false;
      if (streamPresentationTimer.current) clearTimeout(streamPresentationTimer.current);
      streamPresentationTimer.current = null;
      resolvePresentation();
    };

    const replaceStreamText = (text: string) => {
      bufferedText = '';
      isPresenting = false;
      if (streamPresentationTimer.current) clearTimeout(streamPresentationTimer.current);
      streamPresentationTimer.current = null;
      setStreamingReply((current) => current ? { ...current, text } : current);
    };

    try {
      const turn = await sendMentaMessageStream(
        conversation.id,
        randomUUID(),
        selectedMessage,
        {
          onStatus: (status) => setStreamingReply((current) => current
            ? { ...current, status }
            : current),
          onDelta: enqueueStreamDelta,
          onReplace: replaceStreamText,
        },
        controller.signal
      );
      sourceCompleted = true;
      finishPresentation();
      if (!presentationCompleted) await presentationDone;
      if (controller.signal.aborted) return;
      setConversation((current) => current
        ? { ...current, turns: [...current.turns, turn] }
        : current);
    } catch (sendError) {
      if (!controller.signal.aborted) {
        setMessage(selectedMessage);
        setError(errorMessage(sendError));
      }
    } finally {
      stopPresentation();
      if (streamAbortController.current === controller) {
        streamAbortController.current = null;
        setPendingMessage(null);
        setStreamingReply(null);
        setIsSending(false);
      }
    }
  };

  const handleRestart = async () => {
    if (!conversation || isRestarting) return;
    setIsRestarting(true);
    setError(null);
    streamAbortController.current?.abort();
    streamAbortController.current = null;
    if (streamPresentationTimer.current) clearTimeout(streamPresentationTimer.current);
    streamPresentationTimer.current = null;
    setPendingMessage(null);
    setStreamingReply(null);
    setIsSending(false);

    try {
      const restarted = await restartMentaConversation(conversation.id);
      setConversation(restarted);
      setBootstrap((current) => current ? { ...current, conversation: restarted } : current);
      setMessage('');
      turnsRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch (restartError) {
      setError(presentUserError(
        restartError,
        'No pudimos reiniciar la conversación. Inténtalo nuevamente.'
      ));
    } finally {
      setIsRestarting(false);
    }
  };

  const confirmRestart = () => {
    if (isRestarting) return;
    showAlert(
      'Reiniciar conversación',
      'Comenzarás un chat nuevo y MENTA dejará de usar estos mensajes como contexto. Tus citas y demás datos no cambiarán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reiniciar', style: 'destructive', onPress: () => void handleRestart() },
      ],
      'warning'
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <AppHeader title="MENTA" subtitle={subtitle} showBack />
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.stateText}>Preparando MENTA…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bootstrap?.enabled) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <AppHeader title="MENTA" subtitle={subtitle} showBack />
        <View style={styles.centeredState}>
          <View style={styles.largeIcon}>
            <BrainCircuit size={42} strokeWidth={IconStroke.regular} color={Colors.primary} />
          </View>
          <Text style={styles.stateTitle}>MENTA aún no está disponible</Text>
          <Text style={styles.stateText}>
            El agente contextual está deshabilitado en este entorno. Las funciones de agenda,
            mensajes y atención continúan disponibles.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <AppHeader title="MENTA" subtitle={subtitle} showBack />
        <ScrollView contentContainerStyle={styles.consentContainer}>
          <View style={styles.largeIcon}>
            <BrainCircuit size={42} strokeWidth={IconStroke.regular} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Conoce a MENTA</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.disclosure}>
            <View style={styles.disclosureHeading}>
              <ShieldCheck size={IconSize.navigation} strokeWidth={IconStroke.regular} color={Colors.primary} />
              <Text style={styles.disclosureTitle}>Antes de comenzar</Text>
            </View>
            <Text style={styles.disclosureText}>{bootstrap.disclosure}</Text>
          </View>
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setConsentGranted((current) => !current)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consentGranted }}
            aria-checked={consentGranted}
          >
            <AppMorphIcon
              icon={consentGranted ? SquareCheckBig : Square}
              size={IconSize.navigation}
              strokeWidth={consentGranted ? IconStroke.emphasized : IconStroke.regular}
              color={consentGranted ? Colors.primary : Colors.textTertiary}
            />
            <Text style={styles.consentText}>
              Entiendo el alcance de MENTA y autorizo esta conversación contextual.
            </Text>
          </TouchableOpacity>
          {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}
          <AppButton
            label="Iniciar conversación"
            onPress={() => void handleOpenConversation()}
            disabled={!consentGranted}
            isLoading={isOpening}
            fullWidth
            size="lg"
            style={styles.consentAction}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <AppHeader
          title="MENTA"
          subtitle={subtitle}
          showBack
          contextualAction={(conversation.turns.length > 0 || pendingMessage)
            ? {
                label: 'Reiniciar conversación',
                icon: RotateCcw,
                onPress: confirmRestart,
              }
            : undefined}
        />

        <FlatList
          ref={turnsRef}
          data={[...conversation.turns]}
          keyExtractor={(turn) => turn.id}
          style={styles.flex}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
          onContentSizeChange={() => turnsRef.current?.scrollToEnd({
            animated: !streamingReply?.text && conversation.turns.length > 0,
          })}
          ListHeaderComponent={conversation.turns.length === 0 ? (
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>
                {scope === 'PATIENT' ? '¿En qué puedo ayudarte hoy?' : '¿Qué deseas preparar o consultar?'}
              </Text>
              <View style={styles.suggestions}>
                {bootstrap.suggestedPrompts.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={styles.suggestion}
                    onPress={() => void handleSend(prompt)}
                    disabled={isSending}
                    accessibilityRole="button"
                    accessibilityLabel={prompt}
                  >
                    <Text style={styles.suggestionText}>{prompt}</Text>
                    <ArrowUpRight size={IconSize.inline} strokeWidth={IconStroke.regular} color={Colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
          renderItem={({ item: turn }) => (
            <View key={turn.id} style={styles.turn}>
              <View style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Text selectable style={styles.userText}>{turn.userMessage}</Text>
                </View>
              </View>
              <AssistantMessage message={turn.assistantMessage} />
            </View>
          )}
          ListFooterComponent={(
            <View style={styles.footerContent}>
              {pendingMessage ? (
            <View style={styles.turn}>
              <View style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{pendingMessage}</Text>
                </View>
              </View>
              {streamingReply?.text ? (
                <AssistantMessage message={streamingReply.text} isStreaming />
              ) : (
                <View style={styles.assistantRow}>
                  <View style={styles.agentAvatar}>
                    <BrainCircuit size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.primary} />
                  </View>
                  <View style={styles.typingState}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.typingText}>{streamingReply?.status ?? 'Preparando respuesta…'}</Text>
                  </View>
                </View>
              )}
            </View>
              ) : null}

              {scope === 'PSYCHOLOGIST' ? (
            <View style={styles.draftNotice}>
              <ClipboardCheck size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.textSecondary} />
              <Text style={styles.draftNoticeText}>
                Revisa los borradores antes de guardarlos.
              </Text>
            </View>
              ) : null}
            </View>
          )}
        />

        {error ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <CircleAlert size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder={scope === 'PATIENT' ? 'Pregúntale a MENTA' : 'Consulta o solicita un borrador'}
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={2_000}
            editable={!isSending && !isRestarting}
            accessibilityLabel="Mensaje para MENTA"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!message.trim() || isSending || isRestarting) && styles.sendButtonDisabled,
            ]}
            onPress={() => void handleSend()}
            disabled={!message.trim() || isSending || isRestarting}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            accessibilityState={{ disabled: !message.trim() || isSending || isRestarting }}
          >
            <ArrowUp size={IconSize.navigation} strokeWidth={IconStroke.emphasized} color={Colors.textInverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  largeIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  stateTitle: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center' },
  stateText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', maxWidth: 460 },
  consentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: { ...Typography.h1, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  disclosure: {
    width: '100%',
    maxWidth: 560,
    paddingVertical: Spacing.base,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.divider,
    gap: Spacing.sm,
  },
  disclosureHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  disclosureTitle: { ...Typography.h4, color: Colors.textPrimary },
  disclosureText: { ...Typography.body, color: Colors.textSecondary },
  consentRow: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 48,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  consentText: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  consentAction: { maxWidth: 560 },
  errorText: { ...Typography.bodySmall, color: Colors.error, textAlign: 'center' },
  messagesContent: {
    width: '100%',
    maxWidth: Layout.maxReadableWidth,
    alignSelf: 'center',
    padding: Spacing.base,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  footerContent: { gap: Spacing.lg },
  welcomeSection: {
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  welcomeTitle: { ...Typography.h3, color: Colors.textPrimary },
  suggestions: { gap: Spacing.sm },
  suggestion: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
  },
  suggestionText: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  turn: { gap: Spacing.md },
  userRow: { alignItems: 'flex-end', paddingLeft: Spacing.xxl },
  userBubble: {
    maxWidth: '88%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.xs,
    backgroundColor: Colors.primary,
  },
  userText: { ...Typography.body, color: Colors.textInverse },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingRight: Spacing.base },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  assistantContent: {
    flex: 1,
    minWidth: 0,
    paddingTop: Spacing.xxs,
  },
  typingState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  typingText: { ...Typography.bodySmall, color: Colors.textSecondary },
  streamCursor: {
    width: 2,
    height: 18,
    marginTop: Spacing.xs,
    backgroundColor: Colors.primary,
  },
  draftNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  draftNoticeText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.errorSurface,
    borderTopWidth: 1,
    borderTopColor: Colors.errorBorder,
  },
  errorBannerText: { ...Typography.bodySmall, color: Colors.error, flex: 1 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  input: {
    ...Typography.body,
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceSoft,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  sendButtonDisabled: { opacity: 0.4 },
});
