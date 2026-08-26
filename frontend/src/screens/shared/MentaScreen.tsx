import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { analyzeSymptomsWithMENTA, MentaAnalysis } from '../../services/GeminiService';
import { useRequestStore } from '../../store/useRequestStore';

type MessageRole = 'user' | 'menta';

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
  analysis?: MentaAnalysis;
}

const SUGGESTION_CHIPS = [
  { label: 'Ansiedad', icon: 'favorite-border' as const },
  { label: 'Tristeza', icon: 'cloud' as const },
  { label: 'Estres laboral', icon: 'work-outline' as const },
  { label: 'Problemas de sueno', icon: 'nights-stay' as const },
  { label: 'Relaciones', icon: 'people-outline' as const },
];

const INITIAL_MESSAGE: Message = {
  id: 'menta_intro',
  role: 'menta',
  text: 'Hola, soy MENTA, tu asistente de bienestar. Estoy aqui para ayudarte a encontrar el apoyo que necesitas. Cuentame, como te has sentido ultimamente?',
  timestamp: new Date(),
};

export const MentaScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { activeRequest } = useRequestStore();

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<MentaAnalysis | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const analysis = await analyzeSymptomsWithMENTA(text);
      setLastAnalysis(analysis);

      const mentaMsg: Message = {
        id: `menta_${Date.now()}`,
        role: 'menta',
        text: analysis.summary,
        timestamp: new Date(),
        analysis,
      };

      setMessages((prev) => [...prev, mentaMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `menta_err_${Date.now()}`,
          role: 'menta',
          text: 'Entiendo. Te ayudo a conectar con un especialista. Que modalidad prefieres: chat, llamada o presencial?',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, []);

  const handleApplyAnalysis = () => {
    if (!lastAnalysis) return;
    navigation.navigate('Home', {
      prefilledModality: lastAnalysis.recommended_modality,
      prefilledBudget: lastAnalysis.suggested_budget_min,
      prefilledNeed: lastAnalysis.primary_need,
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={styles.mentaAvatar}>
            <MaterialIcons name="psychology" size={18} color={Colors.textInverse} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleMenta]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.text}
          </Text>
          {item.analysis && (
            <View style={styles.analysisBadge}>
              <MaterialIcons name="auto-awesome" size={12} color={Colors.accent} />
              <Text style={styles.analysisText}>
                Recomendacion: {item.analysis.recommended_modality} ·{' '}
                C${item.analysis.suggested_budget_min}–{item.analysis.suggested_budget_max}
              </Text>
            </View>
          )}
          <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
            {item.timestamp.toLocaleTimeString('es', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      <SafeAreaView style={styles.appBarSafe}>
        <View style={styles.appBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back button"
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.appBarCenter}>
            <View style={styles.mentaIcon}>
              <MaterialIcons name="psychology" size={20} color={Colors.textInverse} />
            </View>
            <View>
              <Text style={styles.appBarTitle}>MENTA</Text>
              <Text style={styles.appBarSubtitle}>Asistente de bienestar</Text>
            </View>
          </View>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>En linea</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            isTyping ? (
              <View style={[styles.messageRow]}>
                <View style={styles.mentaAvatar}>
                  <MaterialIcons name="psychology" size={18} color={Colors.textInverse} />
                </View>
                <View style={styles.typingBubble}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.typingText}>MENTA esta escribiendo...</Text>
                </View>
              </View>
            ) : null
          }
        />

        {lastAnalysis && (
          <TouchableOpacity style={styles.applyBar} onPress={handleApplyAnalysis}>
            <Feather name="arrow-right-circle" size={18} color={Colors.textInverse} />
            <Text style={styles.applyBarText}>
              Usar recomendacion de MENTA · {lastAnalysis.recommended_modality}
            </Text>
          </TouchableOpacity>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
          keyboardShouldPersistTaps="handled"
          style={styles.chipsContainer}
        >
          {SUGGESTION_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip.label}
              style={styles.chip}
              onPress={() => sendMessage(chip.label)}
              activeOpacity={0.75}
            >
              <MaterialIcons name={chip.icon} size={14} color={Colors.primary} />
              <Text style={styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Escribe como te sientes..."
            placeholderTextColor={Colors.textDisabled}
            multiline
            maxLength={500}
            accessibilityLabel="Chat message input"
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(inputText)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isTyping}
            accessibilityLabel="Send message button"
          >
            <MaterialIcons
              name="send"
              size={20}
              color={inputText.trim() ? Colors.textInverse : Colors.textDisabled}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: { flex: 1 },
  appBarSafe: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    ...Shadow.sm,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  mentaIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  appBarSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'transparent',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  onlineText: {
    ...Typography.caption,
    color: Colors.accentDark,
    fontWeight: '700',
  },

  messagesList: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  messageRowUser: {
    flexDirection: 'row-reverse',
  },
  mentaAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  bubbleMenta: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: BorderRadius.xs,
    ...Shadow.sm,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: BorderRadius.xs,
  },
  bubbleText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  bubbleTextUser: {
    color: Colors.textInverse,
  },
  bubbleTime: {
    ...Typography.caption,
    color: Colors.textSecondary,
    alignSelf: 'flex-end',
  },
  bubbleTimeUser: {
    color: 'rgba(255,255,255,0.6)',
  },
  analysisBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'transparent',
    marginTop: Spacing.xs,
  },
  analysisText: {
    ...Typography.caption,
    color: Colors.accentDark,
    fontWeight: '600',
    flex: 1,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  typingText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },

  applyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    ...Shadow.md,
  },
  applyBarText: {
    ...Typography.button,
    color: Colors.textInverse,
    flex: 1,
    fontSize: 13,
  },

  chipsContainer: {
    flexGrow: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  chipsScroll: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  chipText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.border,
  },
});
