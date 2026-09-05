import { AppError } from '../../../../shared/domain/appError';
import type {
  PasswordResetDelivery,
  PasswordResetDeliveryInput,
} from '../../application/ports';

interface ResendPasswordResetDeliveryConfig {
  readonly apiKey: string;
  readonly sender: string;
  readonly resetUrl: string;
  readonly timeoutMs: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export class ResendPasswordResetDelivery implements PasswordResetDelivery {
  constructor(private readonly config: ResendPasswordResetDeliveryConfig) {}

  async send(input: PasswordResetDeliveryInput): Promise<void> {
    const resetUrl = new URL(this.config.resetUrl);
    resetUrl.searchParams.set('token', input.token);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.sender,
          to: [input.recipientEmail],
          subject: 'Recupera tu acceso a Ruta Emocional',
          text: [
            `Hola ${input.displayName},`,
            '',
            'Recibimos una solicitud para cambiar la contraseña de tu cuenta.',
            `Continúa desde este enlace: ${resetUrl.toString()}`,
            '',
            `El enlace vence el ${input.expiresAt.toISOString()}.`,
            'Si no realizaste esta solicitud, puedes ignorar este mensaje.',
          ].join('\n'),
          html: `<p>Hola ${escapeHtml(input.displayName)},</p>`
            + '<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta.</p>'
            + `<p><a href="${escapeHtml(resetUrl.toString())}">Crear una nueva contraseña</a></p>`
            + '<p>Este enlace es de un solo uso y vence pronto. Si no realizaste esta solicitud, puedes ignorar este mensaje.</p>',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(
          502,
          'PASSWORD_RESET_DELIVERY_FAILED',
          'No pudimos enviar las instrucciones',
          'El proveedor de correo rechazó temporalmente la solicitud.'
        );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        502,
        'PASSWORD_RESET_DELIVERY_FAILED',
        'No pudimos enviar las instrucciones',
        'El proveedor de correo no está disponible temporalmente.'
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
