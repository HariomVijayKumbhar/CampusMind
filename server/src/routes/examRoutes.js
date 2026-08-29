// Exam Planner Routes
const express = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const examPlannerService = require('../services/examPlannerService');

const router = express.Router();
router.use(requireAuth);

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
}

router.get('/', async (req, res) => {
  try {
    const exams = await examPlannerService.listExams(req.userId);
    res.json({ success: true, exams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  '/',
  body('subject').isString().trim().notEmpty(),
  body('exam_date').isISO8601(),
  body('topics').optional().isString(),
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const exam = await examPlannerService.createExam(
        req.userId, req.body.subject, req.body.exam_date, req.body.topics || ''
      );
      res.status(201).json({ success: true, exam });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.post(
  '/:id/plan',
  body('subject').isString().trim().notEmpty(),
  body('exam_date').isISO8601(),
  body('topics').optional().isString(),
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const result = await examPlannerService.generatePlan(
        req.userId, req.params.id, req.body.subject, req.body.exam_date, req.body.topics || ''
      );
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('[ExamPlanner] Plan error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate plan' });
    }
  }
);

router.delete('/:id', async (req, res) => {
  try {
    const result = await examPlannerService.deleteExam(req.userId, req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
