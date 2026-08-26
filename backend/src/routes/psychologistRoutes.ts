import { Router } from 'express';
import {
  getAllPsychologists,
  getNearbyPsychologists,
  updateLocation,
} from '../controllers/psychologistController';

const router = Router();

router.get('/', getAllPsychologists);
router.get('/nearby', getNearbyPsychologists);
router.put('/location', updateLocation);

export default router;
