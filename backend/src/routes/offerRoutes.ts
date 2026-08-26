import { Router } from 'express';
import {
  createOffer,
  getOffersForRequest,
  acceptOffer,
} from '../controllers/offerController';

const router = Router();

router.post('/', createOffer);
router.get('/request/:requestId', getOffersForRequest);
router.post('/accept', acceptOffer);

export default router;
