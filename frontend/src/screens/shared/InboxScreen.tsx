import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchUserConversations } from '../../repositories/ChatRepository';
import { getAvailablePsychologists } from '../../repositories/PsychologistRepository';
import { Toast, useToast } from '../../components/common/Toast';

interface ChatItem {
  id: string;
  displayName: string;
  photoURL?: string;
  lastMessage: string;
  time: string;
  unread: boolean;
  requestId?: string;
}

/** Punto de presencia online con pulso animado */
const OnlinePulse: React.FC = () => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={onlineStyles.container}>
      <Animated.View style={[onlineStyles.ring, { transform: [{ scale: pulse }] }]} />
      <View style={onlineStyles.dot} />
    </View>
  );
};

const onlineStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accentFaded,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
});

export const InboxScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { userProfile } = useAuthStore();
  const { toastConfig, showToast, hideToast } = useToast();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isSubscribed = true;

    const loadConversations = async () => {
      try {
        if (userProfile?.id) {
          const convs = await fetchUserConversations(userProfile.id);
          if (convs && convs.length > 0) {
            const isPatient = userProfile.role === 'patient';
            const mapped: ChatItem[] = convs.map((c, idx) => ({
              id: c.requestId || idx.toString(),
              displayName: isPatient
                ? c.psychologistName || 'Psicólogo'
                : c.patientName || 'Paciente',
              photoURL: isPatient ? c.psychologistPhotoURL : c.patientPhotoURL,
              lastMessage: c.lastMessage || 'Sesión iniciada',
              time: c.updatedAt
                ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '',
              unread: idx === 0,
              requestId: c.requestId,
            }));
            if (isSubscribed) {
              setChats(mapped);
              setLoading(false);
              return;
            }
          }
        }

        // Fallback si no hay conversaciones en DB
        const psychs = await getAvailablePsychologists();
        const chatItems: ChatItem[] = psychs.map((psy, idx) => ({
          id: psy.id,
          displayName: psy.displayName,
          photoURL: psy.photoURL,
          lastMessage: 'Sesión de apoyo activa.',
          time: `${14 - idx}:30`,
          unread: idx === 0,
        }));

        if (isSubscribed) {
          setChats(chatItems);
          setLoading(false);
        }
      } catch (err: any) {
        if (isSubscribed) {
          setLoading(false);
          showToast('No se pudieron cargar los mensajes. Verifica tu conexión.', 'error');
        }
      }
    };

    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [userProfile?.id, userProfile?.role]);

  const handleOpenChat = (chat: ChatItem) => {
    navigation.navigate('Consultation', {
      requestId: chat.requestId || chat.id,
      psychologistName: chat.displayName,
      psychologistPhotoURL: chat.photoURL,
      modality: 'chat',
    });
  };

  const renderItem = ({ item, index }: { item: ChatItem; index: number }) => {
    const isLast = index === chats.length - 1;
    return (
      <TouchableOpacity
        style={[styles.row, isLast && styles.rowLast]}
        onPress={() => handleOpenChat(item)}
        activeOpacity={0.6}
        accessibilityLabel={`Abrir chat con ${item.displayName}`}
        accessibilityRole="button"
      >
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          {item.photoURL ? (
            <Image source={{ uri: item.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {item.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {item.unread && <OnlinePulse />}
        </View>

        {/* Contenido */}
        <View style={styles.info}>
          <View style={styles.infoTop}>
            <Text style={[styles.name, item.unread && styles.nameUnread]} numberOfLines={1}>
              {item.displayName}
            </Text>
            <Text style={[styles.time, item.unread && styles.timeUnread]}>{item.time}</Text>
          </View>
          <View style={styles.infoBottom}>
            <Text
              style={[styles.lastMsg, item.unread && styles.lastMsgUnread]}
              numberOfLines={1}
            >
              {item.lastMessage}
            </Text>
            {item.unread && <View style={styles.unreadBadge} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonLines}>
            <View style={[styles.skeletonLine, { width: '55%' }]} />
            <View style={[styles.skeletonLine, { width: '80%', opacity: 0.5 }]} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="chat-bubble-outline" size={40} color={Colors.textDisabled} />
      <Text style={styles.emptyTitle}>Sin conversaciones activas</Text>
      <Text style={styles.emptySub}>
        Inicia una solicitud en el Radar para conectarte con un psicólogo.
      </Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Mensajes</Text>
            {!loading && chats.length > 0 && (
              <Text style={styles.headerSub}>{chats.length} conversación{chats.length !== 1 ? 'es' : ''} activa{chats.length !== 1 ? 's' : ''}</Text>
            )}
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>En vivo</Text>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        renderSkeleton()
      ) : chats.length > 0 ? (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
        />
      ) : (
        renderEmpty()
      )}

      <Toast {...toastConfig} onHide={hideToast} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  headerSafe: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
  },
  headerTitle: { ...Typography.h1, color: Colors.textPrimary },
  headerSub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 1 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accentFaded,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  liveText: { ...Typography.caption, color: Colors.accentDark, fontWeight: '700', textTransform: 'uppercase' },

  listContent: { paddingVertical: Spacing.xs, backgroundColor: Colors.surface },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
  },
  rowLast: {},
  separator: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginLeft: Spacing.base + 56,
  },

  avatarWrapper: { position: 'relative', flexShrink: 0 },
  avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: Colors.surfaceMuted },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: Colors.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { ...Typography.h3, color: Colors.primary },

  info: { flex: 1, gap: 4 },
  infoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  name: { ...Typography.h4, color: Colors.textPrimary, flex: 1 },
  nameUnread: { fontWeight: '700' },
  time: { ...Typography.caption, color: Colors.textTertiary },
  timeUnread: { color: Colors.primary, fontWeight: '600' },

  infoBottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  lastMsg: { ...Typography.body, color: Colors.textSecondary, flex: 1 },
  lastMsgUnread: { color: Colors.textPrimary, fontWeight: '500' },
  unreadBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, flexShrink: 0 },

  // Skeleton loading
  skeletonContainer: { padding: Spacing.base, gap: Spacing.base, backgroundColor: Colors.surface },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  skeletonAvatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: Colors.surfaceMuted },
  skeletonLines: { flex: 1, gap: Spacing.sm },
  skeletonLine: { height: 12, backgroundColor: Colors.surfaceMuted, borderRadius: BorderRadius.full },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyTitle: { ...Typography.h3, color: Colors.textPrimary },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
