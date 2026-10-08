import { Router } from 'express';
import { asyncHandler } from '../../../shared/presentation/http/asyncHandler';
import { getRequestId } from '../../../shared/presentation/http/requestContext';
import { IdentityService } from '../../identity/application/identityService';
import {
  AuthenticatedRequest,
  getActor,
  requireAuthentication,
} from '../../identity/presentation/authMiddleware';
import { NotificationService } from '../application/notificationService';
import { parseInstallationId, parsePushDevice } from './notificationValidation';

export function createNotificationRouter(
  identity: IdentityService,
  notifications: NotificationService
): Router {
  const router = Router();
  const authenticate = requireAuthentication(identity);

  router.put('/notifications/devices/current', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const device = await notifications.registerDevice(getActor(request), parsePushDevice(request.body));
    response.json({ data: device, meta: { requestId: getRequestId(response) } });
  }));

  router.delete('/notifications/devices/:installationId', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    await notifications.deactivateDevice(
      getActor(request),
      parseInstallationId(request.params.installationId)
    );
    response.status(204).end();
  }));

  return router;
}
