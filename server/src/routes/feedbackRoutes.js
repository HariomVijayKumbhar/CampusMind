// Feedback Controller + Routes (single-purpose router)

const express = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const feedbackService = require('../services/feedbackService');

const router = express.Router();

router.post(
  '/',
  requireAuth,
  body('message_id').isUUID().withMessage('message_id must be a valid UUID'),
  body('rating').isIn(['up', 'down']).withMessage('rating must be "up" or "down"'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const result = await feedbackService.rateMessage(req.userId, req.body.message_id, req.body.rating);
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('[Feedback] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to save feedback' });
    }
  }
);

module.exports = router;
