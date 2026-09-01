// RAG Service - orchestrates the full pipeline:
// hybrid retrieve (semantic + keyword + RRF) -> LLM re-rank ->
// fallback check -> prompt assembly -> Groq generation.

const { Groq } = require('groq-sdk');
const ragConfig = require('../config/rag');
const retrievalService = require('./retrievalService');
const rerankService = require('./rerankService');
const cacheService = require('./cacheService');
const queryRewriteService = require('./queryRewriteService');
const agentService = require('./agentService');

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
 * Conversation history is included verbatim in the prompt for conversational
 * coherence (no separate query-rewriting step).
 */
function assemblePrompt(question, chunks, conversationHistory = [], options = {}) {
  const { lengthMode = ragConfig.defaultLengthMode, language = 'en' } = options;
  const lengthModeConfig =
    ragConfig.lengthModes[lengthMode] || ragConfig.lengthModes[ragConfig.defaultLengthMode];

  const contextText = chunks
    .map((chunk, i) => `[Chunk ${i + 1} - ${chunk.document_title || 'Document'}]\n${chunk.content}`)
    .join('\n\n');

  const systemPrompt = `You are CampusMind, a helpful and knowledgeable college assistant. Answer the user's question accurately using ONLY the provided document chunks and conversation history.

Guidelines:
- If the answer is found in the context, provide a clear, concise, and structured answer.
- If the answer is NOT in the provided documents or context, say "I don't have that information in the college knowledge base."
- Do not invent facts, dates, or details.

Answer style (${lengthModeConfig.label}): ${lengthModeConfig.instruction}
Language: ${ragConfig.languageInstruction(language)}`;

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
async function generateAnswerStream(question, userId, conversationHistory = [], collectionId = null, options = {}) {
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }

  console.log(
    `[RAG] Processing question for user ${userId}: ${question.substring(0, 50)}...`
  );

  // Agentic (Phase 1) — multi-step tool-calling loop with intermediate SSE events.
  if (options.agentic && ragConfig.agentic && ragConfig.agentic.enabled) {
    return runAgenticStream(question, conversationHistory, collectionId);
  }

  // Query rewriting + language detection (spec Sections 8 & 13): retrieval runs
  // against the English-normalized rewritten question; the raw question is kept
  // for prompt/display/storage.
  let rewritten = question;
  let language = 'en';
  try {
    const rw = await queryRewriteService.rewriteAndDetect(question, conversationHistory);
    rewritten = rw.rewritten;
    language = rw.language;
    if (rewritten !== question) {
      console.log(`[RAG] Rewritten question: ${rewritten.substring(0, 80)}...`);
    }
  } catch (err) {
    console.warn('[RAG] Query rewrite skipped:', err.message);
  }

  const candidates = await retrievalService.hybridRetrieve(rewritten, collectionId);

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
  const reranked = await rerankService.rerankChunks(rewritten, candidates);
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

  const { systemPrompt, userPrompt } = assemblePrompt(question, topChunks, conversationHistory, {
    lengthMode: options.lengthMode,
    language,
  });

  const stream = createAnswerStream(systemPrompt, userPrompt);

  return {
    prompt: { systemPrompt, userPrompt },
    sources,
    confidence,
    usedFallback: false,
    language,
    stream,
  };
}

/**
 * Non-streamed variant: used by the integration test suite.
 */
async function generateAnswer(question, userId, conversationHistory = [], collectionId = null, options = {}) {
  const result = await generateAnswerStream(question, userId, conversationHistory, collectionId, options);

  if (result.usedFallback) {
    return { answer: result.answer, sources: [], usedFallback: true, confidence: 0, language: 'en' };
  }

  const answer = await result.stream.finalize();
  return {
    answer,
    sources: result.sources,
    usedFallback: false,
    confidence: result.confidence,
    language: result.language,
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

/**
 * Phase 1: Agentic RAG stream.
 * Runs agentService.runAgent to plan/iterate tool calls, then streams the final
 * answer tokens through the same `stream.tokenGenerator()` interface used by
 * the single-pass pipeline. Intermediate events (thought/tool_call/observation)
 * are queued and yielded to the controller which forwards them as SSE events.
 */
function runAgenticStream(question, conversationHistory, collectionId) {
  const eventQueue = [];
  let resolveNext = null;
  let streamDone = false;
  let streamResult = null;

  const push = (event) => {
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r({ event, done: false });
    } else {
      eventQueue.push({ event, done: false });
    }
  };

  const agentPromise = agentService
    .runAgent({
      question,
      collectionId,
      onEvent: (event) => {
        if (event.type === 'final_answer') return;
        push(event);
      },
    })
    .then(async (agentResult) => {
      if (agentResult.usedFallback || !agentResult.finalAnswer) {
        streamResult = {
          answer: FALLBACK_ANSWER,
          sources: [],
          usedFallback: true,
          confidence: 0,
          language: 'en',
        };
        push({ type: 'final' });
        streamDone = true;
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = null;
          r({ event: null, done: true });
        }
        return;
      }

      // Stream the final answer tokens via a synthetic Groq call using the
      // agent's accumulated evidence (or just re-issue the answer if non-streaming).
      const finalPrompt = `You are CampusMind. Based on the following research notes, write a final answer for the user's question. Be concise and accurate. Cite document titles when relevant.\n\nQuestion: ${question}\n\nNotes:\n${(agentResult.steps || []).map((s) => `- [${s.tool}] ${s.output_preview}`).join('\n')}\n\nAnswer:`;
      const { tokenGenerator } = createAnswerStream(
        'You are CampusMind, a helpful college assistant. Write the final answer using only the research notes provided. If the notes are insufficient, say you could not find the information.',
        finalPrompt
      );

      let fullText = '';
      for await (const token of tokenGenerator()) {
        fullText += token;
        push({ type: 'token', text: token });
      }

      streamResult = {
        answer: fullText || agentResult.finalAnswer,
        sources: agentResult.sources,
        usedFallback: false,
        confidence: agentResult.confidence,
        language: 'en',
      };
      push({ type: 'final' });
      streamDone = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ event: null, done: true });
      }
    })
    .catch((err) => {
      console.error('[RAG] Agentic pipeline error:', err);
      streamResult = {
        answer: FALLBACK_ANSWER,
        sources: [],
        usedFallback: true,
        confidence: 0,
        language: 'en',
      };
      push({ type: 'error', message: err.message });
      streamDone = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ event: null, done: true });
      }
    });

  async function* tokenGenerator() {
    while (true) {
      if (eventQueue.length > 0) {
        const { event } = eventQueue.shift();
        yield event;
        continue;
      }
      if (streamDone) return;
      const next = await new Promise((resolve) => {
        resolveNext = resolve;
      });
      if (next.done) return;
      yield next.event;
    }
  }

  const finalize = async () => {
    await agentPromise;
    return streamResult;
  };

  return {
    stream: { tokenGenerator, finalize },
    sources: [],
    confidence: 0,
    usedFallback: false,
    language: 'en',
  };
}
