// Chat Controller - request parsing and response shaping
// Updated with hybrid RAG pipeline (collection filter, confidence score)

const ragService = require('../services/ragService');
const chatService = require('../services/chatService');
const conversationService = require('../services/conversationService');
const supabase = require('../config/supabaseClient');
const { trackUsage } = require('../services/usageTracker');
const queryRewriteService = require('../services/queryRewriteService');
const ragConfig = require('../config/rag');

async function sendMessage(req, res) {
  try {
    const { message, collection_id } = req.body;
    const userId = req.userId;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`[Chat] Message from ${userId}: ${message.substring(0, 50)}...`);

    let conversationId = req.body.conversation_id || null;
    if (!conversationId) {
      const conv = await conversationService.createConversation(userId);
      conversationId = conv ? conv.id : null;
    }

    const recentMessages = await chatService.getRecentMessages(userId, 10);
    trackUsage(userId, 'chat', { conversation_id: conversationId });

    const userMsg = await chatService.saveMessage(userId, 'user', message, [], req.user);
    if (conversationId && userMsg && userMsg.id && !String(userMsg.id).startsWith('msg-')) {
      await supabase.from('chat_messages').update({ conversation_id: conversationId }).eq('id', userMsg.id);
      conversationService.autoTitleIfNew(conversationId, message);
    }

    const ragResult = await ragService.generateAnswer(
      message,
      userId,
      recentMessages,
      collection_id || null
    );

    const assistantMsg = await chatService.saveMessage(
      userId,
      'assistant',
      ragResult.answer,
      ragResult.sources,
      req.user
    );
    if (conversationId && assistantMsg && assistantMsg.id && !String(assistantMsg.id).startsWith('msg-')) {
      await supabase.from('chat_messages').update({ conversation_id: conversationId }).eq('id', assistantMsg.id);
      await conversationService.touchConversation(conversationId);
    }

    res.json({
      success: true,
      answer: ragResult.answer,
      conversation_id: conversationId,
      sources: ragResult.sources,
      confidence: ragResult.confidence,
      usedFallback: ragResult.usedFallback,
    });
  } catch (error) {
    console.error('[Chat] Controller error:', error);
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
    console.error('[Chat] History error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch history' });
  }
}

// --- Streaming (SSE) chat -------------------------------------------------

/**
 * POST /api/chat/stream  (Server-Sent Events)
 * Streams the answer token-by-token, then emits sources/confidence and
 * persists both messages. Falls back to a single JSON event if streaming
 * is unavailable.
 */
async function sendMessageStream(req, res) {
  const { message, collection_id } = req.body;
  const userId = req.userId;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const recentMessages = await chatService.getRecentMessages(userId, 10);
    await chatService.saveMessage(userId, 'user', message, [], req.user);

    const ragResult = await ragService.generateAnswerStream(
      message,
      userId,
      recentMessages,
      collection_id || null
    );

    if (ragResult.usedFallback) {
      send('meta', { sources: [], confidence: 0, usedFallback: true });
      send('token', { text: ragResult.answer });
      send('done', {
        answer: ragResult.answer,
        sources: [],
        confidence: 0,
        usedFallback: true,
      });
      await chatService.saveMessage(userId, 'assistant', ragResult.answer, [], req.user);
      return res.end();
    }

    send('meta', {
      sources: ragResult.sources,
      confidence: ragResult.confidence,
      usedFallback: false,
    });

    let fullText = '';
    for await (const token of ragResult.stream.tokenGenerator()) {
      fullText += token;
      send('token', { text: token });
    }

    send('done', {
      answer: fullText,
      sources: ragResult.sources,
      confidence: ragResult.confidence,
      usedFallback: false,
    });

    await chatService.saveMessage(userId, 'assistant', fullText, ragResult.sources, req.user);
    res.end();
  } catch (error) {
    console.error('[Chat] Stream error:', error);
    // Headers may already be sent - emit an error event if so
    if (res.headersSent) {
      send('error', { error: error.message || 'Failed to process message' });
      res.end();
    } else {
      res.status(500).json({ error: error.message || 'Failed to process message' });
    }
  }
}

module.exports = {
  sendMessage,
  getHistory,
  sendMessageStream,
  listConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  getSessionHistory,
};

// --- Conversations (session sidebar) ---------------------------------------

async function listConversations(req, res) {
  const conversations = await conversationService.listConversations(req.userId);
  res.json({ success: true, conversations });
}

async function createConversation(req, res) {
  const conversation = await conversationService.createConversation(req.userId);
  if (!conversation) return res.status(500).json({ error: 'Failed to create conversation' });
  res.json({ success: true, conversation });
}

async function renameConversation(req, res) {
  const result = await conversationService.renameConversation(
    req.userId, req.params.id, (req.body.title || '').trim().slice(0, 120) || 'Untitled'
  );
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ success: true, ...result });
}

async function deleteConversation(req, res) {
  const result = await conversationService.deleteConversation(req.userId, req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ success: true });
}

/**
 * GET /api/chat/history?conversation_id=... — session-scoped history.
 * Falls back to all messages when no conversation_id is given (legacy).
 */
async function getSessionHistory(req, res) {
  try {
    const userId = req.userId;
    const conversationId = req.query.conversation_id || null;
    const cursor = req.query.cursor || null;
    const limit = parseInt(req.query.limit, 10) || 20;

    if (!conversationId) {
      const result = await chatService.getHistory(userId, cursor, limit);
      return res.json({ success: true, ...result });
    }

    // Verify ownership
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const result = await chatService.getHistory(userId, cursor, limit, conversationId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Chat] Session history error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch history' });
  }
}
