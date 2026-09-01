// Learning Service - Personalized Learning Engine (Phase 3)
//
// Capabilities:
//   - getProgress(userId)        : engagement, mastery, recent activity
//   - generateFlashcards(...)    : persist flashcards from a Q&A + sources
//   - listDueFlashcards(userId)  : spaced-repetition (SM-2) due cards
//   - reviewFlashcard(id, q)     : apply SM-2 and update schedule
//   - detectWeakAreas(userId)    : aggregate from message_feedback
//   - recommendStudy(userId)     : surface "review X" recommendations
//
// SM-2 algorithm adapted from SuperMemo 2: ease factor + interval.

const { Groq } = require('groq-sdk');
const supabase = require('../config/supabaseClient');
const ragConfig = require('../config/rag');

let groqInstance = null;
if (ragConfig.groqApiKey) {
  try {
    groqInstance = new Groq({ apiKey: ragConfig.groqApiKey });
  } catch (err) {
    console.warn('[Learning] Groq init skipped:', err.message);
  }
}

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * SM-2 update step.
 * @param {number} quality 0-5 (0=again, 3=hard, 5=easy)
 * @param {object} card { ease_factor, interval_days, repetitions }
 * @returns {object} next state
 */
function calculateSM2(quality, card) {
  const easeFactor = card.ease_factor || ragConfig.learning?.sm2?.defaultEaseFactor || 2.5;
  const interval = card.interval_days || 0;
  const repetitions = card.repetitions || 0;
  const minEF = ragConfig.learning?.sm2?.minEaseFactor || 1.3;

  if (quality < 3) {
    return {
      ease_factor: Math.max(minEF, easeFactor - 0.2),
      interval_days: 1,
      repetitions: 0,
    };
  }

  let newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEF = Math.max(minEF, newEF);

  let newInterval;
  if (repetitions === 0) {
    newInterval = 1;
  } else if (repetitions === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(interval * newEF);
  }
  newInterval = Math.max(1, newInterval);

  return {
    ease_factor: newEF,
    interval_days: newInterval,
    repetitions: repetitions + 1,
  };
}

function nextDueDate(intervalDays) {
  const d = new Date();
  d.setDate(d.getDate() + intervalDays);
  return d.toISOString();
}

async function getProgress(userId) {
  if (!userId) throw new Error('userId required');
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [messagesRes, feedbackRes, flashcardsRes, sessionsRes, weakRes] = await Promise.all([
      supabase.from('chat_messages').select('id, created_at').eq('user_id', userId).gte('created_at', since),
      supabase.from('message_feedback').select('id, rating').eq('user_id', userId).gte('created_at', since),
      supabase.from('flashcards').select('id, due_date').eq('user_id', userId),
      supabase.from('study_sessions').select('id, session_type, items_reviewed, correct_count, created_at')
        .eq('user_id', userId).gte('created_at', since),
      supabase.from('weak_areas').select('id, topic, failure_count').eq('user_id', userId)
        .order('failure_count', { ascending: false }).limit(5),
    ]);

    const totalMessages = (messagesRes.data || []).length;
    const feedback = feedbackRes.data || [];
    const thumbsDown = feedback.filter((f) => f.rating === 'down' || f.rating === -1).length;
    const totalRated = feedback.length;
    const flashcardRows = flashcardsRes.data || [];
    const dueFlashcards = flashcardRows.filter((f) => !f.due_date || new Date(f.due_date) <= new Date()).length;
    const sessions = sessionsRes.data || [];

    const totalReviewed = sessions.reduce((acc, s) => acc + (s.items_reviewed || 0), 0);
    const totalCorrect = sessions.reduce((acc, s) => acc + (s.correct_count || 0), 0);
    const mastery = totalReviewed > 0 ? totalCorrect / totalReviewed : null;

    return {
      window_days: 30,
      messages: totalMessages,
      feedback: { total: totalRated, thumbs_down: thumbsDown, ratio: totalRated > 0 ? 1 - thumbsDown / totalRated : null },
      flashcards: { total: flashcardRows.length, due: dueFlashcards },
      sessions: { total: sessions.length, items_reviewed: totalReviewed, correct: totalCorrect, mastery },
      weak_areas: weakRes.data || [],
    };
  } catch (err) {
    console.warn('[Learning] getProgress failed:', err.message);
    return {
      window_days: 30,
      messages: 0,
      feedback: { total: 0, thumbs_down: 0, ratio: null },
      flashcards: { total: 0, due: 0 },
      sessions: { total: 0, items_reviewed: 0, correct: 0, mastery: null },
      weak_areas: [],
    };
  }
}

/**
 * Persist a user-saved flashcard (Q&A pair from a chat message) and schedule it.
 */
