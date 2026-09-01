// One-off patch script: applies Batch A changes to ragService.js
const fs = require('fs');
const path = 'd:/CampusMind/server/src/services/ragService.js';
let c = fs.readFileSync(path, 'utf8');

function rep(from, to) {
  if (!c.includes(from)) {
    console.error('NOT FOUND:', JSON.stringify(from.slice(0, 60)));
    process.exitCode = 1;
    return;
  }
  c = c.replace(from, to);
}

rep(
  "const cacheService = require('./cacheService');",
  "const cacheService = require('./cacheService');\nconst queryRewriteService = require('./queryRewriteService');"
);

rep(
  'function assemblePrompt(question, chunks, conversationHistory = []) {',
  'function assemblePrompt(question, chunks, conversationHistory = [], options = {}) {'
);

rep(
  `  const contextText = chunks
    .map((chunk, i) => \`[Chunk \${i + 1} - \${chunk.document_title || 'Document'}]\n\${chunk.content}\`)
    .join('\n\n');

  const systemPrompt = \`You are CampusMind, a helpful and knowledgeable college assistant. Answer the user's question accurately using ONLY the provided document chunks and conversation history.

Guidelines:
- If the answer is found in the context, provide a clear, concise, and structured answer.
- If the answer is NOT in the provided documents or context, say "I don't have that information in the college knowledge base."
- Do not invent facts, dates, or details.\`;`,
  `  const { lengthMode = ragConfig.defaultLengthMode, language = 'en' } = options;
  const lengthModeConfig =
    ragConfig.lengthModes[lengthMode] || ragConfig.lengthModes[ragConfig.defaultLengthMode];

  const contextText = chunks
    .map((chunk, i) => \`[Chunk \${i + 1} - \${chunk.document_title || 'Document'}]\n\${chunk.content}\`)
    .join('\n\n');

  const systemPrompt = \`You are CampusMind, a helpful and knowledgeable college assistant. Answer the user's question accurately using ONLY the provided document chunks and conversation history.

Guidelines:
- If the answer is found in the context, provide a clear, concise, and structured answer.
- If the answer is NOT in the provided documents or context, say "I don't have that information in the college knowledge base."
- Do not invent facts, dates, or details.

Answer style (\${lengthModeConfig.label}): \${lengthModeConfig.instruction}
Language: \${ragConfig.languageInstruction(language)}\`;`
);

rep(
  `async function generateAnswerStream(question, userId, conversationHistory = [], collectionId = null) {
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }

  console.log(
    \`[RAG] Processing question for user \${userId}: \${question.substring(0, 50)}...\`
  );

  const candidates = await retrievalService.hybridRetrieve(question, collectionId);`,
  `async function generateAnswerStream(question, userId, conversationHistory = [], collectionId = null, options = {}) {
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }

  console.log(
    \`[RAG] Processing question for user \${userId}: \${question.substring(0, 50)}...\`
  );

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
      console.log(\`[RAG] Rewritten question: \${rewritten.substring(0, 80)}...\`);
    }
  } catch (err) {
    console.warn('[RAG] Query rewrite skipped:', err.message);
  }

  const candidates = await retrievalService.hybridRetrieve(rewritten, collectionId);`
);

rep(
  'const reranked = await rerankService.rerankChunks(question, candidates);',
  'const reranked = await rerankService.rerankChunks(rewritten, candidates);'
);

rep(
  `  const { systemPrompt, userPrompt } = assemblePrompt(question, topChunks, conversationHistory);

  const stream = createAnswerStream(systemPrompt, userPrompt);

  return {
    prompt: { systemPrompt, userPrompt },
    sources,
    confidence,
    usedFallback: false,
    stream,
  };
}`,
  `  const { systemPrompt, userPrompt } = assemblePrompt(question, topChunks, conversationHistory, {
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
}`
);

rep(
  `async function generateAnswer(question, userId, conversationHistory = [], collectionId = null) {
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
}`,
  `async function generateAnswer(question, userId, conversationHistory = [], collectionId = null, options = {}) {
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
}`
);

fs.writeFileSync(path, c);
console.log('ragService.js patched OK');
