import { Router } from 'express';
import { getMessagesForRequest, sendMessage, getUserConversations } from '../controllers/chatController';

const router = Router();

router.get('/messages/:requestId', getMessagesForRequest);
router.post('/messages', sendMessage);
router.get('/conversations/:userId', getUserConversations);

export default router;
