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
const conversationService = require('../services/conversationService');

const router = express.Router();

router.post(
  '/',
  requireAuth,
  body('message').isString().trim().notEmpty().withMessage('Message is required'),
  body('collection_id').optional({ nullable: true }).isUUID().withMessage('collection_id must be a valid UUID'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await sendMessage(req, res);
  }
);

router.get('/history', requireAuth, getHistory);

module.exports = router;

router.post('/stream', requireAuth, sendMessageStream);

// --- Conversation routes ----------------------------------------------------
router.get('/conversations', requireAuth, listConversations);

router.post('/conversations', requireAuth, createConversation);

router.patch('/conversations/:id', requireAuth, (req, res) =>
  renameConversation(req, res)
);

router.delete('/conversations/:id', requireAuth, (req, res) =>
  deleteConversation(req, res)
);

// Session-scoped history (falls back to all messages when no id given)
router.get('/history', requireAuth, (req, res) => getSessionHistory(req, res));
