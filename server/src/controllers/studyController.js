// Study Controller - quiz, flashcards, summarize endpoints

const studyService = require('../services/studyService');

function handleError(res, result) {
  if (result.error) {
    return res.status(result.status || 500).json({ error: result.error });
  }
  return res.json({ success: true, ...result });
}

async function generateQuiz(req, res) {
  try {
    const { topic } = req.body;
    const count = Math.min(Math.max(parseInt(req.body.count, 10) || 5, 1), 15);
    const result = await studyService.generateQuiz(topic, req.userId, count);
    handleError(res, result);
  } catch (error) {
    console.error('[Study] Quiz error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate quiz' });
  }
}

async function generateFlashcards(req, res) {
  try {
    const { topic } = req.body;
    const count = Math.min(Math.max(parseInt(req.body.count, 10) || 10, 1), 30);
    const result = await studyService.generateFlashcards(topic, req.userId, count);
    handleError(res, result);
  } catch (error) {
    console.error('[Study] Flashcards error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate flashcards' });
  }
}

async function summarize(req, res) {
  try {
    const { title, mode } = req.body;
    if (!title) return res.status(400).json({ error: 'Document title is required' });
    const result = await studyService.summarizeDocument(title, req.userId, mode || 'bullets');
    handleError(res, result);
  } catch (error) {
    console.error('[Study] Summarize error:', error);
    res.status(500).json({ error: error.message || 'Failed to summarize' });
  }
}

module.exports = { generateQuiz, generateFlashcards, summarize };
