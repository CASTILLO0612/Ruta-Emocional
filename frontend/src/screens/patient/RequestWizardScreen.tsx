import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Clock, Calendar, Check, AlertCircle, MapPin, Minus, Plus } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { IconSize } from '../../theme/icons';
import { Modality } from '../../models/Psychologist';
import { useRequestStore } from '../../store/useRequestStore';
import { useAuthStore } from '../../store/useAuthStore';
import {
  getServiceRequestPolicy,
  ServiceRequestPolicy,
} from '../../repositories/RequestRepository';
import { ModalitySelector } from '../../components/patient/ModalitySelector';
import { BudgetInput } from '../../components/patient/BudgetInput';
import { WizardScaffold } from '../../components/wizard/WizardScaffold';
import { RequestSummary } from '../../components/wizard/RequestSummary';
import { ScheduleDateTimeInput } from '../../components/wizard/ScheduleDateTimeInput';
import { AppButton } from '../../components/common/AppButton';
import {
  validateWizardStep,
  WizardDraft,
  BudgetLimits,
} from '../../utils/validateWizardStep';
import { mapWizardDraftToPayload } from '../../utils/mapWizardDraftToPayload';
import type { PatientSearchNavigation } from '../../navigation/navigationTypes';
import { presentUserError } from '../../utils/userFacingError';
import {
  clearRequestWizardDraft,
  loadRequestWizardDraft,
  saveRequestWizardDraft,
} from '../../services/persistence/requestWizardPersistence';
import { PersistenceCadence } from '../../theme/motion';

