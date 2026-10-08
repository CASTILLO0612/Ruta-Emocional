import { AppError } from '../../../../shared/domain/appError';

export interface ExpoPushMessage {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface ExpoPushTicket {
  readonly status: 'ok' | 'error';
  readonly id?: string;
  readonly errorCode?: string;
}

export interface ExpoPushReceipt {
  readonly status: 'ok' | 'error';
  readonly errorCode?: string;
}

interface ExpoPushProviderConfig {
  readonly accessToken: string | null;
  readonly timeoutMs: number;
}

interface ExpoProviderEnvelope {
  readonly data?: unknown;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function providerError(): AppError {
  return new AppError(
    502,
    'PUSH_PROVIDER_UNAVAILABLE',
    'Servicio de notificaciones no disponible',
    'La notificación se reintentará automáticamente.'
  );
}

export class ExpoPushProvider {
  constructor(private readonly config: ExpoPushProviderConfig) {}

  async send(message: ExpoPushMessage): Promise<ExpoPushTicket> {
    const payload = await this.request('https://exp.host/--/api/v2/push/send', {
      to: message.to,
      sound: 'default',
      priority: 'high',
      title: message.title,
      body: message.body,
      data: message.data,
    });
    const ticket = objectValue(Array.isArray(payload.data) ? payload.data[0] : payload.data);
    if (!ticket || (ticket.status !== 'ok' && ticket.status !== 'error')) throw providerError();
    const details = objectValue(ticket.details);
    return {
      status: ticket.status,
      id: typeof ticket.id === 'string' ? ticket.id : undefined,
      errorCode: typeof details?.error === 'string' ? details.error : undefined,
    };
  }

  async receipts(ids: readonly string[]): Promise<Readonly<Record<string, ExpoPushReceipt>>> {
    if (ids.length === 0) return {};
    const payload = await this.request('https://exp.host/--/api/v2/push/getReceipts', { ids });
    const receiptMap = objectValue(payload.data);
    if (!receiptMap) throw providerError();
    return Object.fromEntries(Object.entries(receiptMap).map(([id, value]) => {
      const receipt = objectValue(value);
      if (!receipt || (receipt.status !== 'ok' && receipt.status !== 'error')) {
        throw providerError();
      }
      const details = objectValue(receipt.details);
      return [id, {
        status: receipt.status === 'ok' ? 'ok' : 'error',
        errorCode: typeof details?.error === 'string' ? details.error : undefined,
      }];
    }));
  }

  private async request(url: string, body: unknown): Promise<ExpoProviderEnvelope> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(this.config.accessToken
            ? { authorization: `Bearer ${this.config.accessToken}` }
            : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw providerError();
      const payload = objectValue(await response.json());
      if (!payload) throw providerError();
      return { data: payload.data };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw providerError();
    } finally {
      clearTimeout(timeout);
    }
  }
}
