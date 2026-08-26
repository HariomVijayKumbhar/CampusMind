// Chat Controller - request parsing and response shaping
// Updated with conversational memory (last N messages)

const ragService = require('../services/ragService');
const chatService = require('../services/chatService');

async function sendMessage(req, res) {
  try {
    const { message } = req.body;
    const userId = req.userId;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`Chat message from ${userId}: ${message.substring(0, 50)}...`);

    const recentMessages = await chatService.getRecentMessages(userId, 10);

    await chatService.saveMessage(userId, 'user', message, []);

    const ragResult = await ragService.generateAnswer(message, userId, recentMessages);

    await chatService.saveMessage(userId, 'assistant', ragResult.answer, ragResult.sources);

    res.json({
      success: true,
      answer: ragResult.answer,
      sources: ragResult.sources,
      usedFallback: ragResult.usedFallback,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to process message' });
  }
}

async function getHistory(req, res) {
  try {
    const userId = req.userId;
    const cursor = req.query.cursor || null;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await chatService.getHistory(userId, cursor, limit);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch history' });
  }
}

module.exports = {
  sendMessage,
  getHistory,
};
