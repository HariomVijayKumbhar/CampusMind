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

// Fetch the newest page first (descending), then reverse so the caller gets
// chronological order. Pagination walks backward through older messages using
// a strict `lt` cursor (the oldest created_at of the previous page) so the
// cursor message itself is never re-fetched/duplicated.
async function getHistory(userId, cursor = null, limit = PAGE_SIZE) {
  try {
    if (!userId) {
      throw new Error('userId is required');
    }

    let query = supabase
      .from('chat_messages')
      .select('id, user_id, role, content, sources, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    let cursorCreatedAt = null;
    let cursorId = null;
    if (cursor) {
      // Cursor format: "created_at|id" so rows sharing a created_at timestamp
      // are not skipped when paging backward.
      const separatorIndex = cursor.indexOf('|');
      if (separatorIndex !== -1) {
        cursorCreatedAt = cursor.slice(0, separatorIndex);
        cursorId = cursor.slice(separatorIndex + 1);
      } else {
        cursorCreatedAt = cursor;
      }
    }

    if (cursorCreatedAt) {
      if (cursorId) {
        // Rows strictly older than the cursor tuple (created_at, id)
        query = query.or(
          `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
        );
      } else {
        query = query.lt('created_at', cursorCreatedAt);
      }
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

    // data is newest-first; reverse to chronological order for the client
    const messages = (data || []).reverse();
    // Cursor for loading the next OLDER page = oldest message of this page,
    // encoded as "created_at|id" to disambiguate identical timestamps.
    const oldestMessage = messages.length > 0 ? messages[0] : null;
    const hasMore = messages.length >= limit;

    return {
      messages,
      pagination: {
        cursor: oldestMessage ? `${oldestMessage.created_at}|${oldestMessage.id}` : null,
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
