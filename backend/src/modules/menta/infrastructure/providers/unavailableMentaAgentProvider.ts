import type { MentaAgentProvider, MentaAgentProviderRequest } from '../../application/ports';
import type { MentaAgentReply } from '../../domain/mentaTypes';

export class UnavailableMentaAgentProvider implements MentaAgentProvider {
  generateReply(_request: MentaAgentProviderRequest): Promise<MentaAgentReply> {
    return Promise.reject(new Error('MENTA agent provider is disabled'));
  }
}
