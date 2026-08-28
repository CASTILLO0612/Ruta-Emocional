import { Router } from 'express';
import { AppConfig } from '../../../config/env';
import { asyncHandler } from '../../../shared/presentation/http/asyncHandler';
import { createRateLimiter } from '../../../shared/presentation/http/rateLimiter';
import { getRequestId } from '../../../shared/presentation/http/requestContext';
import { IdentityService } from '../../identity/application/identityService';
import {
  AuthenticatedRequest,
  getActor,
  requireAuthentication,
  requireCapability,
} from '../../identity/presentation/authMiddleware';
import { ServiceRequestService } from '../application/serviceRequestService';
import {
  assertEmptyBody,
  parseCreateServiceRequest,
  parseEligiblePageQuery,
  parseIdempotencyKey,
  parseOfferBody,
  parsePageQuery,
  parseUuid,
} from './serviceRequestValidation';

function envelope<T>(data: T, response: Parameters<typeof getRequestId>[0]) {
  return { data, meta: { requestId: getRequestId(response) } };
}

function auditContext(request: AuthenticatedRequest, response: Parameters<typeof getRequestId>[0]) {
  return {
    actorUserId: getActor(request).user.id,
    requestId: getRequestId(response),
    ipAddress: request.ip,
  };
}

export function createServiceRequestRouter(
  identity: IdentityService,
  service: ServiceRequestService,
  policy: AppConfig['requestFlow']
): Router {
  const router = Router();
  const authenticate = requireAuthentication(identity);
  const patient = requireCapability('service_request:manage:self');
  const professional = requireCapability('service_request:read:eligible');
  const canOffer = requireCapability('offer:create:self');
  const canManageOffer = requireCapability('offer:manage:self');
  const mutationLimiter = createRateLimiter({
    windowMs: 60_000,
    maximum: policy.mutationsPerMinute,
  });

  router.post('/service-requests', authenticate, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const input = parseCreateServiceRequest(request.body, policy);
    const idempotencyKey = parseIdempotencyKey(request.header('idempotency-key'));
    const created = await service.createRequest(
      getActor(request),
      input,
      idempotencyKey,
      auditContext(request, response)
    );
    response.status(201).json(envelope(created, response));
  }));

  router.get('/service-requests/me', authenticate, patient, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const page = await service.listOwnRequests(
      getActor(request),
      parsePageQuery(request.query as Record<string, unknown>, policy)
    );
    response.json({
      data: page.items,
      meta: { requestId: getRequestId(response), nextCursor: page.nextCursor },
    });
  }));

  router.get('/service-requests/policy', authenticate, (_request, response) => {
    response.json(envelope(service.getPolicy(), response));
  });

  router.get('/service-requests/eligible', authenticate, professional, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const page = await service.listEligibleRequests(
      getActor(request),
      parseEligiblePageQuery(request.query as Record<string, unknown>, policy)
    );
    response.json({
      data: page.items,
      meta: { requestId: getRequestId(response), nextCursor: page.nextCursor },
    });
  }));

  router.get('/service-requests/:requestId', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const requestId = parseUuid(request.params.requestId, 'requestId');
    response.json(envelope(await service.findRequest(getActor(request), requestId), response));
  }));

  router.post('/service-requests/:requestId/cancel', authenticate, patient, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    assertEmptyBody(request.body);
    const requestId = parseUuid(request.params.requestId, 'requestId');
    response.json(envelope(
      await service.cancelRequest(getActor(request), requestId, auditContext(request, response)),
      response
    ));
  }));

  router.post('/service-requests/:requestId/offers', authenticate, canOffer, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const requestId = parseUuid(request.params.requestId, 'requestId');
    const input = parseOfferBody(request.body, policy);
    const idempotencyKey = parseIdempotencyKey(request.header('idempotency-key'));
    const created = await service.createOffer(
      getActor(request),
      requestId,
      input.amount,
      input.message,
      idempotencyKey,
      auditContext(request, response)
    );
    response.status(201).json(envelope(created, response));
  }));

  router.get('/service-requests/:requestId/offers', authenticate, patient, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const requestId = parseUuid(request.params.requestId, 'requestId');
    response.json(envelope(await service.listOffers(getActor(request), requestId), response));
  }));

  router.post(
    '/service-requests/:requestId/offers/:offerId/withdraw',
    authenticate,
    canManageOffer,
    mutationLimiter,
    asyncHandler(async (request: AuthenticatedRequest, response) => {
      assertEmptyBody(request.body);
      const requestId = parseUuid(request.params.requestId, 'requestId');
      const offerId = parseUuid(request.params.offerId, 'offerId');
      response.json(envelope(
        await service.withdrawOffer(
          getActor(request),
          requestId,
          offerId,
          auditContext(request, response)
        ),
        response
      ));
    })
  );

  router.post(
    '/service-requests/:requestId/offers/:offerId/accept',
    authenticate,
    patient,
    mutationLimiter,
    asyncHandler(async (request: AuthenticatedRequest, response) => {
      assertEmptyBody(request.body);
      const requestId = parseUuid(request.params.requestId, 'requestId');
      const offerId = parseUuid(request.params.offerId, 'offerId');
      const idempotencyKey = parseIdempotencyKey(request.header('idempotency-key'));
      response.json(envelope(
        await service.acceptOffer(
          getActor(request),
          requestId,
          offerId,
          idempotencyKey,
          auditContext(request, response)
        ),
        response
      ));
    })
  );

  return router;
}
