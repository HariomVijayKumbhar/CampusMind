// Embedding Service - wraps @xenova/transformers
// Uses Xenova/all-MiniLM-L6-v2 for 384-dim embeddings

const { pipeline } = require('@xenova/transformers');
const ragConfig = require('../config/rag');

let embeddingPipeline = null;

// Initialize embedding pipeline (lazy load)
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('Loading embedding model...');
    embeddingPipeline = await pipeline(
      'feature-extraction',
      `Xenova/${ragConfig.embeddingModel.split('/')[1]}`
    );
    console.log('Embedding model loaded');
  }
  return embeddingPipeline;
}

/**
 * Generate embeddings for a text string
 * Returns a 384-dimensional vector
 */
async function embedText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  try {
    const pipeline = await getEmbeddingPipeline();
    
    // Generate embeddings
    const result = await pipeline(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to array
    const embedding = Array.from(result.data);

    if (embedding.length !== ragConfig.embeddingDim) {
      throw new Error(
        `Expected ${ragConfig.embeddingDim}-dim embedding, got ${embedding.length}`
      );
    }

    return embedding;
  } catch (error) {
    console.error('Embedding error:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

module.exports = {
  embedText,
};
