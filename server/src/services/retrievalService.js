// Retrieval Service - hybrid search: semantic (pgvector) + keyword (tsvector),
// merged with Reciprocal Rank Fusion (RRF). Fusion is implemented here in JS,
// not in SQL, so it is easy to read, test, and tune from one place.

const supabase = require('../config/supabaseClient');
const embeddingService = require('./embeddingService');
const ragConfig = require('../config/rag');

/**
 * Reciprocal Rank Fusion: score = 1 / (rrfK + rank), summed across both lists.
 * Ranks are 1-based. Higher is better.
 */
function reciprocalRankFusion(resultLists, k = ragConfig.rrfK) {
  const scores = new Map();

  resultLists.forEach((results) => {
    results.forEach((result, idx) => {
      const rank = idx + 1;
      const current = scores.get(result.id) || {
        id: result.id,
        document_id: result.document_id,
        document_title: result.document_title,
        content: result.content,
        similarity: null,
        keywordRank: null,
        rrfScore: 0,
      };
      current.rrfScore += 1 / (k + rank);
      if (typeof result.similarity === 'number' && current.similarity === null) {
        current.similarity = result.similarity;
      }
      if (typeof result.rank === 'number') {
        current.keywordRank = result.rank;
      }
      scores.set(result.id, current);
    });
  });

  return Array.from(scores.values()).sort((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Fetch collection_id + document_id for each fused chunk id.
 * The RPC return tables don't include these columns, so a small join fills the gap.
 */
async function attachChunkMeta(ids) {
  if (!ids || ids.length === 0) return [];

  const { data, error } = await supabase.rpc('join_chunk_meta', {
    chunk_ids: ids,
  });

  if (error) {
    console.warn(`[Retrieval] join_chunk_meta failed: ${error.message}`);
    return [];
  }

  return data || [];
}

/**
 * Semantic search via pgvector (top semanticTopK).
 */
async function semanticSearch(questionEmbedding, collectionId = null) {
  try {
    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: questionEmbedding,
      match_count: ragConfig.semanticTopK,
      filter_collection: collectionId || null,
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    // Fallback: if the database hasn't been migrated to the 3-arg
    // match_document_chunks yet, retry without collection filtering
    // so the chat keeps working while migrations are applied.
    if (
      collectionId &&
      /match_document_chunks/i.test(error.message || '') &&
      /function .* does not exist|schema cache/i.test(error.message || '')
    ) {
      const { data, error: fallbackError } = await supabase.rpc(
        'match_document_chunks',
        {
          query_embedding: questionEmbedding,
          match_count: ragConfig.semanticTopK,
        }
      );

      if (fallbackError) throw fallbackError;

      return data || [];
    }

    throw error;
  }
}

/**
 * Keyword search via tsvector full-text (top keywordTopK).
 */
async function keywordSearch(question, collectionId = null) {
  const { data, error } = await supabase.rpc('keyword_search_chunks', {
    search_query: question,
    match_count: ragConfig.keywordTopK,
    filter_collection: collectionId || null,
  });

  if (error) {
    throw new Error(`Keyword search failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Hybrid retrieval pipeline: embed question -> semantic + keyword -> RRF -> top fused candidates.
 * Returns the top `fusionTopK` candidates with rrfScore, similarity, and meta attached.
 */
async function hybridRetrieve(question, collectionId = null) {
  const questionEmbedding = await embeddingService.embedText(question);

  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(questionEmbedding, collectionId),
    keywordSearch(question, collectionId),
  ]);

  const fused = reciprocalRankFusion([semanticResults, keywordResults]);
  const topCandidates = fused.slice(0, ragConfig.fusionTopK);

  const meta = await attachChunkMeta(topCandidates.map((c) => c.id));
  const metaById = new Map(meta.map((m) => [m.id, m]));

  return topCandidates.map((candidate) => ({
    ...candidate,
    document_id: metaById.get(candidate.id)?.document_id || candidate.document_id,
    collection_id: metaById.get(candidate.id)?.collection_id || null,
    document_title: metaById.get(candidate.id)?.document_title || candidate.document_title,
  }));
}

module.exports = {
  hybridRetrieve,
  reciprocalRankFusion,
  semanticSearch,
  keywordSearch,
  attachChunkMeta,
};
