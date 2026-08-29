// Usage Tracker - fire-and-forget analytics events (never blocks requests)

const supabase = require('../config/supabaseClient');

const VALID_EVENTS = ['chat', 'quiz', 'flashcards', 'summary', 'upload'];

function trackUsage(userId, eventType, metadata = {}) {
  if (!VALID_EVENTS.includes(eventType)) return;
  supabase
    .from('usage_events')
    .insert({ user_id: userId || null, event_type: eventType, metadata })
    .then(({ error }) => {
      if (error) console.warn('[Usage] Track failed:', error.message);
    })
    .catch(() => { });
}

module.exports = { trackUsage };
