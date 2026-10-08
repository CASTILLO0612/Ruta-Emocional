import { Prisma, PrismaClient } from '../../../../generated/prisma/client';

interface NotificationTemplate {
  readonly userIds: readonly string[];
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly data: Prisma.InputJsonObject;
}

function objectPayload(payload: Prisma.JsonValue): Prisma.JsonObject | null {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Prisma.JsonObject
    : null;
}

function stringArray(value: Prisma.JsonValue | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export class NotificationFanout {
  constructor(private readonly prisma: PrismaClient) {}

  async enqueue(outboxEventId: string, eventType: string, payload: Prisma.JsonValue): Promise<void> {
    const template = await this.template(eventType, payload);
    if (!template || template.userIds.length === 0) return;
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId: { in: [...new Set(template.userIds)] }, active: true },
      select: { id: true },
    });
    if (devices.length === 0) return;
    await this.prisma.pushDelivery.createMany({
      data: devices.map((device) => ({
        outboxEventId,
        pushDeviceId: device.id,
        notificationType: template.type,
        title: template.title,
        body: template.body,
        data: template.data,
      })),
      skipDuplicates: true,
    });
  }

  private async template(
    eventType: string,
    payload: Prisma.JsonValue
  ): Promise<NotificationTemplate | null> {
    const record = objectPayload(payload);
    if (!record) return null;
    if (eventType === 'message.created') {
      const messageId = typeof record.messageId === 'string' ? record.messageId : null;
      const conversationId = typeof record.conversationId === 'string' ? record.conversationId : null;
      if (!messageId || !conversationId) return null;
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: { participant: { select: { userId: true } } },
      });
      if (!message) return null;
      const recipients = await this.prisma.conversationParticipant.findMany({
        where: {
          conversationId,
          leftAt: null,
          userId: { not: message.participant.userId },
        },
        select: { userId: true },
      });
      return {
        userIds: recipients.map(({ userId }) => userId),
        type: 'MESSAGE_CREATED',
        title: 'Nuevo mensaje',
        body: 'Tienes un mensaje nuevo en Ruta Emocional.',
        data: { kind: 'MESSAGE', conversationId },
      };
    }
    if (eventType === 'call.started') {
      const callId = typeof record.callId === 'string' ? record.callId : null;
      const conversationId = typeof record.conversationId === 'string' ? record.conversationId : null;
      const recipientUserId = typeof record.recipientUserId === 'string' ? record.recipientUserId : null;
      const mediaType = record.mediaType === 'VIDEO' ? 'VIDEO' : record.mediaType === 'AUDIO' ? 'AUDIO' : null;
      if (!callId || !conversationId || !recipientUserId || !mediaType) return null;
      return {
        userIds: [recipientUserId],
        type: 'CALL_INCOMING',
        title: mediaType === 'VIDEO' ? 'Videollamada entrante' : 'Llamada entrante',
        body: 'Tienes una llamada de tu contacto en Ruta Emocional.',
        data: { kind: 'CALL', callId, conversationId, mediaType },
      };
    }
    if (eventType.startsWith('psychologist.verification_')) {
      const userId = typeof record.userId === 'string' ? record.userId : null;
      const status = record.status === 'VERIFIED' ? 'VERIFIED' : 'REJECTED';
      if (!userId) return null;
      return {
        userIds: [userId],
        type: 'VERIFICATION_UPDATED',
        title: 'Verificación actualizada',
        body: status === 'VERIFIED'
          ? 'Tu perfil profesional fue verificado.'
          : 'Hay novedades en la verificación de tu perfil.',
        data: { kind: 'VERIFICATION' },
      };
    }
    if (eventType.startsWith('appointment.')) {
      const appointmentId = typeof record.appointmentId === 'string' ? record.appointmentId : null;
      const userIds = stringArray(record.userIds);
      if (!appointmentId || userIds.length === 0) return null;
      const reminder = eventType === 'appointment.reminder_due';
      return {
        userIds,
        type: reminder ? 'APPOINTMENT_REMINDER' : 'APPOINTMENT_UPDATED',
        title: reminder ? 'Recordatorio de cita' : 'Cita actualizada',
        body: reminder
          ? 'Tienes una cita próxima en Ruta Emocional.'
          : 'Consulta los cambios de tu cita en la agenda.',
        data: { kind: 'APPOINTMENT', appointmentId },
      };
    }
    return null;
  }
}
