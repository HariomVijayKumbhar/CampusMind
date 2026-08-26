// RAG Pipeline Configuration
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

  // LLM parameters
  llmModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  llmTemperature: 0.7,
  llmMaxTokens: 1024,
};
