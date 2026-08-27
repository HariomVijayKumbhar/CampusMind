const express = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const { sendMessage, getHistory } = require('../controllers/chatController');

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
