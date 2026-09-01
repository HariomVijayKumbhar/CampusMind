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

// --- Phase 3: Personalized Learning Engine --------------------------------

router.get('/progress', requireAuth, studyController.getProgress);

router.post(
  '/flashcards/save',
  requireAuth,
  body('question').isString().trim().notEmpty().withMessage('Question is required'),
  body('answer').isString().trim().notEmpty().withMessage('Answer is required'),
  (req, res) => { if (validate(req, res)) studyController.saveFlashcard(req, res); }
);

router.get('/flashcards/due', requireAuth, studyController.listFlashcards);
router.delete('/flashcards/:id', requireAuth, studyController.deleteFlashcard);
router.post(
  '/flashcards/:id/review',
  requireAuth,
  body('quality').isInt({ min: 0, max: 5 }).withMessage('quality must be 0-5'),
  (req, res) => { if (validate(req, res)) studyController.reviewFlashcard(req, res); }
);

router.get('/recommendations', requireAuth, studyController.getRecommendations);

module.exports = router;
