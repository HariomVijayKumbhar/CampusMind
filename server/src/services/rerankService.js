// Re-ranking Service - batched LLM relevance scoring.
// Sends all fusion candidates to Groq in ONE call, asking for a 0-10 score per chunk.

const { Groq } = require('groq-sdk');
const ragConfig = require('../config/rag');

let groqInstance = null;
if (ragConfig.groqApiKey) {
  try {
    groqInstance = new Groq({ apiKey: ragConfig.groqApiKey });
  } catch (err) {
    console.warn('[Rerank] Groq initialization skipped or failed:', err.message);
  }
}

function buildRerankPrompt(question, chunks) {
  const numberedChunks = chunks
    .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
    .join('\n\n');

  return `You are a search relevance scorer. Score how relevant each chunk is to the user's question.

Question: ${question}

Chunks:
${numberedChunks}

Instructions:
- Output ONLY a JSON array of integers, one score per chunk, in the same order as the chunks.
- Score each chunk 0-10. 10 = directly answers the question; 0 = completely irrelevant.
- No explanations, no markdown, no extra text. Example: [7, 3, 9]`;
}

const SCORE_RE = /\[[^\]]*\]/;

/**
 * Parse a score array from the model output. Falls back to 0 for unparseable chunks.
 * Returns an array of numbers in the same order as `count`.
 */
function parseScores(raw, count) {
  if (!raw || typeof raw !== 'string') {
    return Array(count).fill(0);
  }

  const match = raw.match(SCORE_RE);
  if (!match) {
    return Array(count).fill(0);
  }

  const parsed = match[0]
    .replace(/[\[\]\s]/g, '')
    .split(',')
    .filter(Boolean)
    .map(Number);

  const [minScore, maxScore] = ragConfig.rerankScoreRange;
  const scores = [];

  for (let i = 0; i < count; i++) {
    const value = parsed[i];
    if (Number.isFinite(value)) {
      scores.push(Math.min(maxScore, Math.max(minScore, Math.round(value))));
    } else {
      scores.push(0);
    }
  }

  return scores;
}

/**
 * Batched re-ranking: one Groq call for all candidates.
 * Returns chunks sorted by descending relevance score (score attached to each).
 */
async function rerankChunks(question, chunks) {
  if (!chunks || chunks.length === 0) return [];

  if (!groqInstance) {
    throw new Error('Groq client is not configured.');
  }

  const response = await groqInstance.chat.completions.create({
    model: ragConfig.groqModel,
    max_tokens: ragConfig.llmMaxTokens,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'You are a strict relevance scorer. You only output JSON arrays of integers.',
      },
      { role: 'user', content: buildRerankPrompt(question, chunks) },
    ],
  });

  const raw = response.choices?.[0]?.message?.content || '';
  const scores = parseScores(raw, chunks.length);

  return chunks
    .map((chunk, i) => ({
      ...chunk,
      relevanceScore: scores[i],
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

module.exports = {
  rerankChunks,
  parseScores,
  buildRerankPrompt,
};
