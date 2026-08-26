import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import {
  holdPayment,
  completePayment,
  refundPayment,
  getPaymentHistory,
} from '../controllers/paymentController';

const router = Router();

// Todos los endpoints de pago requieren autenticación JWT
router.post('/hold', protect as any, holdPayment);
router.post('/complete', protect as any, completePayment);
router.post('/refund', protect as any, refundPayment);
router.get('/history/:userId', protect as any, getPaymentHistory);

export default router;