async function saveFlashcard({ userId, question, answer, topic = null, sourceChunkId = null, front = null, back = null }) {
  if (!userId || !question || !answer) throw new Error('userId, question, answer required');
  try {
    const { data, error } = await supabase
      .from('flashcards')
      .insert({
        user_id: userId,
        question,
        answer,
        topic,
        front: front || question,
        back: back || answer,
        source_chunk_id: sourceChunkId,
        due_date: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      console.warn('[Learning] saveFlashcard failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[Learning] saveFlashcard error:', err.message);
    return null;
  }
}

async function listFlashcards(userId, { dueOnly = false, limit = 50 } = {}) {
  if (!userId) throw new Error('userId required');
  try {
    let query = supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true })
      .limit(limit);
    if (dueOnly) {
      query = query.lte('due_date', new Date().toISOString());
    }
    const { data, error } = await query;
    if (error) {
      console.warn('[Learning] listFlashcards failed:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    return [];
  }
}

async function reviewFlashcard(userId, flashcardId, quality) {
  if (!userId || !flashcardId) throw new Error('userId and flashcardId required');
  const q = Math.max(0, Math.min(5, Number(quality)));
  try {
    const { data: card, error: fetchError } = await supabase
      .from('flashcards')
      .select('*')
      .eq('id', flashcardId)
      .eq('user_id', userId)
      .single();
    if (fetchError || !card) {
      return { error: 'Flashcard not found', status: 404 };
    }

    const next = calculateSM2(q, card);
    const due = nextDueDate(next.interval_days);

    const { data, error } = await supabase
      .from('flashcards')
      .update({
        ease_factor: next.ease_factor,
        interval_days: next.interval_days,
        repetitions: next.repetitions,
        due_date: due,
        last_reviewed: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', flashcardId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { error: error.message, status: 500 };
    }

    // Log a study session
    await supabase.from('study_sessions').insert({
      user_id: userId,
      session_type: 'flashcard',
      items_reviewed: 1,
      correct_count: q >= 3 ? 1 : 0,
    });

    return { flashcard: data };
  } catch (err) {
    return { error: err.message, status: 500 };
  }
}

async function deleteFlashcard(userId, flashcardId) {
  if (!userId || !flashcardId) throw new Error('userId and flashcardId required');
  const { error } = await supabase
    .from('flashcards')
    .delete()
    .eq('id', flashcardId)
    .eq('user_id', userId);
  return error ? { error: error.message, status: 500 } : { success: true };
}

async function detectWeakAreas(userId, { limit = 10 } = {}) {
  if (!userId) throw new Error('userId required');
  try {
    const { data: feedback, error } = await supabase
      .from('message_feedback')
      .select('id, rating, message_id, created_at')
      .eq('user_id', userId)
      .eq('rating', 'down')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error || !feedback || feedback.length === 0) {
      return [];
    }

    const messageIds = feedback.map((f) => f.message_id).filter(Boolean);
    let messages = [];
    if (messageIds.length > 0) {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, content, conversation_id')
        .in('id', messageIds);
      messages = data || [];
    }
    const msgById = new Map(messages.map((m) => [m.id, m]));

    // Use LLM to cluster negative feedback into topics.
    if (groqInstance) {
      try {
        const sample = messages.slice(0, 12)
          .map((m) => `- "${(m.content || '').slice(0, 200)}"`)
          .join('\n');
        if (sample) {
          const resp = await groqInstance.chat.completions.create({
            model: ragConfig.groqModel,
            max_tokens: 400,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'You cluster user questions into topic categories. Return JSON: { "topics": [{"topic": "<short name>", "count": <int>}, ...] }. Keep topic names short (1-3 words).',
              },
              {
                role: 'user',
                content: `Cluster these user questions into topics. Count duplicates.\n\n${sample}`,
              },
            ],
          });
          const parsed = safeJsonParse(resp.choices?.[0]?.message?.content || '{}');
          if (parsed && Array.isArray(parsed.topics)) {
            const topics = parsed.topics
              .filter((t) => t && typeof t.topic === 'string')
              .slice(0, limit);
            // Upsert into weak_areas (best-effort, may be blocked by RLS for service-role)
            for (const t of topics) {
              try {
                await supabase.rpc('upsert_weak_area', {
                  p_user_id: userId,
                  p_topic: t.topic,
                  p_failure_count: Math.max(1, t.count || 1),
                });
              } catch {
                // ignore — RLS may block; table is purely advisory
              }
            }
            return topics;
          }
        }
      } catch (err) {
        console.warn('[Learning] topic clustering failed:', err.message);
      }
    }
    return [];
  } catch (err) {
    console.warn('[Learning] detectWeakAreas failed:', err.message);
    return [];
  }
}

async function recommendStudy(userId, { limit = 5 } = {}) {
  if (!userId) throw new Error('userId required');
  const weak = await detectWeakAreas(userId, { limit });
  const due = await listFlashcards(userId, { dueOnly: true, limit });
  return {
    weak_areas: weak,
    due_flashcards: due,
    recommended_count: Math.min(limit, weak.length + due.length),
  };
}

module.exports = {
  getProgress,
  saveFlashcard,
  listFlashcards,
  reviewFlashcard,
  deleteFlashcard,
  detectWeakAreas,
  recommendStudy,
  calculateSM2,
};
