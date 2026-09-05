import { ChevronRight, CircleAlert, MessageCircle, UserRound } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '../../components/shared/AppHeader';
import { AsyncState } from '../../components/shared/AsyncState';
import type { AppNavigation } from '../../navigation/navigationTypes';
import {
  Conversation,
  fetchUserConversations,
} from '../../repositories/ChatRepository';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { IconSize, IconStroke } from '../../theme/icons';
import { Layout } from '../../theme/layout';
import {
  formatConversationActivity,
  getConversationRoleLabel,
} from '../../utils/messagingPresentation';
import { presentUserError } from '../../utils/userFacingError';

export const InboxScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const page = await fetchUserConversations(undefined, signal);
      setConversations([...page.data]);
      setNextCursor(page.page.nextCursor);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === 'AbortError') return;
      setError(presentUserError(
        loadError,
        'No pudimos cargar tus conversaciones. Inténtalo nuevamente.'
      ));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void loadFirstPage(controller.signal);
    return () => controller.abort();
  }, [loadFirstPage]));

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFirstPage();
    setIsRefreshing(false);
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchUserConversations(nextCursor);
      setConversations((current) => {
        const knownIds = new Set(current.map(({ id }) => id));
        return [...current, ...page.data.filter(({ id }) => !knownIds.has(id))];
      });
      setNextCursor(page.page.nextCursor);
    } catch (loadError) {
      setError(presentUserError(
        loadError,
        'No pudimos cargar más conversaciones. Inténtalo nuevamente.'
      ));
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextCursor]);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <AppHeader title="Mensajes" subtitle="Conversaciones de atención" showBack />

      <AsyncState
        isLoading={isLoading}
        loadingMessage="Cargando conversaciones"
        error={conversations.length === 0 ? error : null}
        errorTitle="No pudimos abrir tus mensajes"
        onRetry={() => void refresh()}
        isEmpty={!error && conversations.length === 0}
        emptyIcon={MessageCircle}
        emptyTitle="Aún no hay conversaciones"
        emptyMessage="Aparecerán aquí después de aceptar una oferta y establecer la relación de atención."
      >
      {error && conversations.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void refresh()}
          style={styles.errorBanner}
        >
          <CircleAlert size={IconSize.action} strokeWidth={IconStroke.regular} color={Colors.error} />
          <View style={styles.errorCopy}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>Toca para intentar nuevamente</Text>
          </View>
        </Pressable>
      ) : null}

      <FlatList
        data={conversations}
        keyExtractor={({ id }) => id}
        contentContainerStyle={styles.list}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh()}
            tintColor={Colors.primary}
          />
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Abrir conversación con ${item.counterpart.displayName}`}
            onPress={() => navigation.navigate('Consultation', { conversationId: item.id })}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            {item.counterpart.photoUrl ? (
              <Image source={{ uri: item.counterpart.photoUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <UserRound size={IconSize.navigation} strokeWidth={IconStroke.regular} color={Colors.primary} />
              </View>
            )}
            <View style={styles.content}>
              <View style={styles.rowHeader}>
                <Text numberOfLines={1} style={styles.name}>
                  {item.counterpart.displayName}
                </Text>
                <Text style={styles.time}>{formatConversationActivity(item.activityAt)}</Text>
              </View>
              <Text style={styles.role}>{getConversationRoleLabel(item.counterpart.role)}</Text>
              <Text numberOfLines={1} style={styles.preview}>
                {item.lastMessage
                  ? `${item.lastMessage.isOwn ? 'Tú: ' : ''}${item.lastMessage.text}`
                  : 'Inicia una conversación segura'}
              </Text>
            </View>
            <ChevronRight size={IconSize.navigation} strokeWidth={IconStroke.regular} color={Colors.textTertiary} />
          </Pressable>
        )}
        ListFooterComponent={isLoadingMore
          ? <ActivityIndicator style={styles.footer} color={Colors.primary} />
          : null}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.35}
      />
      </AsyncState>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  list: {
    width: '100%',
    maxWidth: Layout.maxReadableWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  row: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  rowPressed: { backgroundColor: Colors.surfaceMuted },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceMuted },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  content: { flex: 1, minWidth: 0 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { ...Typography.h4, color: Colors.textPrimary, flex: 1 },
  time: { ...Typography.caption, color: Colors.textTertiary },
  role: { ...Typography.caption, color: Colors.primary, marginTop: Spacing.xxs },
  preview: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xs },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.errorSurface,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    width: '100%',
    maxWidth: Layout.maxReadableWidth,
    alignSelf: 'center',
  },
  errorCopy: { flex: 1 },
  errorText: { ...Typography.bodySmall, color: Colors.error },
  retryText: { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.xxs },
  footer: { marginVertical: Spacing.lg },
});
