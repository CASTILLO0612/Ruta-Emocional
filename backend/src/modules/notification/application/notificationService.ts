import type { AuthenticatedActor } from '../../identity/application/identityService';
import type { RegisterPushDeviceInput } from '../domain/notificationTypes';
import type { PushDeviceRepository } from './ports';

export class NotificationService {
  constructor(private readonly devices: PushDeviceRepository) {}

  registerDevice(actor: AuthenticatedActor, input: RegisterPushDeviceInput) {
    return this.devices.register(actor.user.id, input);
  }

  deactivateDevice(actor: AuthenticatedActor, installationId: string) {
    return this.devices.deactivate(actor.user.id, installationId);
  }
}
