export type MentaScope = 'PATIENT' | 'PSYCHOLOGIST';
export type MentaProviderOutcome = 'NOT_USED' | 'SUCCEEDED' | 'UNAVAILABLE' | 'REJECTED_OUTPUT';
export type MentaToolOutcome = 'SUCCEEDED' | 'DENIED' | 'FAILED';

export type MentaToolCode =
  | 'get_my_agenda'
  | 'get_my_requests'
  | 'find_psychologists'
  | 'list_my_patients'
  | 'get_patient_context';

export interface MentaToolDeclaration {
  readonly type: 'function';
  readonly name: MentaToolCode;
  readonly description: string;
  readonly parameters: {
    readonly type: 'object';
    readonly properties: Readonly<Record<string, unknown>>;
    readonly required?: readonly string[];
  };
}

export interface MentaToolExecution {
  readonly data: unknown;
  readonly resourceType: string;
  readonly resourceCount: number;
}

export interface MentaTurnView {
  readonly id: string;
  readonly clientMessageId: string;
  readonly userMessage: string;
  readonly assistantMessage: string;
  readonly providerOutcome: MentaProviderOutcome;
  readonly modelName: string | null;
  readonly toolsUsed: readonly MentaToolCode[];
  readonly createdAt: string;
  readonly completedAt: string;
}

export interface MentaConversationView {
  readonly id: string;
  readonly scope: MentaScope;
  readonly consentVersion: string;
  readonly consentedAt: string;
  readonly turns: readonly MentaTurnView[];
}

export interface MentaBootstrapView {
  readonly enabled: boolean;
  readonly scope: MentaScope;
  readonly consentVersion: string;
  readonly disclosure: string;
  readonly suggestedPrompts: readonly string[];
  readonly conversation: MentaConversationView | null;
}

export interface MentaProviderTurn {
  readonly userMessage: string;
  readonly assistantMessage: string;
}

export interface MentaAgentReply {
  readonly text: string;
  readonly outcome: MentaProviderOutcome;
  readonly modelName: string | null;
  readonly toolsUsed: readonly MentaToolCode[];
}

export interface MentaCrisisResponse {
  readonly detected: true;
  readonly message: string;
}

const CRISIS_PATTERNS = [
  /\bsuicid(?:io|a|arme|arse)?\b/i,
  /\bquitarme la vida\b/i,
  /\bno quiero vivir\b/i,
  /\bhacerme da(?:ñ|n)o\b/i,
  /\bmatarme\b/i,
  /\bend my life\b/i,
  /\bharm myself\b/i,
] as const;

export function detectsImmediateSafetySignal(message: string): boolean {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(message));
}

export function validateAssistantReply(value: string, maximumLength: number): string | null {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) return null;

  const unsafeClaims = [
    /\bte diagnostico\b/i,
    /\btu diagn[oó]stico es\b/i,
    /\bdebes (?:tomar|suspender) (?:el |la )?medicamento\b/i,
    /\bgarantizo (?:que )?te (?:curar[aá]s|recuperar[aá]s)\b/i,
  ];
  return unsafeClaims.some((pattern) => pattern.test(normalized)) ? null : normalized;
}
