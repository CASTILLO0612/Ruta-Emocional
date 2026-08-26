import { Router } from 'express';
import { analyzeSymptoms } from '../controllers/mentaController';

const router = Router();

// POST /api/menta/analyze — Análisis de triaje con IA MENTA
router.post('/analyze', analyzeSymptoms);

export default router;
