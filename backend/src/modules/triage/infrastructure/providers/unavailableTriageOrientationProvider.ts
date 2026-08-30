import {
  TriageOrientationProvider,
  TriageProviderUnavailableError,
} from '../../application/ports';

export class UnavailableTriageOrientationProvider implements TriageOrientationProvider {
  readonly providerName = 'UNCONFIGURED';
  readonly modelName = 'UNCONFIGURED';

  async evaluate(): Promise<never> {
    throw new TriageProviderUnavailableError();
  }
}

