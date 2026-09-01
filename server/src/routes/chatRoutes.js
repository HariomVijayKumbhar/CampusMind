const express = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const {
  sendMessage,
  getHistory,
  sendMessageStream,
  listConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  getSessionHistory,
} = require('../controllers/chatController');

const router = express.Router();

// POST /api/chat - Send a message (non-streaming)
router.post(
  '/',
  requireAuth,
  body('message')
    .isString()
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ max: 4000 }).withMessage('Message must be 4000 characters or fewer'),
  body('collection_id').optional({ nullable: true }).isUUID().withMessage('collection_id must be a valid UUID'),
  body('conversation_id').optional({ nullable: true }).isUUID().withMessage('conversation_id must be a valid UUID'),
  body('agentic').optional().isBoolean(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    sendMessage(req, res);
  }
);

// POST /api/chat/stream - Server-Sent Events streaming endpoint
router.post(
  '/stream',
  requireAuth,
  body('agentic').optional().isBoolean(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    return sendMessageStream(req, res);
  }
);

// GET /api/chat/history - Paginated history (cursor-based)
// Supports ?cursor=created_at|id&limit=20&conversation_id=uuid
router.get('/history', requireAuth, (req, res) => getSessionHistory(req, res));

// --- Conversation management (session sidebar) ---
router.get('/conversations', requireAuth, listConversations);
router.post('/conversations', requireAuth, createConversation);
router.patch('/conversations/:id', requireAuth, renameConversation);
router.delete('/conversations/:id', requireAuth, deleteConversation);

module.exports = router;
