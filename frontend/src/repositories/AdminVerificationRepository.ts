import { apiV1Request } from '../services/apiClient';

export interface VerificationQueueItem {
  readonly submissionId: string;
  readonly psychologistProfileId: string;
  readonly psychologistName: string;
  readonly license: {
    readonly id: string;
    readonly authority: string;
    readonly number: string;
  };
  readonly evidenceObjectKey: string;
  readonly submittedAt: string;
}

interface VerificationQueueResponse {
  readonly data: readonly VerificationQueueItem[];
  readonly meta: {
    readonly nextCursor: string | null;
  };
}

export async function getPendingVerifications(
  signal?: AbortSignal
): Promise<VerificationQueueResponse> {
  return apiV1Request<VerificationQueueResponse>(
    '/admin/psychologist-verifications?limit=50',
    'GET',
    undefined,
    { signal }
  );
}

export async function decideVerification(input: {
  readonly submissionId: string;
  readonly decision: 'APPROVED' | 'REJECTED';
  readonly publicReason?: string;
}): Promise<void> {
  await apiV1Request<void>(
    `/admin/psychologist-verifications/${input.submissionId}/decision`,
    'POST',
    {
      decision: input.decision,
      ...(input.publicReason ? { publicReason: input.publicReason } : {}),
    }
  );
}
