// Feedback Service - thumbs up/down on assistant answers

const supabase = require('../config/supabaseClient');

async function rateMessage(userId, messageId, rating) {
  if (!['up', 'down'].includes(rating)) {
    throw new Error('rating must be "up" or "down"');
  }

  // Verify the message belongs to this user
  const { data: msg, error: msgErr } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('id', messageId)
    .eq('user_id', userId)
    .single();

  if (msgErr || !msg) {
    return { error: 'Message not found', status: 404 };
  }

  // Upsert (one rating per user per message)
  const { data, error } = await supabase
    .from('message_feedback')
    .upsert(
      { message_id: messageId, user_id: userId, rating },
      { onConflict: 'message_id,user_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('[Feedback] Upsert failed:', error.message);
    return { error: 'Failed to save feedback', status: 500 };
  }

  return { feedback: data };
}

module.exports = { rateMessage };
