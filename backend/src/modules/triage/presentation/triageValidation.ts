import { AppError, FieldError } from '../../../shared/domain/appError';
import { CreateTriageAssessmentCommand } from '../application/ports';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,79}$/;

function recordValue(value: unknown, field: string, errors: FieldError[]): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  errors.push({ field, code: 'INVALID_OBJECT', message: 'Este valor debe ser un objeto.' });
  return {};
}

function rejectUnknown(
  record: Record<string, unknown>,
  allowed: readonly string[],
  prefix: string,
  errors: FieldError[]
): void {
  for (const field of Object.keys(record)) {
    if (!allowed.includes(field)) {
      errors.push({
        field: prefix ? `${prefix}.${field}` : field,
        code: 'UNKNOWN_FIELD',
        message: 'Este campo no está permitido.',
      });
    }
  }
}

function parseCode(value: unknown, field: string, errors: FieldError[]): string {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!CODE_PATTERN.test(code)) {
    errors.push({ field, code: 'INVALID_CODE', message: 'El código no es válido.' });
  }
  return code;
}

export function parseCreateTriageAssessment(body: unknown): CreateTriageAssessmentCommand {
  const errors: FieldError[] = [];
  const record = recordValue(body, 'body', errors);
  rejectUnknown(record, ['countryCode', 'serviceRequestId', 'answers', 'consent'], '', errors);

  const countryCode = typeof record.countryCode === 'string'
    ? record.countryCode.trim().toUpperCase()
    : '';
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    errors.push({
      field: 'countryCode',
      code: 'INVALID_COUNTRY_CODE',
      message: 'Usa un código de país ISO de dos letras.',
    });
  }

  let serviceRequestId: string | undefined;
  if (record.serviceRequestId !== undefined) {
    if (typeof record.serviceRequestId !== 'string' || !UUID_PATTERN.test(record.serviceRequestId)) {
      errors.push({
        field: 'serviceRequestId',
        code: 'INVALID_UUID',
        message: 'La solicitud de atención no es válida.',
      });
    } else {
      serviceRequestId = record.serviceRequestId.toLowerCase();
    }
  }

  const answers: { questionCode: string; optionCode: string }[] = [];
  if (!Array.isArray(record.answers) || record.answers.length < 1 || record.answers.length > 30) {
    errors.push({
      field: 'answers',
      code: 'INVALID_ANSWERS',
      message: 'Envía entre 1 y 30 respuestas estructuradas.',
    });
  } else {
    record.answers.forEach((value, index) => {
      const field = `answers[${index}]`;
      const answer = recordValue(value, field, errors);
      rejectUnknown(answer, ['questionCode', 'optionCode'], field, errors);
      answers.push({
        questionCode: parseCode(answer.questionCode, `${field}.questionCode`, errors),
        optionCode: parseCode(answer.optionCode, `${field}.optionCode`, errors),
      });
    });
  }

  const consent = recordValue(record.consent, 'consent', errors);
  rejectUnknown(consent, ['documentCode', 'documentVersion', 'granted'], 'consent', errors);
  const documentCode = parseCode(consent.documentCode, 'consent.documentCode', errors);
  const documentVersion = typeof consent.documentVersion === 'string'
    ? consent.documentVersion.trim()
    : '';
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,29}$/.test(documentVersion)) {
    errors.push({
      field: 'consent.documentVersion',
      code: 'INVALID_VERSION',
      message: 'La versión del consentimiento no es válida.',
    });
  }
  if (consent.granted !== true) {
    errors.push({
      field: 'consent.granted',
      code: 'CONSENT_REQUIRED',
      message: 'Debes otorgar el consentimiento para iniciar la orientación.',
    });
  }

  if (errors.length) throw AppError.validation(errors);
  return {
    countryCode,
    ...(serviceRequestId ? { serviceRequestId } : {}),
    answers,
    consent: { documentCode, documentVersion, granted: true },
  };
}

export function parseTriageUuid(value: string | undefined, field: string): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw AppError.validation([{
      field,
      code: 'INVALID_UUID',
      message: 'El identificador no es válido.',
    }]);
  }
  return value.toLowerCase();
}

export function parseTriageIdempotencyKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key || !UUID_PATTERN.test(key)) {
    throw AppError.badRequest(
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key debe contener un UUID válido.'
    );
  }
  return key.toLowerCase();
}

export function assertEmptyTriageBody(body: unknown): void {
  if (
    body !== undefined
    && body !== null
    && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body as object).length > 0)
  ) {
    throw AppError.validation([{
      field: 'body',
      code: 'BODY_NOT_ALLOWED',
      message: 'Esta operación no acepta campos.',
    }]);
  }
}

