// Study Controller - quiz, flashcards, summarize endpoints

const studyService = require('../services/studyService');
const learningService = require('../services/learningService');

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

// --- Phase 3: Personalized Learning Engine --------------------------------

async function getProgress(req, res) {
  try {
    const progress = await learningService.getProgress(req.userId);
    res.json({ success: true, progress });
  } catch (error) {
    console.error('[Study] Progress error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch progress' });
  }
}

async function saveFlashcard(req, res) {
  try {
    const { question, answer, topic, front, back } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: 'question and answer are required' });
    }
    const flashcard = await learningService.saveFlashcard({
      userId: req.userId,
      question: String(question).slice(0, 1000),
      answer: String(answer).slice(0, 4000),
      topic: topic ? String(topic).slice(0, 100) : null,
      front: front ? String(front).slice(0, 1000) : null,
      back: back ? String(back).slice(0, 4000) : null,
    });
    if (!flashcard) return res.status(500).json({ error: 'Failed to save flashcard' });
    res.json({ success: true, flashcard });
  } catch (error) {
    console.error('[Study] saveFlashcard error:', error);
    res.status(500).json({ error: error.message || 'Failed to save flashcard' });
  }
}

async function listFlashcards(req, res) {
  try {
    const dueOnly = String(req.query.due || '').toLowerCase() === 'true';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const flashcards = await learningService.listFlashcards(req.userId, { dueOnly, limit });
    res.json({ success: true, flashcards });
  } catch (error) {
    console.error('[Study] listFlashcards error:', error);
    res.status(500).json({ error: error.message || 'Failed to list flashcards' });
  }
}

async function reviewFlashcard(req, res) {
  try {
    const { id } = req.params;
    const quality = Number(req.body.quality);
    if (!Number.isFinite(quality)) {
      return res.status(400).json({ error: 'quality must be a number 0-5' });
    }
    const result = await learningService.reviewFlashcard(req.userId, id, quality);
    handleError(res, result);
  } catch (error) {
    console.error('[Study] reviewFlashcard error:', error);
    res.status(500).json({ error: error.message || 'Failed to review flashcard' });
  }
}

async function deleteFlashcard(req, res) {
  try {
    const { id } = req.params;
    const result = await learningService.deleteFlashcard(req.userId, id);
    handleError(res, result);
  } catch (error) {
    console.error('[Study] deleteFlashcard error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete flashcard' });
  }
}

async function getRecommendations(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
    const recommendations = await learningService.recommendStudy(req.userId, { limit });
    res.json({ success: true, recommendations });
  } catch (error) {
    console.error('[Study] recommendations error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch recommendations' });
  }
}

module.exports = {
  generateQuiz,
  generateFlashcards,
  summarize,
  getProgress,
  saveFlashcard,
  listFlashcards,
  reviewFlashcard,
  deleteFlashcard,
  getRecommendations,
};
