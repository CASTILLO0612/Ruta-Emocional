export type PushPlatformCode = 'ANDROID' | 'IOS';

export interface RegisterPushDeviceInput {
  readonly installationId: string;
  readonly expoPushToken: string;
  readonly platform: PushPlatformCode;
}

export interface PushDeviceView {
  readonly installationId: string;
  readonly platform: PushPlatformCode;
  readonly active: boolean;
  readonly lastSeenAt: string;
}
