import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { getAvailablePsychologists } from '../../repositories/PsychologistRepository';
import { Psychologist } from '../../models/Psychologist';

interface ChatItem {
  id: string;
  psychologist: Psychologist;
  lastMessage: string;
  time: string;
  unread: boolean;
}

export const InboxScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAvailablePsychologists()
      .then((psychs) => {
        const mockLastMessages = [
          'Hola Ángel, recuerda realizar tus ejercicios de respiración de 4 segundos.',
          '¿Cómo te has sentido con la última pauta que conversamos?',
          'Agenda confirmada para nuestra siguiente sesión de apoyo.',
          'Excelente progreso hoy, sigue adelante con tu bitácora emocional.',
          'Hola, escríbeme si presentas algún síntoma de estrés en estos días.',
        ];

        const chatItems: ChatItem[] = psychs.map((psy, idx) => ({
          id: psy.id,
          psychologist: psy,
          lastMessage: mockLastMessages[idx % mockLastMessages.length],
          time: `${14 - idx * 2}:30`,
          unread: idx < 2,
        }));

        setChats(chatItems);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleOpenChat = (chat: ChatItem) => {
    navigation.navigate('Consultation', {
      psychologistName: chat.psychologist.displayName,
      psychologistPhotoURL: chat.psychologist.photoURL,
      modality: 'chat',
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      
      <SafeAreaView style={styles.headerWrapper}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mensajería instantánea</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Activos</Text>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Cargando conversaciones...</Text>
        </View>
      ) : chats.length > 0 ? (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chatRow, item.unread && styles.chatRowUnread]}
              onPress={() => handleOpenChat(item)}
              activeOpacity={0.7}
            >
              <View style={styles.avatarContainer}>
                {item.psychologist.photoURL ? (
                  <Image source={{ uri: item.psychologist.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <MaterialIcons name="person" size={24} color={Colors.primary} />
                  </View>
                )}
                {item.psychologist.isAvailable && <View style={styles.onlineBadge} />}
              </View>

              <View style={styles.chatInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, item.unread && styles.nameUnread]} numberOfLines={1}>
                    {item.psychologist.displayName}
                  </Text>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
                
                <Text style={[styles.lastMsg, item.unread && styles.lastMsgUnread]} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>

              {item.unread && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.center}>
          <MaterialIcons name="chat-bubble-outline" size={48} color={Colors.textDisabled} />
          <Text style={styles.emptyTitle}>Sin mensajes activos</Text>
          <Text style={styles.emptySub}>Inicia una solicitud en el radar para conectar con psicólogos.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 4,
    gap: Spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  badge: {
    backgroundColor: '#39D35315',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accentDark,
    textTransform: 'uppercase',
  },
  list: {
    paddingVertical: Spacing.xs,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  chatRowUnread: {
    backgroundColor: 'rgba(10,36,99,0.01)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  chatInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    maxWidth: '75%',
  },
  nameUnread: {
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  lastMsg: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  lastMsgUnread: {
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
  },
});
