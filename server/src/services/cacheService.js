// Cache Service - node-cache wrapper for repeated-question caching.
// Caches the embedding of a normalized question so identical/near-identical
// questions within the TTL window skip redundant embedding computation.

const NodeCache = require('node-cache');
const ragConfig = require('../config/rag');

// Cache keyed by normalized question text
const questionCache = new NodeCache({
  stdTTL: ragConfig.questionCacheTtlSeconds,
  checkperiod: 60,
});

/**
 * Normalize a question for cache-key matching: lowercase, collapse whitespace,
 * strip trailing punctuation.
 */
function normalizeQuestion(question) {
  return String(question || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .trim();
}

/**
 * Get a cached embedding for a normalized question, or null.
 */
function getCachedEmbedding(question) {
  return questionCache.get(normalizeQuestion(question)) || null;
}

/**
 * Store the embedding for a normalized question.
 */
function setCachedEmbedding(question, embedding) {
  questionCache.set(normalizeQuestion(question), embedding);
}

/**
 * Clear the whole cache (used by tests / admin tooling).
 */
function clearCache() {
  questionCache.flushAll();
}

module.exports = {
  getCachedEmbedding,
  setCachedEmbedding,
  clearCache,
  normalizeQuestion,
};
