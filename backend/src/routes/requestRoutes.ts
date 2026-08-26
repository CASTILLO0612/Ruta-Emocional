import { Router } from 'express';
import {
  createRequest,
  getActiveRequests,
  updateRequestStatus,
} from '../controllers/requestController';

const router = Router();

router.post('/', createRequest);
router.get('/active', getActiveRequests);
router.patch('/:id/status', updateRequestStatus);

export default router;
