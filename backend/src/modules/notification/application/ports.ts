import type { RegisterPushDeviceInput, PushDeviceView } from '../domain/notificationTypes';

export interface PushDeviceRepository {
  register(userId: string, input: RegisterPushDeviceInput): Promise<PushDeviceView>;
  deactivate(userId: string, installationId: string): Promise<void>;
}
