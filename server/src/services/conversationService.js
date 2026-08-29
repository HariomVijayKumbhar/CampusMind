// Conversation Service - chat session management (sidebar)
const supabase = require('../config/supabaseClient');

async function listConversations(userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[Conversations] List failed:', error.message);
    return [];
  }
  return data || [];
}

async function createConversation(userId, title = 'New conversation') {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error) {
    console.error('[Conversations] Create failed:', error.message);
    return null;
  }
  return data;
}

async function renameConversation(userId, conversationId, title) {
  const { data, error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return { error: 'Failed to rename conversation', status: 500 };
  if (!data) return { error: 'Conversation not found', status: 404 };
  return { conversation: data };
}

async function deleteConversation(userId, conversationId) {
  const { data, error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return { error: 'Failed to delete conversation', status: 500 };
  if (!data) return { error: 'Conversation not found', status: 404 };
  return { success: true };
}

// Touch updated_at whenever a message is added to a conversation
async function touchConversation(conversationId) {
  if (!conversationId) return;
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}

// Auto-title: first user message, trimmed to 60 chars
async function autoTitleIfNew(conversationId, firstMessage) {
  if (!conversationId || !firstMessage) return;
  const { data } = await supabase
    .from('conversations')
    .select('title')
    .eq('id', conversationId)
    .single();
  if (data && data.title === 'New conversation') {
    await supabase
      .from('conversations')
      .update({ title: firstMessage.slice(0, 60) })
      .eq('id', conversationId);
  }
}

module.exports = {
  listConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  touchConversation,
  autoTitleIfNew,
};
