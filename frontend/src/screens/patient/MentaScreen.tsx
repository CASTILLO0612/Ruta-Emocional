import { randomUUID } from 'expo-crypto';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppButton } from '../../components/common/AppButton';
import {
  createTriageAssessment,
  fetchTriagePolicy,
  TriageAssessment,
  TriageModality,
  TriagePolicy,
  TriageRiskLevel,
} from '../../repositories/TriageRepository';
import { ApiError } from '../../services/apiClient';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

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

interface PendingAttempt {
  readonly fingerprint: string;
  readonly idempotencyKey: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return 'No pudimos completar la orientación. Intenta nuevamente.';
}

function riskColor(riskLevel: TriageRiskLevel): string {
  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') return Colors.error;
  if (riskLevel === 'MODERATE') return Colors.warning;
  return Colors.primary;
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

  if (loadingPolicy && !policy) {
    return (
      <View style={styles.centered}>
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
          <MaterialIcons name="health-and-safety" size={21} color={Colors.textInverse} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>MENTA</Text>
          <Text style={styles.headerSubtitle}>Orientación automatizada y privada</Text>
        </View>
        <MaterialIcons name="lock-outline" size={20} color={Colors.primary} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!policy ? (
          <View style={styles.stateCard}>
            <MaterialIcons name="cloud-off" size={30} color={Colors.textTertiary} />
            <Text style={styles.stateTitle}>Orientación no disponible</Text>
            <Text style={styles.stateText}>{error}</Text>
            <AppButton label="Volver a intentar" onPress={loadPolicy} variant="outline" />
          </View>
        ) : assessment ? (
          <AssessmentResult assessment={assessment} onRestart={restart} />
        ) : (
          <>
            <View style={styles.noticeCard}>
              <MaterialIcons name="smart-toy" size={22} color={Colors.primary} />
              <View style={styles.noticeCopy}>
                <Text style={styles.noticeTitle}>Sistema automatizado</Text>
                <Text style={styles.noticeText}>{policy.automatedSystemNotice}</Text>
                <Text style={styles.emergencyText}>{policy.emergencyDisclaimer}</Text>
              </View>
            </View>

            {!policy.protocolApproved && (
              <View style={styles.demoBanner}>
                <MaterialIcons name="science" size={19} color={Colors.warning} />
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
                <View style={styles.options} accessibilityRole="radiogroup">
                  {question.options.map((option) => {
                    const selected = answers[question.code] === option.code;
                    return (
                      <TouchableOpacity
                        key={option.code}
                        style={[styles.option, selected && styles.optionSelected]}
                        onPress={() => selectAnswer(question.code, option.code)}
                        activeOpacity={0.8}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                      >
                        <MaterialIcons
                          name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                          size={20}
                          color={selected ? Colors.primary : Colors.textTertiary}
                        />
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
              accessibilityState={{ checked: consentGranted }}
            >
              <MaterialIcons
                name={consentGranted ? 'check-box' : 'check-box-outline-blank'}
                size={23}
                color={consentGranted ? Colors.primary : Colors.textTertiary}
              />
              <View style={styles.consentCopy}>
                <Text style={styles.consentTitle}>{policy.consentDocument.title}</Text>
                <Text style={styles.consentText}>{policy.consentDocument.content}</Text>
                <Text style={styles.consentVersion}>Versión {policy.consentDocument.version}</Text>
              </View>
            </TouchableOpacity>

            {error && (
              <View style={styles.errorCard}>
                <MaterialIcons name="error-outline" size={20} color={Colors.error} />
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
              icon={<MaterialIcons name="arrow-forward" size={19} color={Colors.primary} />}
            />
            <Text style={styles.privacyNote}>
              Solo se envían las opciones seleccionadas. Este formulario no solicita texto clínico libre.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const AssessmentResult: React.FC<{
  readonly assessment: TriageAssessment;
  readonly onRestart: () => void;
}> = ({ assessment, onRestart }) => {
  const accentColor = riskColor(assessment.riskLevel);
  return (
    <>
      {assessment.requiresImmediateHelp && (
        <View style={styles.immediateCard}>
          <View style={styles.immediateHeading}>
            <MaterialIcons name="crisis-alert" size={25} color={Colors.error} />
            <Text style={styles.immediateTitle}>Tu seguridad es lo primero</Text>
          </View>
          {assessment.safetyActions.map((action) => (
            <View key={action} style={styles.actionRow}>
              <MaterialIcons name="arrow-right" size={19} color={Colors.error} />
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
            >
              <MaterialIcons
                name={resource.channel === 'PHONE' ? 'call' : 'open-in-new'}
                size={21}
                color={Colors.textInverse}
              />
              <View style={styles.resourceCopy}>
                <Text style={styles.resourceLabel}>{resource.label}</Text>
                <Text style={styles.resourceValue}>{resource.value}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[styles.resultCard, { borderTopColor: accentColor }]}>
        <View style={styles.resultHeading}>
          <View style={[styles.resultIcon, { backgroundColor: `${accentColor}16` }]}>
            <MaterialIcons name="insights" size={27} color={accentColor} />
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
                  <MaterialIcons
                    name={modality === 'CHAT' ? 'chat' : modality === 'CALL' ? 'call' : 'person-pin-circle'}
                    size={17}
                    color={Colors.primary}
                  />
                  <Text style={styles.modalityText}>{MODALITY_LABELS[modality]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.transparencyRow}>
          <MaterialIcons name="verified-user" size={17} color={Colors.textTertiary} />
          <Text style={styles.transparencyText}>
            Resultado automatizado, no diagnóstico · Reglas {assessment.evaluatorVersion}
          </Text>
        </View>
      </View>

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
  emergencyText: { ...Typography.bodySmall, fontWeight: '700', color: Colors.textPrimary },
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
  progressText: { ...Typography.bodySmall, fontWeight: '700', color: Colors.primary },
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
  optionLabel: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
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
  consentVersion: { ...Typography.caption, fontWeight: '700', color: Colors.primary },
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
  resourceLabel: { ...Typography.body, fontWeight: '700', color: Colors.textInverse },
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
  modalityText: { ...Typography.bodySmall, fontWeight: '700', color: Colors.primary },
  transparencyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  transparencyText: { ...Typography.caption, flex: 1, color: Colors.textTertiary },
});
