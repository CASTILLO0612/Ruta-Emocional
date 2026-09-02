import { randomUUID } from 'expo-crypto';
import {
  ArrowRight,
  Bot,
  ChartNoAxesColumnIncreasing,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Clock3,
  CloudOff,
  ExternalLink,
  FlaskConical,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  Shield,
  ShieldCheck,
  Siren,
  Square,
  SquareCheckBig,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../components/common/AppButton';
import { CustomAlert } from '../../components/common/CustomAlert';
import {
  createTriageAssessment,
  fetchTriagePolicy,
  TriageAssessment,
  TriageModality,
  TriagePolicy,
  TriageRiskLevel,
  requestTriageErasure,
  withdrawTriageConsent,
} from '../../repositories/TriageRepository';
import { ApiError } from '../../services/apiClient';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';

const MODALITY_LABELS: Readonly<Record<TriageModality, string>> = {
  CHAT: 'Chat seguro',
  CALL: 'Llamada',
  IN_PERSON: 'Atención presencial',
};

const RISK_LABELS: Readonly<Record<TriageRiskLevel, string>> = {
  LOW: 'Orientación inicial',
  MODERATE: 'Apoyo recomendado',
  HIGH: 'Busca apoyo inmediato',
  CRITICAL: 'Atención inmediata',
};

const ERASURE_STATUS_LABELS = {
  BLOCKED: 'bloqueada',
  UNDER_REVIEW: 'en revisión',
  RESOLVED: 'resuelta',
  DENIED: 'denegada',
} as const;

interface PendingAttempt {
  readonly fingerprint: string;
  readonly idempotencyKey: string;
}

type PrivacyAction = 'WITHDRAW_CONSENT' | 'REQUEST_ERASURE';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return 'No pudimos completar la orientación. Intenta nuevamente.';
}

function riskColor(riskLevel: TriageRiskLevel): string {
  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') return Colors.error;
  if (riskLevel === 'MODERATE') return Colors.warning;
  return Colors.primary;
}

function riskSurface(riskLevel: TriageRiskLevel): string {
  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') return Colors.errorSurface;
  if (riskLevel === 'MODERATE') return Colors.warningSurface;
  return Colors.primaryTint;
}

function ModalityIcon({ modality }: { readonly modality: TriageModality }) {
  if (modality === 'CHAT') return <MessageCircle size={17} color={Colors.primary} strokeWidth={1.9} />;
  if (modality === 'CALL') return <PhoneCall size={17} color={Colors.primary} strokeWidth={1.9} />;
  return <MapPin size={17} color={Colors.primary} strokeWidth={1.9} />;
}

function resourceTarget(channel: 'PHONE' | 'URL', value: string): string {
  return channel === 'PHONE' ? `tel:${value.replace(/[^+\d]/g, '')}` : value;
}

