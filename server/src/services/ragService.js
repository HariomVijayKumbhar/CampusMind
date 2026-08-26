// RAG Service - similarity search, prompt assembly, LLM calls, fallback logic
// Updated with conversational memory and RecursiveCharacterTextSplitter usage

const supabase = require('../config/supabaseClient');
const embeddingService = require('./embeddingService');
const ragConfig = require('../config/rag');
const { Groq } = require('groq-sdk');
const RecursiveCharacterTextSplitter = require('../utils/textSplitter');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const textSplitter = new RecursiveCharacterTextSplitter();

function chunkText(text, chunkSize = ragConfig.chunkSize, chunkOverlap = ragConfig.chunkOverlap) {
  return textSplitter.splitText(text, chunkSize, chunkOverlap);
}

async function retrieveContext(questionText) {
  try {
    const questionEmbedding = await embeddingService.embedText(questionText);

    const { data: chunks, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: questionEmbedding,
      match_count: ragConfig.topK,
    });

    if (error) {
      throw new Error(`Similarity search failed: ${error.message}`);
    }

    const relevantChunks = chunks.filter(
      (chunk) => chunk.similarity >= ragConfig.similarityThreshold
    );

    return relevantChunks;
  } catch (error) {
    console.error('Retrieval error:', error);
    throw error;
  }
}

function assemblePrompt(question, chunks, conversationHistory = []) {
  const contextText = chunks
    .map((chunk, i) => `[Chunk ${i + 1}]\n${chunk.content}`)
    .join('\n\n');

  const systemPrompt = `You are a helpful college information assistant. Answer questions based ONLY on the provided document chunks and conversation history. If the answer is not in the documents or previous context, say "I don't have that information in the knowledge base."

Keep answers concise and directly answer the question. Do not make up information.`;

  const historyText = conversationHistory
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  const userPrompt = `Previous conversation:
${historyText}

Documents:
${contextText}

Question: ${question}

Answer:`;

  return { systemPrompt, userPrompt };
}

async function callGroq(systemPrompt, userPrompt) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      model: ragConfig.llmModel,
      max_tokens: ragConfig.llmMaxTokens,
      temperature: ragConfig.llmTemperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const answerText =
      chatCompletion.choices?.[0]?.message?.content?.trim() || '';

    return answerText;
  } catch (error) {
    console.error('Groq error:', error);
    throw new Error(`LLM error: ${error.message}`);
  }
}

function extractSources(chunks) {
  return chunks.map((chunk) => ({
    document_title: chunk.document_title,
    excerpt: chunk.content.substring(0, 200) + '...',
    similarity: chunk.similarity,
  }));
}

async function generateAnswer(question, userId, conversationHistory = []) {
  try {
    if (!question || typeof question !== 'string') {
      throw new Error('Question must be a non-empty string');
    }

    console.log(`[RAG] Processing question for user ${userId}: ${question.substring(0, 50)}...`);

    const relevantChunks = await retrieveContext(question);

    console.log(`[RAG] Retrieved ${relevantChunks.length} relevant chunks`);

    if (relevantChunks.length === 0) {
      console.log('[RAG] Fallback: No relevant context found');

      return {
        answer:
          "I couldn't find relevant information in the uploaded documents for your question. Please try rephrasing your question or upload documents related to what you're asking about.",
        sources: [],
        usedFallback: true,
      };
    }

    const { systemPrompt, userPrompt } = assemblePrompt(question, relevantChunks, conversationHistory);

    console.log('[RAG] Calling Groq LLM...');

    const answer = await callGroq(systemPrompt, userPrompt);

    const sources = extractSources(relevantChunks);

    console.log(`[RAG] Answer generated with ${sources.length} sources`);

    return {
      answer,
      sources,
      usedFallback: false,
    };
  } catch (error) {
    console.error('[RAG] Error in RAG pipeline:', error);
    throw error;
  }
}

module.exports = {
  generateAnswer,
  retrieveContext,
  assemblePrompt,
  callGroq,
  extractSources,
  chunkText,
};
