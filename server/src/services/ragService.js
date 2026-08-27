// RAG Service - orchestrates the full pipeline:
// rewrite (Phase 5) -> hybrid retrieve (semantic + keyword + RRF) -> LLM re-rank ->
// fallback check -> prompt assembly -> Groq generation.

const { Groq } = require('groq-sdk');
const ragConfig = require('../config/rag');
const retrievalService = require('./retrievalService');
const rerankService = require('./rerankService');
const cacheService = require('./cacheService');

let groqInstance = null;
if (ragConfig.groqApiKey) {
  try {
    groqInstance = new Groq({ apiKey: ragConfig.groqApiKey });
  } catch (err) {
    console.warn('[RAG] Groq initialization skipped or failed:', err.message);
  }
}

const FALLBACK_ANSWER =
  "I couldn't find relevant information in the uploaded college documents for your question. Please try rephrasing your question or check back later.";

/**
 * Generate the embedding for a question, using the question cache when possible.
 */
async function embedQuestion(question) {
  const cached = cacheService.getCachedEmbedding(question);
  if (cached) {
    return cached;
  }

  const embeddingService = require('./embeddingService');
  const embedding = await embeddingService.embedText(question);
  cacheService.setCachedEmbedding(question, embedding);
  return embedding;
}

/**
 * Locate the most relevant span in a chunk and shape a citation.
 * `highlighted_span` = { text, start, end } offsets into `excerpt`.
 */
function buildSource(chunk, idx) {
  const content = chunk.content || '';
  const documentTitle = chunk.document_title || 'Campus Document';

  // Prefer the top-ranked chunk: highlight the whole excerpt (it is the answer source).
  // For lower-ranked chunks, highlight the best-scoring sentence when possible.
  let start = 0;
  let end = content.length;

  if (idx > 0 && content.length > 240) {
    const sentences = content.match(/[^.!?\n]+[.!?]?/g) || [];
    if (sentences.length > 1) {
      const candidates = sentences
        .map((sentence) => ({ sentence, score: sentence.length }))
        .sort((a, b) => b.score - a.score);
      const best = candidates[0].sentence;
      start = content.indexOf(best);
      end = start + best.length;
    }
  }

  return {
    document_title: documentTitle,
    excerpt: content,
    highlighted_span: { text: content.slice(start, end), start, end },
    confidence: typeof chunk.relevanceScore === 'number' ? chunk.relevanceScore / 10 : null,
    similarity: chunk.similarity ?? null,
  };
}

function buildSources(chunks) {
  return chunks.map((chunk, idx) => buildSource(chunk, idx));
}

/**
 * Assemble the generation prompt from the re-ranked context chunks.
 * Conversation history is used in Phase 5 (query rewriting); the LLM still gets
 * it here for conversational coherence.
 */
function assemblePrompt(question, chunks, conversationHistory = []) {
  const contextText = chunks
    .map((chunk, i) => `[Chunk ${i + 1} - ${chunk.document_title || 'Document'}]\n${chunk.content}`)
    .join('\n\n');

  const systemPrompt = `You are CampusMind, a helpful and knowledgeable college assistant. Answer the user's question accurately using ONLY the provided document chunks and conversation history.

Guidelines:
- If the answer is found in the context, provide a clear, concise, and structured answer.
- If the answer is NOT in the provided documents or context, say "I don't have that information in the college knowledge base."
- Do not invent facts, dates, or details.`;

  const historyText = conversationHistory
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  const userPrompt = `${historyText ? `Previous conversation:\n${historyText}\n\n` : ''}Knowledge Base Context:
${contextText}

Question: ${question}

Answer:`;

  return { systemPrompt, userPrompt };
}

/**
 * Stream the answer from Groq token-by-token.
 * Returns { tokenGenerator, finalize } where tokenGenerator is an async generator
 * yielding each token and finalize() drains the stream and resolves to the full text.
 */
function createAnswerStream(systemPrompt, userPrompt) {
  if (!groqInstance) {
    throw new Error('Groq client is not configured.');
  }

  const streamPromise = groqInstance.chat.completions.create({
    model: ragConfig.groqModel,
    max_tokens: ragConfig.llmMaxTokens,
    temperature: ragConfig.llmTemperature,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  async function* tokenGenerator() {
    const stream = await streamPromise;
    let fullText = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        yield delta;
      }
    }
    return fullText;
  }

  const iterator = tokenGenerator();
  const finalize = async () => {
    let last = '';
    for await (const value of iterator) {
      last = value;
    }
    return last;
  };

  return { tokenGenerator, finalize };
}

/**
 * Full hybrid RAG pipeline. Returns either a fallback result or a generation
 * descriptor:
 * - fallback: { answer, sources: [], usedFallback: true, confidence: 0 }
 * - hit: { prompt, sources, confidence, stream } where stream.tokenGenerator()
 *   yields answer tokens and stream.finalize() resolves to the full text.
 */
async function generateAnswerStream(question, userId, conversationHistory = [], collectionId = null) {
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }

  console.log(
    `[RAG] Processing question for user ${userId}: ${question.substring(0, 50)}...`
  );

  const candidates = await retrievalService.hybridRetrieve(question, collectionId);

  if (candidates.length === 0) {
    console.log('[RAG] Fallback: No candidates retrieved');
    return {
      answer: FALLBACK_ANSWER,
      sources: [],
      usedFallback: true,
      confidence: 0,
    };
  }

  // LLM re-ranking: one batched Groq call for all candidates
  const reranked = await rerankService.rerankChunks(question, candidates);
  const bestScore = reranked.length > 0 ? reranked[0].relevanceScore : 0;

  // Explicit, testable fallback rule (config/rag.js)
  if (bestScore < ragConfig.fallbackRelevanceThreshold) {
    console.log(`[RAG] Fallback: best re-rank score ${bestScore} < threshold ${ragConfig.fallbackRelevanceThreshold}`);
    return {
      answer: FALLBACK_ANSWER,
      sources: [],
      usedFallback: true,
      confidence: 0,
    };
  }

  const topChunks = reranked.slice(0, ragConfig.rerankTopK);
  const sources = buildSources(topChunks);
  const confidence = topChunks[0].relevanceScore / 10; // 0-1 from best re-rank score

  const { systemPrompt, userPrompt } = assemblePrompt(question, topChunks, conversationHistory);

  const stream = createAnswerStream(systemPrompt, userPrompt);

  return {
    prompt: { systemPrompt, userPrompt },
    sources,
    confidence,
    usedFallback: false,
    stream,
  };
}

/**
 * Non-streamed variant: used by the integration test suite.
 */
async function generateAnswer(question, userId, conversationHistory = [], collectionId = null) {
  const result = await generateAnswerStream(question, userId, conversationHistory, collectionId);

  if (result.usedFallback) {
    return { answer: result.answer, sources: [], usedFallback: true, confidence: 0 };
  }

  const answer = await result.stream.finalize();
  return {
    answer,
    sources: result.sources,
    usedFallback: false,
    confidence: result.confidence,
  };
}

module.exports = {
  generateAnswer,
  generateAnswerStream,
  assemblePrompt,
  buildSources,
  buildSource,
  FALLBACK_ANSWER,
};
