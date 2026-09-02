import { MaterialIcons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useNavigation } from '@react-navigation/native';
import type { AppNavigation } from '../../navigation/navigationTypes';
import {
  fetchMentaBootstrap,
  MentaBootstrap,
  MentaConversation,
  MentaScope,
  MentaToolCode,
  openMentaConversation,
  sendMentaMessage,
} from '../../repositories/MentaRepository';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

const TOOL_LABELS: Readonly<Record<MentaToolCode, string>> = {
  get_my_agenda: 'Agenda consultada',
  get_my_requests: 'Solicitudes consultadas',
  find_psychologists: 'Directorio consultado',
  list_my_patients: 'Pacientes autorizados consultados',
  get_patient_context: 'Contexto autorizado consultado',
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'No pudimos conectar con MENTA. Inténtalo nuevamente.';
}

function AssistantBubble({
  message,
  tools,
  unavailable,
}: {
  readonly message: string;
  readonly tools: readonly MentaToolCode[];
  readonly unavailable: boolean;
}) {
  return (
    <View style={styles.assistantRow}>
      <View style={styles.agentAvatar}>
        <MaterialIcons name="psychology" size={18} color={Colors.primary} />
      </View>
      <View style={styles.assistantBubble}>
        <Text selectable style={styles.assistantText}>{message}</Text>
        {tools.length > 0 ? (
          <View style={styles.toolList}>
            {tools.map((tool) => (
              <View key={tool} style={styles.toolBadge}>
                <MaterialIcons name="verified-user" size={13} color={Colors.primary} />
                <Text style={styles.toolBadgeText}>{TOOL_LABELS[tool]}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {unavailable ? (
          <View style={styles.availabilityNotice}>
            <MaterialIcons name="cloud-off" size={14} color={Colors.textSecondary} />
            <Text style={styles.availabilityNoticeText}>Respuesta segura de contingencia</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function MentaAgentScreen() {
  const navigation = useNavigation<AppNavigation>();
  const role = useAuthStore((state) => state.role);
  const scope: MentaScope = role === 'psychologist' ? 'PSYCHOLOGIST' : 'PATIENT';
  const scrollRef = useRef<ScrollView>(null);
  const [bootstrap, setBootstrap] = useState<MentaBootstrap | null>(null);
  const [conversation, setConversation] = useState<MentaConversation | null>(null);
  const [consentGranted, setConsentGranted] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtitle = useMemo(() => scope === 'PATIENT'
    ? 'Tu asistente para navegar Ruta Emocional'
    : 'Apoyo contextual para tu práctica profesional', [scope]);

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
    setMessage('');
    setPendingMessage(selectedMessage);
    setIsSending(true);
    setError(null);
    try {
      const turn = await sendMentaMessage(conversation.id, randomUUID(), selectedMessage);
      setConversation((current) => current
        ? { ...current, turns: [...current.turns, turn] }
        : current);
    } catch (sendError) {
      setMessage(selectedMessage);
      setError(errorMessage(sendError));
    } finally {
      setPendingMessage(null);
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.stateText}>Preparando tu contexto seguro…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bootstrap?.enabled) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centeredState}>
          <View style={styles.largeIcon}>
            <MaterialIcons name="psychology" size={42} color={Colors.primary} />
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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.consentContainer}>
          <View style={styles.largeIcon}>
            <MaterialIcons name="psychology" size={42} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Conoce a MENTA</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.disclosureCard}>
            <View style={styles.disclosureHeading}>
              <MaterialIcons name="shield" size={22} color={Colors.primary} />
              <Text style={styles.disclosureTitle}>Alcance y privacidad</Text>
            </View>
            <Text style={styles.disclosureText}>{bootstrap.disclosure}</Text>
            <Text style={styles.consentVersion}>Consentimiento {bootstrap.consentVersion}</Text>
          </View>
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setConsentGranted((current) => !current)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consentGranted }}
          >
            <MaterialIcons
              name={consentGranted ? 'check-box' : 'check-box-outline-blank'}
              size={25}
              color={consentGranted ? Colors.primary : Colors.textTertiary}
            />
            <Text style={styles.consentText}>
              Entiendo el alcance de MENTA y autorizo esta conversación contextual.
            </Text>
          </TouchableOpacity>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.primaryButton, (!consentGranted || isOpening) && styles.disabled]}
            onPress={() => void handleOpenConversation()}
            disabled={!consentGranted || isOpening}
            accessibilityRole="button"
          >
            {isOpening ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Iniciar conversación</Text>
                <MaterialIcons name="arrow-forward" size={19} color={Colors.textInverse} />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerIdentity}>
            <View style={styles.headerIcon}>
              <MaterialIcons name="psychology" size={24} color={Colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.headerTitle}>MENTA</Text>
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            </View>
          </View>
          <View style={styles.privateBadge}>
            <MaterialIcons name="lock" size={13} color={Colors.primary} />
            <Text style={styles.privateBadgeText}>Contexto privado</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {conversation.turns.length === 0 ? (
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeTitle}>
                {scope === 'PATIENT' ? '¿En qué puedo ayudarte hoy?' : '¿Qué deseas preparar o consultar?'}
              </Text>
              <Text style={styles.welcomeText}>
                Consultaré únicamente la información de Ruta Emocional necesaria para responder.
              </Text>
              <View style={styles.suggestions}>
                {bootstrap.suggestedPrompts.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={styles.suggestion}
                    onPress={() => void handleSend(prompt)}
                    disabled={isSending}
                  >
                    <Text style={styles.suggestionText}>{prompt}</Text>
                    <MaterialIcons name="north-east" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {conversation.turns.map((turn) => (
            <View key={turn.id} style={styles.turn}>
              <View style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Text selectable style={styles.userText}>{turn.userMessage}</Text>
                </View>
              </View>
              <AssistantBubble
                message={turn.assistantMessage}
                tools={turn.toolsUsed}
                unavailable={turn.providerOutcome === 'UNAVAILABLE' || turn.providerOutcome === 'REJECTED_OUTPUT'}
              />
            </View>
          ))}

          {pendingMessage ? (
            <View style={styles.turn}>
              <View style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{pendingMessage}</Text>
                </View>
              </View>
              <View style={styles.assistantRow}>
                <View style={styles.agentAvatar}>
                  <MaterialIcons name="psychology" size={18} color={Colors.primary} />
                </View>
                <View style={styles.typingBubble}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.typingText}>Consultando contexto autorizado…</Text>
                </View>
              </View>
            </View>
          ) : null}

          {scope === 'PATIENT' ? (
            <TouchableOpacity
              style={styles.safetyLink}
              onPress={() => navigation.navigate('MentaSafety')}
              accessibilityRole="button"
            >
              <MaterialIcons name="health-and-safety" size={18} color={Colors.primary} />
              <Text style={styles.safetyLinkText}>Abrir orientación estructurada de seguridad</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.draftNotice}>
              <MaterialIcons name="fact-check" size={17} color={Colors.textSecondary} />
              <Text style={styles.draftNoticeText}>
                Todo contenido clínico generado es un borrador y requiere tu revisión profesional.
              </Text>
            </View>
          )}
        </ScrollView>

        {error ? (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={18} color={Colors.error} />
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
            editable={!isSending}
            accessibilityLabel="Mensaje para MENTA"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!message.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={() => void handleSend()}
            disabled={!message.trim() || isSending}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
          >
            <MaterialIcons name="arrow-upward" size={22} color={Colors.textInverse} />
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
  disclosureCard: {
    width: '100%',
    maxWidth: 560,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  disclosureHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  disclosureTitle: { ...Typography.h4, color: Colors.textPrimary },
  disclosureText: { ...Typography.body, color: Colors.textSecondary },
  consentVersion: { ...Typography.caption, color: Colors.textTertiary },
  consentRow: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  consentText: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  primaryButton: {
    width: '100%',
    maxWidth: 560,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: { ...Typography.button, color: Colors.textInverse },
  disabled: { opacity: 0.5 },
  errorText: { ...Typography.bodySmall, color: Colors.error, textAlign: 'center' },
  header: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  headerTitle: { ...Typography.h3, color: Colors.textPrimary },
  headerSubtitle: { ...Typography.caption, color: Colors.textSecondary },
  privateBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryTint,
  },
  privateBadgeText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  messagesContent: { padding: Spacing.base, paddingBottom: Spacing.xl, gap: Spacing.lg },
  welcomeCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
    gap: Spacing.sm,
  },
  welcomeTitle: { ...Typography.h3, color: Colors.textPrimary },
  welcomeText: { ...Typography.body, color: Colors.textSecondary },
  suggestions: { gap: Spacing.sm, marginTop: Spacing.sm },
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
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingRight: Spacing.xl },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  assistantBubble: {
    flexShrink: 1,
    maxWidth: '90%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderTopLeftRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  assistantText: { ...Typography.body, color: Colors.textPrimary },
  toolList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  toolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryTint,
  },
  toolBadgeText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  availabilityNotice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  availabilityNoticeText: { ...Typography.caption, color: Colors.textSecondary },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  typingText: { ...Typography.bodySmall, color: Colors.textSecondary },
  safetyLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  safetyLinkText: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '600' },
  draftNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSoft,
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
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
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
