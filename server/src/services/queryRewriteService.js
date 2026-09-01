// Query Rewrite Service
// One batched Groq call per question does two jobs (Sections 8 & 13 of the spec):
//   1. Rewrites the user's message into a standalone, English-normalized search
//      question using the recent conversation history (multi-turn support).
//   2. Detects the ISO 639-1 language code of the ORIGINAL message, so the
//      answer can be generated in the same language.
// Also provides follow-up suggestion generation after an answer completes.

const { Groq } = require('groq-sdk');
const ragConfig = require('../config/rag');

let groqInstance = null;
if (ragConfig.groqApiKey) {
  try {
    groqInstance = new Groq({ apiKey: ragConfig.groqApiKey });
  } catch (err) {
    console.warn('[QueryRewrite] Groq initialization failed:', err.message);
  }
}

function ensureClient() {
  if (!groqInstance) throw new Error('Groq client is not configured.');
  return groqInstance;
}

function buildHistoryText(conversationHistory = []) {
  return conversationHistory
    .slice(-6) // last 4-6 messages per spec
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
}

/**
 * Rewrite the latest message into a standalone English search question and
 * detect the original message's language. One Groq call, JSON output.
 *
 * @returns {{ rewritten: string, language: string }}
 */
async function rewriteAndDetect(question, conversationHistory = []) {
  const groq = ensureClient();
  const historyText = buildHistoryText(conversationHistory);

  try {
    const response = await groq.chat.completions.create({
      model: ragConfig.groqModel,
      max_tokens: 256,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You are a query processor for a college information chatbot. You only output valid JSON.',
        },
        {
          role: 'user',
          content: `Conversation so far:
${historyText || '(no prior messages)'}

New user message: ${question}

Tasks:
1. "rewritten": Rewrite the new user message as a SINGLE standalone search question in English. Resolve pronouns and elliptical references using the conversation (e.g. "what about the second one?" -> "What is the fee for the B.Tech CSE program?"). If the message is already standalone, return it unchanged in meaning.
2. "language": The ISO 639-1 code of the ORIGINAL user message's language (e.g. "en", "hi", "es").

Output ONLY JSON: {"rewritten": "...", "language": "..."}`,
        },
      ],
    });

    const raw = response.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { rewritten: question, language: 'en' };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      rewritten:
        typeof parsed.rewritten === 'string' && parsed.rewritten.trim()
          ? parsed.rewritten.trim()
          : question,
      language: typeof parsed.language === 'string' && parsed.language.length === 2
        ? parsed.language.toLowerCase()
        : 'en',
    };
  } catch (err) {
    console.warn('[QueryRewrite] Rewrite failed, using raw question:', err.message);
    return { rewritten: question, language: 'en' };
  }
}

/**
 * Generate 3 short follow-up question suggestions based on the question + answer.
 * Suggestions are returned in the answer's language. Best-effort: returns []
 * on any failure (the chat UI simply hides the chips).
 */
async function generateFollowUps(question, answer, language = 'en') {
  try {
    const groq = ensureClient();
    const response = await groq.chat.completions.create({
      model: ragConfig.groqModel,
      max_tokens: 200,
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: `You generate short follow-up question suggestions for a college info chatbot. Reply ONLY in ${language} (ISO 639-1) with a JSON array of exactly 3 strings. No markdown.`,
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nAnswer: ${answer}\n\nSuggest 3 natural follow-up questions a student might ask next, each under 12 words.`,
        },
      ],
    });

    const raw = response.choices?.[0]?.message?.content || '';
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => typeof s === 'string' && s.trim())
      .map((s) => s.trim().slice(0, 120))
      .slice(0, 3);
  } catch (err) {
    console.warn('[QueryRewrite] Follow-up generation failed:', err.message);
    return [];
  }
}

module.exports = {
  rewriteAndDetect,
  generateFollowUps,
};
