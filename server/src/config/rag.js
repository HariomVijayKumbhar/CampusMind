// RAG Pipeline Configuration
const env = require('./env');

module.exports = {
  // Chunking parameters
  chunkSize: 500, // tokens per chunk
  chunkOverlap: 50, // tokens overlap between chunks

  // Retrieval parameters
  topK: 5, // number of chunks to retrieve
  similarityThreshold: 0.3, // minimum cosine similarity to use retrieved context

  // Embedding model
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  embeddingDim: 384, // dimension of embeddings

  // AI Provider & LLM parameters
  aiProvider: env.aiProvider,
  openrouterModel: env.openrouter.model,
  openrouterApiKey: env.openrouter.apiKey,
  groqModel: env.groq.model,
  groqApiKey: env.groq.apiKey,
  llmTemperature: 0.7,
  llmMaxTokens: 1024,
};
