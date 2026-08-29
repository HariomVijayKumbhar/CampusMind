// Study Service - quiz/flashcard generation and document summarization
// Uses the RAG retrieval pipeline for grounding + Groq for generation.

const { Groq } = require('groq-sdk');
const ragConfig = require('../config/rag');
const retrievalService = require('./retrievalService');

let groqInstance = null;
if (ragConfig.groqApiKey) {
  try {
    groqInstance = new Groq({ apiKey: ragConfig.groqApiKey });
  } catch (err) {
    console.warn('[Study] Groq initialization failed:', err.message);
  }
}

const SUMMARIZER_MODES = {
  eli5: 'Explain this content in very simple terms as if teaching a beginner. Use short sentences and analogies.',
  exam: 'Create concise exam revision notes from this content. Use headers, key definitions, formulas, and likely exam questions with answers.',
  bullets: 'Summarize this content as clear bullet points grouped by topic. Capture every key fact.',
};

function extractJson(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function generateFromContext(topic, userId, count, promptBuilder) {
  const chunks = await retrievalService.hybridRetrieve(topic, null);
  if (chunks.length === 0) {
    return {
      error: `No documents found related to "${topic}". Upload relevant documents first.`,
      status: 404,
    };
  }

  const context = chunks.slice(0, 8).map((c) => c.content).join('\n\n');
  const { systemPrompt, userPrompt } = promptBuilder(context, count);

  const completion = await groqInstance.chat.completions.create({
    model: ragConfig.groqModel,
    temperature: 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  return { raw: completion.choices?.[0]?.message?.content || '' };
}

async function generateQuiz(topic, userId, count = 5) {
  if (!groqInstance) throw new Error('Groq client is not configured.');

  const result = await generateFromContext(
    topic,
    userId,
    count,
    (context, n) => ({
      systemPrompt:
        'You are CampusMind, a college exam-prep assistant. Generate quiz questions strictly from the provided document content. Respond with ONLY a JSON array, no other text.',
      userPrompt: `Document content:\n${context}\n\nGenerate ${n} multiple-choice questions. Respond ONLY with a JSON array like:\n[{"question":"...","options":["A","B","C","D"],"answer_index":0,"explanation":"..."}]`,
    })
  );

  if (result.error || result.status) return result;

  const parsed = extractJson(result.raw);
  if (!parsed || !Array.isArray(parsed)) {
    return { error: 'Failed to generate a valid quiz. Please try again.', status: 502 };
  }

  return {
    quiz: parsed
      .filter((q) => q && q.question && Array.isArray(q.options) && q.options.length >= 2)
      .slice(0, count),
    grounded_in: chunksTitles(result.chunks || []),
  };
}

function chunksTitles(chunks) {
  return [...new Set(chunks.slice(0, 8).map((c) => c.document_title || 'Document'))];
}

async function generateFlashcards(topic, userId, count = 10) {
  if (!groqInstance) throw new Error('Groq client is not configured.');

  const result = await generateFromContext(
    topic,
    userId,
    count,
    (context, n) => ({
      systemPrompt:
        'You are CampusMind, a college study assistant. Generate flashcards strictly from the provided document content. Respond with ONLY a JSON array, no other text.',
      userPrompt: `Document content:\n${context}\n\nGenerate ${n} flashcards. Respond ONLY with a JSON array like:\n[{"front":"Question/term","back":"Answer/definition"}]`,
    })
  );

  if (result.error || result.status) return result;

  const parsed = extractJson(result.raw);
  if (!parsed || !Array.isArray(parsed)) {
    return { error: 'Failed to generate flashcards. Please try again.', status: 502 };
  }

  return {
    flashcards: parsed
      .filter((f) => f && f.front && f.back)
      .slice(0, count),
    grounded_in: chunksTitles(result.chunks || []),
  };
}

async function summarizeDocument(title, userId, mode = 'bullets') {
  if (!groqInstance) throw new Error('Groq client is not configured.');
  if (!SUMMARIZER_MODES[mode]) {
    return { error: `Invalid mode. Use one of: ${Object.keys(SUMMARIZER_MODES).join(', ')}`, status: 400 };
  }

  const chunks = await retrievalService.hybridRetrieve(title, null);
  if (chunks.length === 0) {
    return { error: `No documents found matching "${title}".`, status: 404 };
  }

  const context = chunks.slice(0, 10).map((c) => c.content).join('\n\n');
  const completion = await groqInstance.chat.completions.create({
    model: ragConfig.groqModel,
    temperature: 0.5,
    messages: [
      { role: 'system', content: `You are CampusMind. ${SUMMARIZER_MODES[mode]} Use only the provided content; do not invent facts.` },
      { role: 'user', content: `Document content:\n${context}\n\nSummary:` },
    ],
  });

  return {
    summary: completion.choices?.[0]?.message?.content || '',
    mode,
    grounded_in: chunksTitles(result.chunks || []),
  };
}

module.exports = {
  generateQuiz,
  generateFlashcards,
  summarizeDocument,
  SUMMARIZER_MODES,
};
