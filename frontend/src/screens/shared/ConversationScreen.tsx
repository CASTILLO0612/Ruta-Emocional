import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Clock3,
  History,
  Info,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppNavigation, AppStackParamList } from '../../navigation/navigationTypes';
import {
  ChatMessage,
  Conversation,
  fetchConversation,
  fetchMessages,
  getMessagingPolicy,
  listenToConversation,
  sendChatMessage,
} from '../../repositories/ChatRepository';
import type { RealtimeConnectionState } from '../../services/socketClient';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';

type ConversationRoute = RouteProp<AppStackParamList, 'Consultation'>;
type DeliveryState = 'sending' | 'sent' | 'failed';
type RenderedMessage = ChatMessage & { readonly delivery: DeliveryState };

function messageKey(message: Pick<ChatMessage, 'sender' | 'clientMessageId'>): string {
  return `${message.sender.userId}:${message.clientMessageId}`;
}

function asDelivered(message: ChatMessage, currentUserId: string): RenderedMessage {
  return {
    ...message,
    isOwn: message.sender.userId === currentUserId,
    delivery: 'sent',
  };
}

function mergeMessages(
  current: readonly RenderedMessage[],
  incoming: readonly ChatMessage[],
  currentUserId: string
): RenderedMessage[] {
  const merged = new Map(current.map((message) => [messageKey(message), message]));
  for (const message of incoming) {
    merged.set(messageKey(message), asDelivered(message, currentUserId));
  }
  return [...merged.values()].sort((left, right) => {
    const timeDifference = Date.parse(left.sentAt) - Date.parse(right.sentAt);
    return timeDifference || left.id.localeCompare(right.id);
  });
}

function connectionLabel(state: RealtimeConnectionState): string {
  if (state === 'connected') return 'En tiempo real';
  if (state === 'connecting') return 'Conectando';
  return 'Sin conexión en tiempo real';
}

