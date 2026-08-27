// Chat Service - message persistence and history retrieval
// Updated with cursor-based pagination and foreign key resilience

const supabase = require('../config/supabaseClient');
const authService = require('./authService');

const PAGE_SIZE = 20;

async function saveMessage(userId, role, content, sources = [], userObj = null) {
  try {
    if (!userId || !role || !content) {
      throw new Error('userId, role, and content are required');
    }

    if (!['user', 'assistant'].includes(role)) {
      throw new Error('role must be "user" or "assistant"');
    }

    // Ensure the profile row exists so foreign key constraint does not fail
    await authService.getProfile(userObj || userId);

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        role: role,
        content: content,
        sources: sources || [],
      })
      .select()
      .single();

    if (error) {
      console.error(`[ChatService] Failed to save message: ${error.message}`);
      // If saving fails due to schema or table issue, don't crash the entire request
      return {
        id: 'msg-' + Date.now(),
        user_id: userId,
        role: role,
        content: content,
        sources: sources || [],
        created_at: new Date().toISOString(),
      };
    }

    return data;
  } catch (error) {
    console.error('Save message error:', error);
    return {
      id: 'msg-' + Date.now(),
      user_id: userId,
      role: role,
      content: content,
      sources: sources || [],
      created_at: new Date().toISOString(),
    };
  }
}

async function getHistory(userId, cursor = null, limit = PAGE_SIZE) {
  try {
    if (!userId) {
      throw new Error('userId is required');
    }

    let query = supabase
      .from('chat_messages')
      .select('id, user_id, role, content, sources, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (cursor) {
      query = query.gte('created_at', cursor);
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.warn(`[ChatService] Failed to fetch history: ${error.message}`);
      return {
        messages: [],
        pagination: { cursor: null, hasMore: false, limit },
      };
    }

    const messages = data || [];
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const hasMore = messages.length >= limit;

    return {
      messages,
      pagination: {
        cursor: lastMessage ? lastMessage.created_at : null,
        hasMore,
        limit,
      },
    };
  } catch (error) {
    console.error('Get history error:', error);
    return {
      messages: [],
      pagination: { cursor: null, hasMore: false, limit },
    };
  }
}

async function getRecentMessages(userId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn(`[ChatService] Failed to fetch recent messages: ${error.message}`);
      return [];
    }

    return (data || []).reverse();
  } catch (error) {
    console.error('Get recent messages error:', error);
    return [];
  }
}

module.exports = {
  saveMessage,
  getHistory,
  getRecentMessages,
};
