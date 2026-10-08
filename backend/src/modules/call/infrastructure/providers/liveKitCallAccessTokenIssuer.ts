import { AccessToken } from 'livekit-server-sdk';
import { TrackSource } from '@livekit/protocol';
import type { CallAccessTokenIssuer } from '../../application/ports';

export class LiveKitCallAccessTokenIssuer implements CallAccessTokenIssuer {
  constructor(
    private readonly serverUrl: string,
    private readonly apiKey: string,
    private readonly apiSecret: string
  ) {}

  async issue(input: Parameters<CallAccessTokenIssuer['issue']>[0]) {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: input.identity,
      name: input.displayName,
      ttl: input.ttlSeconds,
    });
    token.addGrant({
      roomJoin: true,
      room: input.roomName,
      canPublish: true,
      canPublishSources: input.mediaType === 'AUDIO'
        ? [TrackSource.MICROPHONE]
        : [TrackSource.MICROPHONE, TrackSource.CAMERA],
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: false,
    });
    return { serverUrl: this.serverUrl, accessToken: await token.toJwt() };
  }
}
