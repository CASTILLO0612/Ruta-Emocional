import { AppError, FieldError } from '../../../shared/domain/appError';
import {
  DeterministicTriageResult,
  TriageAnswer,
  TriageDefinition,
  TriageModality,
  TriageRiskLevelValue,
} from './triageTypes';

const RISK_WEIGHT: Readonly<Record<TriageRiskLevelValue, number>> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  CRITICAL: 3,
};

function highestRisk(levels: readonly TriageRiskLevelValue[]): TriageRiskLevelValue {
  return levels.reduce<TriageRiskLevelValue>(
    (highest, level) => RISK_WEIGHT[level] > RISK_WEIGHT[highest] ? level : highest,
    'LOW'
  );
}

function orderedModalities(
  configured: readonly { readonly modality: TriageModality; readonly priority: number }[],
  preferred: TriageModality | null
): readonly TriageModality[] {
  const modalities = configured
    .slice()
    .sort((left, right) => left.priority - right.priority)
    .map(({ modality }) => modality);
  if (!preferred || !modalities.includes(preferred)) return modalities;
  return [preferred, ...modalities.filter((modality) => modality !== preferred)];
}

export class DeterministicTriageEngine {
  evaluate(
    definition: TriageDefinition,
    answers: readonly TriageAnswer[]
  ): DeterministicTriageResult {
    const errors: FieldError[] = [];
    const questions = new Map(definition.questions.map((question) => [question.code, question]));
    const selectedByQuestion = new Map<string, string>();

    answers.forEach((answer, index) => {
      const field = `answers[${index}]`;
      const question = questions.get(answer.questionCode);
      if (!question) {
        errors.push({ field: `${field}.questionCode`, code: 'UNKNOWN_QUESTION', message: 'La pregunta no pertenece al formulario vigente.' });
        return;
      }
      if (selectedByQuestion.has(question.code)) {
        errors.push({ field: `${field}.questionCode`, code: 'DUPLICATE_QUESTION', message: 'Cada pregunta admite una sola respuesta.' });
        return;
      }
      if (!question.options.some((option) => option.code === answer.optionCode)) {
        errors.push({ field: `${field}.optionCode`, code: 'INVALID_OPTION', message: 'La opción no pertenece a la pregunta indicada.' });
        return;
      }
      selectedByQuestion.set(question.code, answer.optionCode);
    });

    for (const question of definition.questions) {
      if (question.isRequired && !selectedByQuestion.has(question.code)) {
        errors.push({ field: 'answers', code: 'REQUIRED_ANSWER_MISSING', message: `Falta responder: ${question.prompt}` });
      }
    }
    if (errors.length) throw AppError.validation(errors);

    const selectedOptions = definition.questions.flatMap((question) => {
      const selectedCode = selectedByQuestion.get(question.code);
      const selected = question.options.find((option) => option.code === selectedCode);
      return selected ? [selected] : [];
    });
    const needCodes = [...new Set(selectedOptions.flatMap((option) => option.needCode ? [option.needCode] : []))];
    if (needCodes.length !== 1) {
      throw AppError.validation([{
        field: 'answers',
        code: 'PRIMARY_NEED_REQUIRED',
        message: 'Selecciona exactamente una necesidad principal.',
      }]);
    }
    const primaryNeed = definition.needs.find((need) => need.code === needCodes[0]);
    if (!primaryNeed) {
      throw AppError.conflict('TRIAGE_DEFINITION_INVALID', 'La definición de orientación no está completa.');
    }

    const selectedOptionCodes = selectedOptions.map(({ code }) => code);
    const selectedSet = new Set(selectedOptionCodes);
    const ruleResults = definition.rules.map((rule) => {
      const matched = selectedSet.has(rule.triggerOptionCode);
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        ruleVersion: rule.version,
        matched,
        evidenceOptionCode: matched ? rule.triggerOptionCode : null,
      };
    });
    if (!ruleResults.length) {
      throw AppError.conflict('TRIAGE_DEFINITION_INVALID', 'No hay reglas de seguridad vigentes.');
    }
    const riskLevel = highestRisk(definition.rules.flatMap((rule) => (
      selectedSet.has(rule.triggerOptionCode) ? [rule.riskLevel] : []
    )));
    const preferredModality = selectedOptions.find((option) => option.modality)?.modality ?? null;
    const recommendedModalities = riskLevel === 'HIGH' || riskLevel === 'CRITICAL'
      ? []
      : orderedModalities(primaryNeed.modalities, preferredModality);
    if ((riskLevel === 'LOW' || riskLevel === 'MODERATE') && !recommendedModalities.length) {
      throw AppError.conflict('TRIAGE_DEFINITION_INVALID', 'La necesidad no tiene modalidades configuradas.');
    }

    return {
      primaryNeed,
      riskLevel,
      recommendedModalities,
      fallbackSummary: primaryNeed.fallbackSummary,
      selectedOptionCodes,
      ruleResults,
    };
  }
}

