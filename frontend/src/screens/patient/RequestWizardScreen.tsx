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
import { generateBudgetSuggestions } from '../../utils/generateBudgetSuggestions';
import { formatMoney } from '../../utils/money';
import type { PatientSearchNavigation } from '../../navigation/navigationTypes';
import { presentUserError } from '../../utils/userFacingError';

const POPULAR_NEEDS = [
  'Ansiedad y estrés',
  'Depresión y tristeza',
  'Autoestima',
  'Duelo o pérdida',
  'Terapia de pareja',
  'Crecimiento personal',
];

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
  const [isCustomNeed, setIsCustomNeed] = useState(false);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);

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
        proposedBudgetInput: previous.proposedBudgetInput || nextPolicy.minimumAmount,
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
      navigation.navigate('Radar');
    } catch (error) {
      setSubmissionError(
        presentUserError(error, 'No pudimos publicar la solicitud. Inténtalo nuevamente.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const budgetSuggestions = policy
    ? generateBudgetSuggestions({
        minimumAmount: Number(policy.minimumAmount),
        maximumAmount: Number(policy.maximumAmount),
      })
    : [];

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
      {/* Mensaje de error de envío si ocurrió */}
      {submissionError && (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <AlertCircle size={IconSize.inline} color={Colors.error} />
          <Text style={[Typography.bodySmall, styles.errorText]}>
            {submissionError}
          </Text>
        </View>
      )}

      {/* Paso 1: Necesidad principal */}
      {step === 1 && (
        <View style={styles.stepContainer}>
          <Text style={[Typography.h3, styles.stepHeader]}>
            ¿Cómo podemos ayudarte?
          </Text>
          <Text style={[Typography.body, styles.stepSubheader]}>
            Elige el motivo que mejor describe lo que necesitas.
          </Text>

          {/* Sugerencias populares */}
          <View style={styles.chipRow}>
            {POPULAR_NEEDS.map((need) => {
              const isSelected = draft.primaryNeed === need;
              return (
                <TouchableOpacity
                  key={need}
                  onPress={() => {
                    setIsCustomNeed(false);
                    setDraft((prev) => ({ ...prev, primaryNeed: need }));
                  }}
                  style={[styles.suggestedChip, isSelected && styles.suggestedChipSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  aria-checked={isSelected}
                >
                  <Text
                    style={[
                      Typography.bodySmall,
                      styles.suggestedChipText,
                      isSelected && styles.suggestedChipTextSelected,
                    ]}
                  >
                    {need}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => {
                setIsCustomNeed(true);
                if (POPULAR_NEEDS.includes(draft.primaryNeed ?? '')) {
                  setDraft((prev) => ({ ...prev, primaryNeed: '' }));
                }
              }}
              style={[styles.suggestedChip, isCustomNeed && styles.suggestedChipSelected]}
              accessibilityRole="radio"
              accessibilityState={{ checked: isCustomNeed }}
              aria-checked={isCustomNeed}
            >
              <Text style={[
                Typography.bodySmall,
                styles.suggestedChipText,
                isCustomNeed && styles.suggestedChipTextSelected,
              ]}>
                Otro motivo
              </Text>
            </TouchableOpacity>
          </View>

          {isCustomNeed ? (
            <TextInput
              style={styles.textInput}
              value={draft.primaryNeed}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, primaryNeed: text }))}
              placeholder="Cuéntanos brevemente qué necesitas"
              placeholderTextColor={Colors.textDisabled}
              maxLength={policy?.maximumPrimaryNeedLength}
              autoFocus
              accessibilityLabel="Motivo de consulta"
            />
          ) : null}

          <TouchableOpacity
            style={styles.optionalAction}
            onPress={() => setShowAdditionalDetails((current) => !current)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showAdditionalDetails }}
          >
            {showAdditionalDetails ? (
              <Minus size={IconSize.inline} color={Colors.primary} />
            ) : (
              <Plus size={IconSize.inline} color={Colors.primary} />
            )}
            <Text style={styles.optionalActionText}>Añadir contexto</Text>
          </TouchableOpacity>

          {showAdditionalDetails ? (
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={draft.description}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, description: text }))}
              placeholder="Información que ayude al profesional (opcional)"
              placeholderTextColor={Colors.textDisabled}
              multiline
              numberOfLines={3}
              maxLength={policy?.maximumDescriptionLength}
              accessibilityLabel="Contexto adicional opcional"
            />
          ) : null}
        </View>
      )}

      {/* Paso 2: Modalidad */}
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

      {/* Paso 3: Horario */}
      {step === 3 && (
        <View style={styles.stepContainer}>
          <Text style={[Typography.h3, styles.stepHeader]}>
            ¿Cuándo necesitas la atención?
          </Text>
          <Text style={[Typography.body, styles.stepSubheader]}>
            Indica si buscas atención para hoy o prefieres programarla.
          </Text>

          <View style={styles.optionCardsContainer}>
            {/* Opción Inmediata */}
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

            {/* Opción Programada */}
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

      {/* Paso 4: Presupuesto */}
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
            <>
              <Text style={[Typography.label, styles.inputLabel]}>MONTOS SUGERIDOS</Text>
              <View style={styles.chipRow}>
                {budgetSuggestions.map((amount) => {
                  const isSelected = draft.proposedBudgetInput === String(amount);
                  return (
                    <TouchableOpacity
                      key={amount}
                      onPress={() =>
                        setDraft((prev) => ({
                          ...prev,
                          proposedBudgetInput: String(amount),
                        }))
                      }
                      style={[styles.budgetChip, isSelected && styles.budgetChipSelected]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      aria-checked={isSelected}
                      accessibilityLabel={`Presupuesto sugerido ${formatMoney(amount, currencyCode)}`}
                    >
                      <Text
                        style={[
                          Typography.body,
                          styles.budgetChipText,
                          isSelected && styles.budgetChipTextSelected,
                        ]}
                      >
                        {formatMoney(amount, currencyCode)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

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
            </>
          )}
        </View>
      )}

      {/* Paso 5: Revisión y confirmación */}
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
  inputLabel: {
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  suggestedChip: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  suggestedChipSelected: {
    backgroundColor: Colors.primaryTint,
    borderColor: Colors.primary,
  },
  suggestedChipText: {
    color: Colors.textSecondary,
  },
  suggestedChipTextSelected: {
    color: Colors.primary,
    fontFamily: Typography.button.fontFamily,
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
  budgetChip: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  budgetChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  budgetChipText: {
    color: Colors.textPrimary,
  },
  budgetChipTextSelected: {
    color: Colors.textInverse,
    fontFamily: Typography.button.fontFamily,
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
