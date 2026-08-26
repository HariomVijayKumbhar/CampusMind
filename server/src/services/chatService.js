// Chat Service - message persistence and history retrieval
// Updated with cursor-based pagination

const supabase = require('../config/supabaseClient');

const PAGE_SIZE = 20;

async function saveMessage(userId, role, content, sources = []) {
  try {
    if (!userId || !role || !content) {
      throw new Error('userId, role, and content are required');
    }

    if (!['user', 'assistant'].includes(role)) {
      throw new Error('role must be "user" or "assistant"');
    }

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
      throw new Error(`Failed to save message: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Save message error:', error);
    throw error;
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
      throw new Error(`Failed to fetch history: ${error.message}`);
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
    throw error;
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
      throw new Error(`Failed to fetch recent messages: ${error.message}`);
    }

    return (data || []).reverse();
  } catch (error) {
    console.error('Get recent messages error:', error);
    throw error;
  }
}

module.exports = {
  saveMessage,
  getHistory,
  getRecentMessages,
};
