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
    const recoveryUrl = resetUrl.toString();
    const safeDisplayName = escapeHtml(input.displayName);
    const safeRecoveryUrl = escapeHtml(recoveryUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
          'idempotency-key': `password-reset/${input.deliveryId}`,
        },
        body: JSON.stringify({
          from: this.config.sender,
          to: [input.recipientEmail],
          subject: 'Recupera tu acceso a Ruta Emocional',
          text: [
            `Hola ${input.displayName},`,
            '',
            'Recibimos una solicitud para cambiar la contraseña de tu cuenta.',
            'Abre este enlace seguro para continuar:',
            recoveryUrl,
            '',
            `El enlace vence el ${input.expiresAt.toISOString()}.`,
            'Si no realizaste esta solicitud, puedes ignorar este mensaje.',
          ].join('\n'),
          html: '<div style="background:#f7f8fc;padding:32px 16px;font-family:Arial,sans-serif;color:#17213a">'
            + '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e8f0;border-radius:16px;padding:32px">'
            + '<p style="margin:0 0 28px;color:#29428c;font-size:16px;font-weight:700;letter-spacing:.06em">RUTA EMOCIONAL</p>'
            + `<p style="margin:0 0 16px;font-size:16px;line-height:1.6">Hola ${safeDisplayName},</p>`
            + '<p style="margin:0 0 24px;color:#526078;font-size:16px;line-height:1.6">Recibimos una solicitud para cambiar la contraseña de tu cuenta.</p>'
            + `<p style="margin:0 0 24px"><a href="${safeRecoveryUrl}" style="display:inline-block;background:#29428c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 22px;border-radius:12px">Crear una nueva contraseña</a></p>`
            + '<p style="margin:0 0 8px;color:#526078;font-size:13px;line-height:1.5">Si el botón no funciona, abre este enlace:</p>'
            + `<p style="margin:0 0 24px;font-size:13px;line-height:1.5;overflow-wrap:anywhere"><a href="${safeRecoveryUrl}" style="color:#29428c">${safeRecoveryUrl}</a></p>`
            + '<p style="margin:0;color:#526078;font-size:13px;line-height:1.5">Este enlace es de un solo uso y vence pronto. Si no realizaste esta solicitud, puedes ignorar este mensaje.</p>'
            + '</div></div>',
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
