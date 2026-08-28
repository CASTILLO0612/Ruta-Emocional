import { Router } from 'express';
import { AppConfig } from '../../../config/env';
import { IdentityService } from '../../identity/application/identityService';
import {
  AuthenticatedRequest,
  getActor,
  requireAuthentication,
  requireCapability,
} from '../../identity/presentation/authMiddleware';
import { ProfessionalDirectoryService } from '../application/professionalDirectoryService';
import { MODALITIES } from '../domain/professionalDirectoryTypes';
import { asyncHandler } from '../../../shared/presentation/http/asyncHandler';
import { createRateLimiter } from '../../../shared/presentation/http/rateLimiter';
import { getRequestId } from '../../../shared/presentation/http/requestContext';
import {
  parseAdminListQuery,
  parseAvailabilityException,
  parseDirectoryQuery,
  parseEvidenceSubmission,
  parseModality,
  parseModalityConfiguration,
  parseProfilePatch,
  parseSpecialtyCode,
  parseSpecialtyCreate,
  parseSpecialtySelection,
  parseSpecialtyStatus,
  parseUuid,
  parseVerificationDecision,
  parseWeeklyAvailability,
} from './professionalDirectoryValidation';

function auditContext(request: AuthenticatedRequest, response: Parameters<typeof getRequestId>[0]) {
  return {
    actorUserId: getActor(request).user.id,
    requestId: getRequestId(response),
    ipAddress: request.ip,
  };
}

function envelope<T>(data: T, response: Parameters<typeof getRequestId>[0]) {
  return { data, meta: { requestId: getRequestId(response) } };
}

export function createProfessionalDirectoryRouter(
  identity: IdentityService,
  service: ProfessionalDirectoryService,
  config: AppConfig['professionalDirectory']
): Router {
  const router = Router();
  const authenticate = requireAuthentication(identity);
  const onboarding = requireCapability('psychologist_onboarding:update:self');
  const administrator = requireCapability('psychologist_verification:manage');
  const publicLimiter = createRateLimiter({
    windowMs: 60_000,
    maximum: config.publicRequestsPerMinute,
  });

  router.get('/catalogs/specialties', publicLimiter, asyncHandler(async (_request, response) => {
    response.json(envelope(await service.listSpecialties(), response));
  }));

  router.get('/catalogs/modalities', publicLimiter, (_request, response) => {
    response.json(envelope({ codes: MODALITIES, currencies: config.supportedCurrencies }, response));
  });

  router.get('/psychologists', publicLimiter, asyncHandler(async (request, response) => {
    const filters = parseDirectoryQuery(request.query as Record<string, unknown>, config);
    const page = await service.listPublic(filters);
    response.json({
      data: page.items,
      meta: { requestId: getRequestId(response), nextCursor: page.nextCursor },
    });
  }));

  router.get('/psychologists/me', authenticate, onboarding, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    response.json(envelope(await service.findOwnProfile(getActor(request)), response));
  }));

  router.patch('/psychologists/me', authenticate, onboarding, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const { bio } = parseProfilePatch(request.body);
    const profile = await service.updateOwnBio(
      getActor(request),
      bio,
      auditContext(request, response)
    );
    response.json(envelope(profile, response));
  }));

  router.put('/psychologists/me/specialties', authenticate, onboarding, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const body = parseSpecialtySelection(request.body);
    const profile = await service.replaceOwnSpecialties(
      getActor(request),
      body.specialtyCodes,
      body.primarySpecialtyCode,
      auditContext(request, response)
    );
    response.json(envelope(profile, response));
  }));

  router.put('/psychologists/me/modalities/:modality', authenticate, onboarding, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const modality = parseModality(request.params.modality);
    const body = parseModalityConfiguration(request.body, config.supportedCurrencies);
    const profile = await service.upsertOwnModality(
      getActor(request),
      modality,
      body.amount,
      body.currency,
      body.isEnabled,
      auditContext(request, response)
    );
    response.json(envelope(profile, response));
  }));

  router.put('/psychologists/me/availability', authenticate, onboarding, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const body = parseWeeklyAvailability(request.body, config.maxWeeklyRules);
    const profile = await service.replaceOwnAvailability(
      getActor(request),
      body.timezone,
      body.rules,
      auditContext(request, response)
    );
    response.json(envelope(profile, response));
  }));

  router.post('/psychologists/me/availability-exceptions', authenticate, onboarding, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const body = parseAvailabilityException(request.body);
    const profile = await service.addOwnAvailabilityException(
      getActor(request),
      body,
      auditContext(request, response)
    );
    response.status(201).json(envelope(profile, response));
  }));

  router.post('/psychologists/me/verification-submissions', authenticate, onboarding, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const body = parseEvidenceSubmission(request.body);
    const profile = await service.submitVerificationEvidence(
      getActor(request),
      body.licenseId,
      body.evidenceObjectKey,
      auditContext(request, response)
    );
    response.status(201).json(envelope(profile, response));
  }));

  router.get('/psychologists/:psychologistId', publicLimiter, asyncHandler(async (request, response) => {
    const id = parseUuid(request.params.psychologistId, 'psychologistId');
    response.json(envelope(await service.findPublicById(id), response));
  }));

  router.post('/admin/catalogs/specialties', authenticate, administrator, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const body = parseSpecialtyCreate(request.body);
    const specialty = await service.createSpecialty(
      getActor(request),
      body.code,
      body.name,
      auditContext(request, response)
    );
    response.status(201).json(envelope(specialty, response));
  }));

  router.patch('/admin/catalogs/specialties/:code', authenticate, administrator, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const code = parseSpecialtyCode(request.params.code);
    const isActive = parseSpecialtyStatus(request.body);
    const specialty = await service.setSpecialtyStatus(
      getActor(request),
      code,
      isActive,
      auditContext(request, response)
    );
    response.json(envelope(specialty, response));
  }));

  router.get('/admin/psychologist-verifications', authenticate, administrator, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const query = parseAdminListQuery(request.query as Record<string, unknown>, config);
    const page = await service.listPendingVerifications(getActor(request), query.cursor, query.limit);
    response.json({
      data: page.items,
      meta: { requestId: getRequestId(response), nextCursor: page.nextCursor },
    });
  }));

  router.post('/admin/psychologist-verifications/:submissionId/decision', authenticate, administrator, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const submissionId = parseUuid(request.params.submissionId, 'submissionId');
    const body = parseVerificationDecision(request.body);
    await service.decideVerification(
      getActor(request),
      submissionId,
      body.decision,
      body.publicReason,
      body.internalReason,
      auditContext(request, response)
    );
    response.status(204).end();
  }));

  return router;
}