export const MentaScreen: React.FC = () => {
  const [policy, setPolicy] = useState<TriagePolicy | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consentGranted, setConsentGranted] = useState(false);
  const [assessment, setAssessment] = useState<TriageAssessment | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyAction, setPrivacyAction] = useState<PrivacyAction | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const pendingAttempt = useRef<PendingAttempt | null>(null);

  const loadPolicy = () => {
    const controller = new AbortController();
    setLoadingPolicy(true);
    setError(null);
    void fetchTriagePolicy(controller.signal)
      .then((nextPolicy) => setPolicy(nextPolicy))
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setError(errorMessage(loadError));
      })
      .finally(() => setLoadingPolicy(false));
    return controller;
  };

  useEffect(() => {
    const controller = loadPolicy();
    return () => controller.abort();
  }, []);

  const requiredQuestions = useMemo(
    () => policy?.questions.filter((question) => question.required) ?? [],
    [policy]
  );
  const answeredRequired = requiredQuestions.filter((question) => Boolean(answers[question.code])).length;
  const canSubmit = Boolean(
    policy
    && policy.enabled
    && consentGranted
    && answeredRequired === requiredQuestions.length
    && requiredQuestions.length > 0
  );

  const selectAnswer = (questionCode: string, optionCode: string) => {
    setAnswers((current) => ({ ...current, [questionCode]: optionCode }));
    setError(null);
    pendingAttempt.current = null;
  };

  const submit = async () => {
    if (!policy || !canSubmit) return;
    const fingerprint = JSON.stringify({
      answers: policy.questions.map(({ code }) => [code, answers[code]]),
      consentDocument: `${policy.consentDocument.code}:${policy.consentDocument.version}`,
    });
    if (pendingAttempt.current?.fingerprint !== fingerprint) {
      pendingAttempt.current = { fingerprint, idempotencyKey: randomUUID() };
    }
    setSubmitting(true);
    setError(null);
    try {
      setAssessment(await createTriageAssessment(
        { policy, answers },
        pendingAttempt.current.idempotencyKey
      ));
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setAnswers({});
    setConsentGranted(false);
    setAssessment(null);
    setError(null);
    pendingAttempt.current = null;
  };

  const confirmPrivacyAction = async () => {
    if (!assessment || !privacyAction || privacyBusy) return;
    setPrivacyBusy(true);
    setError(null);
    try {
      const updated = privacyAction === 'WITHDRAW_CONSENT'
        ? await withdrawTriageConsent(assessment.id)
        : await requestTriageErasure(assessment.id);
      setAssessment(updated);
      setPrivacyAction(null);
    } catch (privacyError) {
      setError(errorMessage(privacyError));
      setPrivacyAction(null);
    } finally {
      setPrivacyBusy(false);
    }
  };

  if (loadingPolicy && !policy) {
    return (
      <View style={styles.centered} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando orientación segura...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <ShieldCheck size={21} color={Colors.textInverse} strokeWidth={1.9} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>MENTA</Text>
          <Text style={styles.headerSubtitle}>Orientación automatizada y privada</Text>
        </View>
        <Shield size={20} color={Colors.primary} strokeWidth={1.9} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!policy ? (
          <View style={styles.stateCard}>
            <CloudOff size={30} color={Colors.textTertiary} strokeWidth={1.7} />
            <Text style={styles.stateTitle}>Orientación no disponible</Text>
            <Text style={styles.stateText}>{error}</Text>
            <AppButton label="Volver a intentar" onPress={loadPolicy} variant="outline" />
          </View>
        ) : assessment ? (
          <AssessmentResult
            assessment={assessment}
            onRestart={restart}
            onPrivacyAction={setPrivacyAction}
            privacyBusy={privacyBusy}
            privacyError={error}
          />
        ) : (
          <>
            <View style={styles.noticeCard}>
              <Bot size={22} color={Colors.primary} strokeWidth={1.8} />
              <View style={styles.noticeCopy}>
                <Text style={styles.noticeTitle}>Sistema automatizado</Text>
                <Text style={styles.noticeText}>{policy.automatedSystemNotice}</Text>
                <Text style={styles.emergencyText}>{policy.emergencyDisclaimer}</Text>
              </View>
            </View>

            {!policy.protocolApproved && (
              <View style={styles.demoBanner}>
                <FlaskConical size={19} color={Colors.warning} strokeWidth={1.9} />
                <Text style={styles.demoText}>
                  Entorno de demostración. El protocolo requiere aprobación clínica antes de producción.
                </Text>
              </View>
            )}

            <View style={styles.progressRow}>
              <Text style={styles.sectionTitle}>Cuéntanos mediante opciones</Text>
              <Text style={styles.progressText}>{answeredRequired}/{requiredQuestions.length}</Text>
            </View>

            {policy.questions.map((question, index) => (
              <View key={question.code} style={styles.questionCard}>
                <View style={styles.questionHeading}>
                  <Text style={styles.questionNumber}>{String(index + 1).padStart(2, '0')}</Text>
                  <View style={styles.questionCopy}>
                    <Text style={styles.questionPrompt}>{question.prompt}</Text>
                    {question.helpText && <Text style={styles.questionHelp}>{question.helpText}</Text>}
                  </View>
                </View>
                <View
                  style={styles.options}
                  accessibilityRole="radiogroup"
                  accessibilityLabel={question.prompt}
                >
                  {question.options.map((option) => {
                    const selected = answers[question.code] === option.code;
                    return (
                      <TouchableOpacity
                        key={option.code}
                        style={[styles.option, selected && styles.optionSelected]}
                        onPress={() => selectAnswer(question.code, option.code)}
                        activeOpacity={0.8}
                        accessibilityRole="radio"
                        accessibilityLabel={option.label}
                        accessibilityHint={option.helpText ?? undefined}
                        accessibilityState={{ checked: selected }}
                      >
                        {selected
                          ? <CircleDot size={20} color={Colors.primary} strokeWidth={2} />
                          : <Circle size={20} color={Colors.textTertiary} strokeWidth={1.8} />}
                        <View style={styles.optionCopy}>
                          <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                            {option.label}
                          </Text>
                          {option.helpText && <Text style={styles.optionHelp}>{option.helpText}</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.consentCard, consentGranted && styles.consentCardSelected]}
              onPress={() => {
                setConsentGranted((current) => !current);
                setError(null);
                pendingAttempt.current = null;
              }}
              activeOpacity={0.82}
              accessibilityRole="checkbox"
              accessibilityLabel={`Aceptar ${policy.consentDocument.title}, versión ${policy.consentDocument.version}`}
              accessibilityHint="Puedes retirar este consentimiento después desde la evaluación."
              accessibilityState={{ checked: consentGranted }}
            >
              {consentGranted
                ? <SquareCheckBig size={23} color={Colors.primary} strokeWidth={2} />
                : <Square size={23} color={Colors.textTertiary} strokeWidth={1.8} />}
              <View style={styles.consentCopy}>
                <Text style={styles.consentTitle}>{policy.consentDocument.title}</Text>
                <Text style={styles.consentText}>{policy.consentDocument.content}</Text>
                <Text style={styles.consentVersion}>Versión {policy.consentDocument.version}</Text>
              </View>
            </TouchableOpacity>

            {error && (
              <View
                style={styles.errorCard}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                <CircleAlert size={20} color={Colors.error} strokeWidth={1.9} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <AppButton
              label="Obtener orientación"
              onPress={submit}
              fullWidth
              size="lg"
              isLoading={submitting}
              disabled={!canSubmit}
              icon={<ArrowRight size={19} color={Colors.textInverse} strokeWidth={2} />}
              accessibilityHint="Procesa únicamente las opciones seleccionadas."
            />
            <Text style={styles.privacyNote}>
              Solo se envían las opciones seleccionadas. Este formulario no solicita texto clínico libre.
            </Text>
          </>
        )}
      </ScrollView>
      <CustomAlert
        visible={privacyAction !== null}
        title={privacyAction === 'WITHDRAW_CONSENT'
          ? 'Retirar consentimiento'
          : 'Solicitar revisión de eliminación'}
        message={privacyAction === 'WITHDRAW_CONSENT'
          ? 'Ruta Emocional dejará de usar esta orientación en flujos nuevos. La decisión no modifica el historial previo.'
          : 'La evaluación quedará bloqueada mientras se revisan las obligaciones legales de conservación y eliminación.'}
        confirmText={privacyAction === 'WITHDRAW_CONSENT' ? 'Retirar' : 'Enviar solicitud'}
        cancelText="Volver"
        showCancel
        onCancel={() => !privacyBusy && setPrivacyAction(null)}
        onConfirm={() => void confirmPrivacyAction()}
      />
    </SafeAreaView>
  );
};

const AssessmentResult: React.FC<{
  readonly assessment: TriageAssessment;
  readonly onRestart: () => void;
  readonly onPrivacyAction: (action: PrivacyAction) => void;
  readonly privacyBusy: boolean;
  readonly privacyError: string | null;
}> = ({ assessment, onRestart, onPrivacyAction, privacyBusy, privacyError }) => {
  const accentColor = riskColor(assessment.riskLevel);
  return (
    <>
      {assessment.requiresImmediateHelp && (
        <View
          style={styles.immediateCard}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          accessibilityLabel="Tu seguridad es lo primero. Revisa las acciones y recursos inmediatos."
        >
          <View style={styles.immediateHeading}>
            <Siren size={25} color={Colors.error} strokeWidth={1.9} />
            <Text style={styles.immediateTitle}>Tu seguridad es lo primero</Text>
          </View>
          {assessment.safetyActions.map((action) => (
            <View key={action} style={styles.actionRow}>
              <ArrowRight size={19} color={Colors.error} strokeWidth={2} />
              <Text style={styles.actionText}>{action}</Text>
            </View>
          ))}
          {assessment.crisisResources.map((resource) => (
            <TouchableOpacity
              key={resource.code}
              style={styles.resourceButton}
              onPress={() => void Linking.openURL(resourceTarget(resource.channel, resource.value))}
              activeOpacity={0.82}
              accessibilityRole="link"
              accessibilityLabel={`${resource.label}: ${resource.value}`}
              accessibilityHint={resource.channel === 'PHONE' ? 'Inicia una llamada.' : 'Abre el recurso externo.'}
            >
              {resource.channel === 'PHONE'
                ? <Phone size={21} color={Colors.textInverse} strokeWidth={2} />
                : <ExternalLink size={21} color={Colors.textInverse} strokeWidth={2} />}
              <View style={styles.resourceCopy}>
                <Text style={styles.resourceLabel}>{resource.label}</Text>
                <Text style={styles.resourceValue}>{resource.value}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View
        style={[styles.resultCard, { borderTopColor: accentColor }]}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.resultHeading}>
          <View style={[styles.resultIcon, { backgroundColor: riskSurface(assessment.riskLevel) }]}>
            <ChartNoAxesColumnIncreasing size={27} color={accentColor} strokeWidth={1.8} />
          </View>
          <View style={styles.resultHeadingCopy}>
            <Text style={[styles.riskLabel, { color: accentColor }]}>
              {RISK_LABELS[assessment.riskLevel]}
            </Text>
            <Text style={styles.needLabel}>{assessment.primaryNeed.name}</Text>
          </View>
        </View>
        <Text style={styles.summary}>{assessment.orientationSummary}</Text>

        {assessment.recommendedModalities.length > 0 && (
          <View style={styles.modalitiesSection}>
            <Text style={styles.resultSectionTitle}>Modalidades sugeridas</Text>
            <View style={styles.modalityList}>
              {assessment.recommendedModalities.map((modality) => (
                <View key={modality} style={styles.modalityChip}>
                  <ModalityIcon modality={modality} />
                  <Text style={styles.modalityText}>{MODALITY_LABELS[modality]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.transparencyRow}>
          <ShieldCheck size={17} color={Colors.textTertiary} strokeWidth={1.9} />
          <Text style={styles.transparencyText}>
            Resultado automatizado, no diagnóstico · Reglas {assessment.evaluatorVersion}
          </Text>
        </View>
      </View>

      <View style={styles.privacyControls}>
        <View style={styles.privacyControlsHeading}>
          <Shield size={21} color={Colors.primary} strokeWidth={1.9} />
          <View style={styles.privacyControlsCopy}>
            <Text style={styles.resultSectionTitle}>Control de tus datos</Text>
            <Text style={styles.privacyControlsText}>
              Puedes retirar el consentimiento o solicitar la revisión de eliminación de esta evaluación.
            </Text>
          </View>
        </View>

        {assessment.consentWithdrawnAt ? (
          <View style={styles.privacyStatus} accessibilityLiveRegion="polite">
            <CircleCheck size={19} color={Colors.primary} strokeWidth={1.9} />
            <Text style={styles.privacyStatusText}>Consentimiento retirado.</Text>
          </View>
        ) : (
          <AppButton
            label="Retirar consentimiento"
            onPress={() => onPrivacyAction('WITHDRAW_CONSENT')}
            variant="outline"
            fullWidth
            disabled={privacyBusy}
            accessibilityHint="Requiere confirmación y bloquea usos nuevos de esta orientación."
          />
        )}

        {assessment.erasureRequest ? (
          <View style={styles.privacyStatus} accessibilityLiveRegion="polite">
            <Clock3 size={19} color={Colors.primary} strokeWidth={1.9} />
            <Text style={styles.privacyStatusText}>
              Solicitud recibida · {ERASURE_STATUS_LABELS[assessment.erasureRequest.status]}
            </Text>
          </View>
        ) : (
          <AppButton
            label="Solicitar revisión de eliminación"
            onPress={() => onPrivacyAction('REQUEST_ERASURE')}
            variant="ghost"
            fullWidth
            disabled={privacyBusy}
            accessibilityHint="Bloquea el procesamiento mientras se revisa la retención aplicable."
          />
        )}
      </View>

      {privacyError && (
        <View
          style={styles.errorCard}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <CircleAlert size={20} color={Colors.error} strokeWidth={1.9} />
          <Text style={styles.errorText}>{privacyError}</Text>
        </View>
      )}

      <AppButton label="Nueva orientación" onPress={onRestart} variant="outline" fullWidth />
    </>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
  },
  loadingText: { ...Typography.body, color: Colors.textSecondary },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  headerCopy: { flex: 1 },
  headerTitle: { ...Typography.h4, color: Colors.textPrimary },
  headerSubtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: Spacing.base,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.base,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryTint,
  },
  noticeCopy: { flex: 1, gap: Spacing.xs },
  noticeTitle: { ...Typography.h4, color: Colors.primary },
  noticeText: { ...Typography.bodySmall, color: Colors.textSecondary },
  emergencyText: { ...Typography.bodySmall, fontFamily: FontFamily.bodyBold, color: Colors.textPrimary },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.warningSurface,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  demoText: { ...Typography.bodySmall, flex: 1, color: Colors.textSecondary },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  sectionTitle: { ...Typography.h3, color: Colors.textPrimary },
  progressText: { ...Typography.bodySmall, fontFamily: FontFamily.bodyBold, color: Colors.primary },
  questionCard: {
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
  },
  questionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  questionNumber: { ...Typography.overline, color: Colors.primary, paddingTop: 3 },
  questionCopy: { flex: 1, gap: Spacing.xs },
  questionPrompt: { ...Typography.h4, color: Colors.textPrimary },
  questionHelp: { ...Typography.bodySmall, color: Colors.textSecondary },
  options: { gap: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 50,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSoft,
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryTint },
  optionCopy: { flex: 1 },
  optionLabel: { ...Typography.body, fontFamily: FontFamily.bodySemiBold, color: Colors.textPrimary },
  optionLabelSelected: { color: Colors.primary },
  optionHelp: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  consentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
  },
  consentCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryTint },
  consentCopy: { flex: 1, gap: Spacing.xs },
  consentTitle: { ...Typography.h4, color: Colors.textPrimary },
  consentText: { ...Typography.bodySmall, color: Colors.textSecondary },
  consentVersion: { ...Typography.caption, fontFamily: FontFamily.bodyBold, color: Colors.primary },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.errorSurface,
  },
  errorText: { ...Typography.bodySmall, flex: 1, color: Colors.error },
  privacyNote: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center' },
  stateCard: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxxl },
  stateTitle: { ...Typography.h3, color: Colors.textPrimary },
  stateText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  immediateCard: {
    padding: Spacing.base,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.errorSurface,
  },
  immediateHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  immediateTitle: { ...Typography.h3, flex: 1, color: Colors.error },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  actionText: { ...Typography.body, flex: 1, color: Colors.textPrimary },
  resourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.error,
  },
  resourceCopy: { flex: 1 },
  resourceLabel: { ...Typography.body, fontFamily: FontFamily.bodyBold, color: Colors.textInverse },
  resourceValue: { ...Typography.caption, color: Colors.textInverse, marginTop: 2 },
  resultCard: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
  },
  resultHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  resultIcon: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
  },
  resultHeadingCopy: { flex: 1, gap: 2 },
  riskLabel: { ...Typography.overline },
  needLabel: { ...Typography.h2, color: Colors.textPrimary },
  summary: { ...Typography.bodyLarge, color: Colors.textPrimary },
  modalitiesSection: { gap: Spacing.sm },
  resultSectionTitle: { ...Typography.h4, color: Colors.textPrimary },
  modalityList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  modalityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryTint,
  },
  modalityText: { ...Typography.bodySmall, fontFamily: FontFamily.bodyBold, color: Colors.primary },
  transparencyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  transparencyText: { ...Typography.caption, flex: 1, color: Colors.textTertiary },
  privacyControls: {
    padding: Spacing.base,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
  },
  privacyControlsHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  privacyControlsCopy: { flex: 1, gap: Spacing.xs },
  privacyControlsText: { ...Typography.bodySmall, color: Colors.textSecondary },
  privacyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryTint,
  },
  privacyStatusText: { ...Typography.bodySmall, flex: 1, fontFamily: FontFamily.bodyBold, color: Colors.primary },
});
