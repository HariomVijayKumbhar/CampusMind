const express = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const studyController = require('../controllers/studyController');

const router = express.Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
}

router.post(
  '/quiz',
  requireAuth,
  body('topic').isString().trim().notEmpty().withMessage('Topic is required'),
  body('count').optional().isInt({ min: 1, max: 15 }),
  (req, res) => { if (validate(req, res)) studyController.generateQuiz(req, res); }
);

router.post(
  '/flashcards',
  requireAuth,
  body('topic').isString().trim().notEmpty().withMessage('Topic is required'),
  body('count').optional().isInt({ min: 1, max: 30 }),
  (req, res) => { if (validate(req, res)) studyController.generateFlashcards(req, res); }
);

router.post(
  '/summarize',
  requireAuth,
  body('title').isString().trim().notEmpty().withMessage('Document title is required'),
  body('mode').optional().isIn(['eli5', 'exam', 'bullets']),
  (req, res) => { if (validate(req, res)) studyController.summarize(req, res); }
);

module.exports = router;