export const RequestWizardScreen: React.FC = () => {
  const navigation = useNavigation<PatientSearchNavigation>();
  const userProfile = useAuthStore((state) => state.userProfile);
  const createSessionRequest = useRequestStore((state) => state.createSessionRequest);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [policy, setPolicy] = useState<ServiceRequestPolicy | null>(null);
  const [isPolicyLoading, setIsPolicyLoading] = useState(true);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [showContextInput, setShowContextInput] = useState(false);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);

  const [draft, setDraft] = useState<WizardDraft>({
    primaryNeed: '',
    description: '',
    modality: 'chat',
    timing: 'immediate',
    scheduledFor: undefined,
    proposedBudgetInput: '',
    currencyCode: undefined,
  });

  const loadPolicy = useCallback(async (signal?: AbortSignal) => {
    setIsPolicyLoading(true);
    setPolicyError(null);
    try {
      const nextPolicy = await getServiceRequestPolicy(signal);
      if (signal?.aborted) return;
      setPolicy(nextPolicy);
      setDraft((previous) => ({
        ...previous,
        currencyCode: nextPolicy.supportedCurrencies[0],
      }));
    } catch {
      if (signal?.aborted) return;
      setPolicy(null);
      setPolicyError('No pudimos cargar los límites y la moneda configurados.');
    } finally {
      if (!signal?.aborted) setIsPolicyLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPolicy(controller.signal);

    return () => controller.abort();
  }, [loadPolicy]);

  useEffect(() => {
    if (!userProfile?.id) return;
    let active = true;
    setIsDraftHydrated(false);
    void loadRequestWizardDraft(userProfile.id)
      .then((storedDraft) => {
        if (!active || !storedDraft) return;
        setDraft(storedDraft);
        setShowContextInput(Boolean(storedDraft.primaryNeed));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsDraftHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [userProfile?.id]);

  useEffect(() => {
    if (!userProfile?.id || !isDraftHydrated) return;
    const timer = setTimeout(() => {
      void saveRequestWizardDraft(userProfile.id, draft).catch(() => undefined);
    }, PersistenceCadence.requestDraft);
    return () => clearTimeout(timer);
  }, [draft, isDraftHydrated, userProfile?.id]);

  useEffect(() => {
    if (!policy || !isDraftHydrated) return;
    setDraft((current) => ({
      ...current,
      currencyCode: current.currencyCode
        && policy.supportedCurrencies.includes(current.currencyCode)
        ? current.currencyCode
        : policy.supportedCurrencies[0],
    }));
  }, [isDraftHydrated, policy]);

  const handleScheduledDateChange = useCallback((scheduledFor?: Date) => {
    setDraft((previous) => {
      if (previous.scheduledFor?.getTime() === scheduledFor?.getTime()) return previous;
      return { ...previous, scheduledFor };
    });
  }, []);

  const budgetLimits: BudgetLimits | undefined = policy
    ? {
        minimumAmount: Number(policy.minimumAmount),
        maximumAmount: Number(policy.maximumAmount),
      }
    : undefined;

  const isCurrentStepValid = validateWizardStep(step, draft, budgetLimits);
  const currencyCode = draft.currencyCode;

  const handleNext = () => {
    if (!isCurrentStepValid) return;
    if (step < 5) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5);
    } else {
      void handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !isCurrentStepValid) return;
    if (!userProfile?.id) {
      setSubmissionError('Tu sesión ya no está disponible. Vuelve a iniciar sesión.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      if (!policy) {
        throw new Error('La configuración de solicitudes no está disponible. Intenta nuevamente.');
      }
      const payload = mapWizardDraftToPayload(draft);
      await createSessionRequest(payload, userProfile.id);
      await clearRequestWizardDraft(userProfile.id).catch(() => undefined);
    } catch (error) {
      setSubmissionError(
        presentUserError(error, 'No pudimos publicar la solicitud. Inténtalo nuevamente.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'Motivo de consulta';
      case 2:
        return 'Modalidad de atención';
      case 3:
        return 'Horario preferido';
      case 4:
        return 'Presupuesto';
      case 5:
        return 'Confirmación';
    }
  };

  return (
    <WizardScaffold
      currentStep={step}
      stepTitle={getStepTitle()}
      onBack={handleBack}
      onContinue={handleNext}
      isContinueDisabled={!isCurrentStepValid}
      isSubmitting={isSubmitting}
      continueLabel={step === 5 ? 'Publicar solicitud' : 'Continuar'}
    >
      {submissionError && (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <AlertCircle size={IconSize.inline} color={Colors.error} />
          <Text style={[Typography.bodySmall, styles.errorText]}>
            {submissionError}
          </Text>
        </View>
      )}

      {step === 1 && (
        <View style={styles.stepContainer}>
          <Text style={[Typography.h3, styles.stepHeader]}>
            ¿Cómo podemos ayudarte?
          </Text>
          <Text style={[Typography.body, styles.stepSubheader]}>
            Añade una breve descripción para orientar al profesional.
          </Text>

          <TouchableOpacity
            style={styles.optionalAction}
            onPress={() => setShowContextInput((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={showContextInput ? 'Ocultar contexto' : 'Añadir contexto'}
            accessibilityState={{ expanded: showContextInput }}
          >
            {showContextInput ? (
              <Minus size={IconSize.inline} color={Colors.primary} />
            ) : (
              <Plus size={IconSize.inline} color={Colors.primary} />
            )}
            <Text style={styles.optionalActionText}>
              {showContextInput ? 'Ocultar contexto' : 'Añadir contexto'}
            </Text>
          </TouchableOpacity>

          {showContextInput ? (
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={draft.primaryNeed}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, primaryNeed: text }))}
              placeholder="Describe brevemente lo que necesitas"
              placeholderTextColor={Colors.textDisabled}
              multiline
              numberOfLines={4}
              maxLength={policy?.maximumPrimaryNeedLength}
              autoFocus
              accessibilityLabel="Contexto de la solicitud"
            />
          ) : null}
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepContainer}>
          <Text style={[Typography.h3, styles.stepHeader]}>
            ¿Cómo deseas recibir tu sesión?
          </Text>
          <Text style={[Typography.body, styles.stepSubheader]}>
            Elige la modalidad más cómoda y accesible para ti.
          </Text>

          <ModalitySelector
            selected={draft.modality || 'chat'}
            onSelect={(modality) => setDraft((prev) => ({ ...prev, modality }))}
          />

          {draft.modality === 'in-person' && (
            <View style={styles.infoBox}>
              <MapPin size={16} color={Colors.primary} />
              <Text style={[Typography.caption, styles.infoBoxText]}>
                Para atención presencial, los psicólogos verificados te propondrán sesiones en consultorio según su disponibilidad.
              </Text>
            </View>
          )}
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContainer}>
          <Text style={[Typography.h3, styles.stepHeader]}>
            ¿Cuándo necesitas la atención?
          </Text>
          <Text style={[Typography.body, styles.stepSubheader]}>
            Indica si buscas atención para hoy o prefieres programarla.
          </Text>

          <View style={styles.optionCardsContainer}>
            <TouchableOpacity
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  timing: 'immediate',
                  scheduledFor: undefined,
                }))
              }
              style={[
                styles.optionCard,
                draft.timing === 'immediate' && styles.optionCardSelected,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: draft.timing === 'immediate' }}
              aria-checked={draft.timing === 'immediate'}
            >
              <View style={styles.optionHeader}>
                <Clock
                  size={IconSize.action}
                  color={draft.timing === 'immediate' ? Colors.primary : Colors.textTertiary}
                />
                {draft.timing === 'immediate' && (
                  <Check size={18} color={Colors.primary} />
                )}
              </View>
              <Text style={[Typography.h4, styles.optionTitle]}>
                Lo antes posible
              </Text>
              <Text style={[Typography.bodySmall, styles.optionDescription]}>
                Los psicólogos disponibles te responderán en los próximos minutos.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setDraft((prev) => ({
                  ...prev,
                  timing: 'scheduled',
                  scheduledFor: undefined,
                }));
              }}
              style={[
                styles.optionCard,
                draft.timing === 'scheduled' && styles.optionCardSelected,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: draft.timing === 'scheduled' }}
              aria-checked={draft.timing === 'scheduled'}
            >
              <View style={styles.optionHeader}>
                <Calendar
                  size={IconSize.action}
                  color={draft.timing === 'scheduled' ? Colors.primary : Colors.textTertiary}
                />
                {draft.timing === 'scheduled' && (
                  <Check size={18} color={Colors.primary} />
                )}
              </View>
              <Text style={[Typography.h4, styles.optionTitle]}>
                Programar para después
              </Text>
              <Text style={[Typography.bodySmall, styles.optionDescription]}>
                Elige una fecha y hora concretas dentro del periodo disponible.
              </Text>
            </TouchableOpacity>
          </View>

          {draft.timing === 'scheduled' && policy && (
            <View style={styles.scheduleFields}>
              <ScheduleDateTimeInput
                value={draft.scheduledFor}
                leadMinutes={policy.scheduledLeadMinutes}
                maximumScheduleDays={policy.maximumScheduleDays}
                onChange={handleScheduledDateChange}
              />
            </View>
          )}

          {draft.timing === 'scheduled' && !policy && (
            <View style={styles.policyInlineState}>
              <Text style={styles.policyStateText}>
                Necesitamos consultar el rango de programación antes de elegir una fecha.
              </Text>
            </View>
          )}
        </View>
      )}

      {step === 4 && (
        <View style={styles.stepContainer}>
          <Text style={[Typography.h3, styles.stepHeader]}>
            ¿Cuál es tu presupuesto sugerido?
          </Text>
          <Text style={[Typography.body, styles.stepSubheader]}>
            Los psicólogos enviarán sus propuestas con base en este monto.
          </Text>

          {isPolicyLoading ? (
            <View style={styles.policyState} accessibilityRole="progressbar">
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.policyStateText}>Cargando opciones de presupuesto…</Text>
            </View>
          ) : policyError || !policy || !budgetLimits || !currencyCode ? (
            <View style={styles.policyState} accessibilityRole="alert">
              <AlertCircle size={IconSize.action} color={Colors.error} />
              <Text style={styles.policyStateText}>
                {policyError ?? 'La configuración de presupuesto no está disponible.'}
              </Text>
              <AppButton
                label="Reintentar"
                onPress={() => void loadPolicy()}
                variant="outline"
                size="md"
              />
            </View>
          ) : (
            <BudgetInput
              value={Number(draft.proposedBudgetInput) || 0}
              onChange={(val) =>
                setDraft((prev) => ({
                  ...prev,
                  proposedBudgetInput: String(val),
                }))
              }
              currencyCode={currencyCode}
              minimumAmount={budgetLimits.minimumAmount}
              maximumAmount={budgetLimits.maximumAmount}
            />
          )}
        </View>
      )}

      {step === 5 && (
        <RequestSummary
          draft={draft}
          onEditStep={(targetStep) => setStep(targetStep)}
        />
      )}
    </WizardScaffold>
  );
};

const styles = StyleSheet.create({
  stepContainer: {
    paddingVertical: Spacing.sm,
  },
  stepHeader: {
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  stepSubheader: {
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionalAction: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  optionalActionText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontFamily: Typography.button.fontFamily,
  },
  infoBox: {
    backgroundColor: Colors.primaryTint,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  infoBoxText: {
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  optionCardsContainer: {
    gap: Spacing.md,
  },
  scheduleFields: {
    marginTop: Spacing.lg,
  },
  optionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryTint,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  optionTitle: {
    color: Colors.textPrimary,
    marginBottom: Spacing.xxs,
  },
  optionDescription: {
    color: Colors.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.errorSurface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  errorText: {
    color: Colors.error,
    flex: 1,
  },
  policyState: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  policyInlineState: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.md,
  },
  policyStateText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