function messageTime(isoDate: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

export const ConversationScreen: React.FC = () => {
  const route = useRoute<ConversationRoute>();
  const navigation = useNavigation<AppNavigation>();
  const user = useAuthStore(({ userProfile }) => userProfile);
  const conversationId = route.params.conversationId;
  const listRef = useRef<FlatList<RenderedMessage>>(null);
  const shouldScrollToEnd = useRef(true);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<RenderedMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [maximumTextLength, setMaximumTextLength] = useState(0);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);

  const mergeFromServer = useCallback((serverMessages: readonly ChatMessage[]) => {
    if (!user) return;
    setMessages((current) => mergeMessages(current, serverMessages, user.id));
  }, [user]);

  const loadLatest = useCallback(async (signal?: AbortSignal) => {
    const page = await fetchMessages(conversationId, { signal });
    mergeFromServer(page.data);
    setOlderCursor(page.page.nextCursor);
  }, [conversationId, mergeFromServer]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    Promise.all([
      fetchConversation(conversationId, controller.signal),
      getMessagingPolicy(controller.signal),
      fetchMessages(conversationId, { signal: controller.signal }),
    ])
      .then(([loadedConversation, policy, page]) => {
        setConversation(loadedConversation);
        setMaximumTextLength(policy.maximumTextLength);
        setMessages(mergeMessages([], page.data, user.id));
        setOlderCursor(page.page.nextCursor);
        shouldScrollToEnd.current = true;
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error
          ? loadError.message
          : 'No pudimos abrir esta conversación.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [conversationId, user]);

  useEffect(() => {
    if (!user) return;
    return listenToConversation({
      conversationId,
      onStateChange: (state) => {
        setConnectionState(state);
        if (state === 'connected') {
          void loadLatest().catch(() => {
            setError('La conexión volvió, pero no pudimos sincronizar los mensajes recientes.');
          });
        }
      },
      onMessage: (message) => {
        shouldScrollToEnd.current = true;
        mergeFromServer([message]);
      },
      onError: () => setConnectionState('disconnected'),
    });
  }, [conversationId, loadLatest, mergeFromServer, user]);

  const loadOlder = useCallback(async () => {
    if (!olderCursor || isLoadingOlder) return;
    setIsLoadingOlder(true);
    shouldScrollToEnd.current = false;
    try {
      const page = await fetchMessages(conversationId, {
        cursor: olderCursor,
        direction: 'before',
      });
      mergeFromServer(page.data);
      setOlderCursor(page.page.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error
        ? loadError.message
        : 'No pudimos cargar los mensajes anteriores.');
    } finally {
      setIsLoadingOlder(false);
    }
  }, [conversationId, isLoadingOlder, mergeFromServer, olderCursor]);

  const deliver = useCallback(async (clientMessageId: string, text: string) => {
    if (!user) return;
    try {
      const result = await sendChatMessage(conversationId, { clientMessageId, text });
      shouldScrollToEnd.current = true;
      mergeFromServer([result.message]);
    } catch (sendError) {
      setMessages((current) => current.map((message) => (
        message.clientMessageId === clientMessageId && message.isOwn
          ? { ...message, delivery: 'failed' }
          : message
      )));
      setError(sendError instanceof Error
        ? sendError.message
        : 'No pudimos enviar el mensaje.');
    }
  }, [conversationId, mergeFromServer, user]);

  const send = useCallback(() => {
    if (!user || !conversation?.canSend) return;
    const text = draft.trim();
    if (!text || text.length > maximumTextLength) return;
    const clientMessageId = randomUUID();
    const optimistic: RenderedMessage = {
      id: `pending:${clientMessageId}`,
      conversationId,
      clientMessageId,
      type: 'TEXT',
      text,
      sentAt: new Date().toISOString(),
      sender: {
        userId: user.id,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        role: user.role,
      },
      isOwn: true,
      delivery: 'sending',
    };
    setDraft('');
    setError(null);
    shouldScrollToEnd.current = true;
    setMessages((current) => mergeMessages(current, [optimistic], user.id));
    void deliver(clientMessageId, text);
  }, [conversation, conversationId, deliver, draft, maximumTextLength, user]);

  const retry = useCallback((message: RenderedMessage) => {
    setError(null);
    setMessages((current) => current.map((candidate) => (
      messageKey(candidate) === messageKey(message)
        ? { ...candidate, delivery: 'sending' }
        : candidate
    )));
    void deliver(message.clientMessageId, message.text);
  }, [deliver]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.supportingText}>Abriendo conversación segura</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!conversation || !user) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <LockKeyhole size={36} color={Colors.textTertiary} strokeWidth={1.7} />
          <Text style={styles.emptyTitle}>Conversación no disponible</Text>
          <Text style={styles.emptyText}>{error ?? 'No tienes acceso a esta conversación.'}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const remainingCharacters = maximumTextLength - draft.length;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Volver"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => navigation.goBack()}
            style={styles.iconButton}
          >
            <ArrowLeft size={24} color={Colors.textPrimary} strokeWidth={2} />
          </Pressable>
          {conversation.counterpart.photoUrl ? (
            <Image source={{ uri: conversation.counterpart.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <UserRound size={22} color={Colors.primary} strokeWidth={1.8} />
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.name}>{conversation.counterpart.displayName}</Text>
            <View style={styles.connectionRow}>
              <View style={[
                styles.connectionDot,
                connectionState === 'connected' && styles.connectionDotActive,
              ]} />
              <Text style={styles.connectionText}>{connectionLabel(connectionState)}</Text>
            </View>
          </View>
          <View style={styles.secureBadge}>
            <LockKeyhole size={17} color={Colors.primary} strokeWidth={1.9} />
          </View>
        </View>

        {error ? (
          <Pressable style={styles.errorBanner} onPress={() => setError(null)}>
            <CircleAlert size={18} color={Colors.error} strokeWidth={1.9} />
            <Text numberOfLines={2} style={styles.errorText}>{error}</Text>
            <X size={18} color={Colors.textSecondary} strokeWidth={2} />
          </Pressable>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={messageKey}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (shouldScrollToEnd.current) {
              listRef.current?.scrollToEnd({ animated: messages.length > 1 });
              shouldScrollToEnd.current = false;
            }
          }}
          ListHeaderComponent={olderCursor ? (
            <Pressable
              disabled={isLoadingOlder}
              onPress={() => void loadOlder()}
              style={styles.olderButton}
            >
              {isLoadingOlder
                ? <ActivityIndicator color={Colors.primary} size="small" />
                : <History size={18} color={Colors.primary} strokeWidth={1.9} />}
              <Text style={styles.olderButtonText}>Cargar mensajes anteriores</Text>
            </Pressable>
          ) : null}
          ListEmptyComponent={(
            <View style={styles.emptyConversation}>
              <ShieldCheck size={28} color={Colors.primary} strokeWidth={1.8} />
              <Text style={styles.emptyTitle}>Canal de atención habilitado</Text>
              <Text style={styles.emptyText}>
                Los mensajes se guardan en tu conversación y solo pueden consultarlos sus participantes.
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={[styles.messageRow, item.isOwn && styles.messageRowOwn]}>
              <View style={[styles.bubble, item.isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                <Text style={[styles.messageText, item.isOwn && styles.messageTextOwn]}>
                  {item.text}
                </Text>
                <View style={styles.messageMeta}>
                  <Text style={[styles.messageTime, item.isOwn && styles.messageTimeOwn]}>
                    {messageTime(item.sentAt)}
                  </Text>
                  {item.isOwn && item.delivery === 'sending' ? (
                    <Clock3 size={13} color={Colors.textOnBrandMuted} strokeWidth={1.9} />
                  ) : null}
                  {item.isOwn && item.delivery === 'sent' ? (
                    <Check size={14} color={Colors.textOnBrandMuted} strokeWidth={2.2} />
                  ) : null}
                </View>
              </View>
              {item.delivery === 'failed' ? (
                <Pressable onPress={() => retry(item)} style={styles.retryButton}>
                  <RefreshCw size={16} color={Colors.error} strokeWidth={2} />
                  <Text style={styles.retryMessageText}>Reintentar</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />

        <View style={styles.composer}>
          {!conversation.canSend ? (
            <View style={styles.readOnlyNotice}>
              <Info size={18} color={Colors.textSecondary} strokeWidth={1.9} />
              <Text style={styles.readOnlyText}>La relación está pausada; la conversación es de solo lectura.</Text>
            </View>
          ) : (
            <>
              <TextInput
                accessibilityLabel="Escribe un mensaje"
                multiline
                maxLength={maximumTextLength}
                onChangeText={setDraft}
                placeholder="Escribe un mensaje"
                placeholderTextColor={Colors.textTertiary}
                style={styles.input}
                value={draft}
              />
              <Pressable
                accessibilityLabel="Enviar mensaje"
                accessibilityRole="button"
                disabled={!draft.trim() || remainingCharacters < 0}
                onPress={send}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!draft.trim() || remainingCharacters < 0) && styles.sendButtonDisabled,
                  pressed && styles.sendButtonPressed,
                ]}
              >
                <Send size={21} color={Colors.textInverse} strokeWidth={2} />
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  supportingText: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.md },
  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceMuted },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  name: { ...Typography.h4, color: Colors.textPrimary },
  connectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  connectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textTertiary },
  connectionDotActive: { backgroundColor: Colors.success },
  connectionText: { ...Typography.caption, color: Colors.textSecondary },
  secureBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.errorSurface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.errorBorder,
  },
  errorText: { ...Typography.bodySmall, color: Colors.error, flex: 1 },
  messageList: { flexGrow: 1, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  olderButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  olderButtonText: { ...Typography.bodySmall, color: Colors.primary, fontFamily: FontFamily.bodySemiBold },
  emptyConversation: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.giant,
  },
  emptyTitle: { ...Typography.h3, color: Colors.textPrimary, textAlign: 'center', marginTop: Spacing.md },
  emptyText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
  secondaryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  secondaryButtonText: { ...Typography.button, color: Colors.primary },
  messageRow: { alignItems: 'flex-start', marginBottom: Spacing.sm },
  messageRowOwn: { alignItems: 'flex-end' },
  bubble: { maxWidth: '82%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  bubbleOwn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.xs,
  },
  bubbleOther: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.xs,
  },
  messageText: { ...Typography.body, color: Colors.textPrimary },
  messageTextOwn: { color: Colors.textInverse },
  messageMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  messageTime: { ...Typography.caption, color: Colors.textTertiary, marginTop: Spacing.xs },
  messageTimeOwn: { color: Colors.textOnBrandMuted },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: Spacing.xs },
  retryMessageText: { ...Typography.caption, color: Colors.error, fontFamily: FontFamily.bodySemiBold },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  input: {
    ...Typography.body,
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonPressed: { backgroundColor: Colors.primaryDark },
  readOnlyNotice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  readOnlyText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },
});
