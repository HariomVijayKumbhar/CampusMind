// RAG Pipeline Configuration
// All tunable constants for chunking, retrieval, re-ranking, and fallback live here.
// Never hardcode these values inline across services.
const env = require('./env');

module.exports = {
  // Chunking parameters
  chunkSize: 500, // tokens per chunk
  chunkOverlap: 50, // tokens overlap between chunks

  // Retrieval parameters
  semanticTopK: 15, // candidates from pgvector cosine search
  keywordTopK: 15, // candidates from Postgres tsvector full-text search
  fusionTopK: 10, // merged candidates after Reciprocal Rank Fusion
  rerankTopK: 5, // final context chunks after LLM re-ranking
  fallbackRelevanceThreshold: 5.0, // minimum best re-rank score (0-10) to answer; below this -> "I couldn't find relevant information..."

  // RRF fusion constant: score = 1 / (rrfK + rank)
  rrfK: 60,

  // Question embedding cache: identical/near-identical questions within this
  // window reuse the cached embedding (node-cache, no Redis required).
  questionCacheTtlSeconds: 3600,

  // Re-ranking prompt: model is asked to score each chunk's relevance from 0-10
  rerankScoreRange: [0, 10], // inclusive, validated when parsing model output

  // Embedding model
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  embeddingDim: 384, // dimension of embeddings

  // LLM (Groq)
  groqModel: env.groq.model, // default 'qwen/qwen3.8-27b' (see config/env.js)
  groqApiKey: env.groq.apiKey,
  llmTemperature: 0.7,
  llmMaxTokens: 1024,

    // Answer length modes (Section 16): prompt-only instruction changes.
  lengthModes: {
    concise: {
      label: 'Concise',
      instruction: 'Answer in 2-3 short sentences. Be direct and to the point.',
    },
    detailed: {
      label: 'Detailed',
      instruction:
        'Answer thoroughly, including relevant caveats, steps, and any important exceptions found in the context. Use short paragraphs or bullet points where helpful.',
    },
  },
  defaultLengthMode: 'concise',

  // Multilingual answering (Section 13): instruction template for the target language.
  languageInstruction: (langCode) =>
    langCode && langCode !== 'en'
      ? `Respond in the language with ISO 639-1 code "${langCode}". Write the entire answer in that language, but keep proper nouns, course names, and document titles as they appear in the context.`
      : 'Respond in English.',
};
