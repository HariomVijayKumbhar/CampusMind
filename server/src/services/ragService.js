// RAG Service - similarity search, prompt assembly, LLM calls (OpenRouter / Groq), fallback logic
// Supports OpenRouter and Groq as AI providers

const supabase = require('../config/supabaseClient');
const embeddingService = require('./embeddingService');
const ragConfig = require('../config/rag');
const { Groq } = require('groq-sdk');
const RecursiveCharacterTextSplitter = require('../utils/textSplitter');

let groqInstance = null;
if (ragConfig.groqApiKey) {
  try {
    groqInstance = new Groq({ apiKey: ragConfig.groqApiKey });
  } catch (err) {
    console.warn('[RAG] Groq initialization skipped or failed:', err.message);
  }
}

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

    const relevantChunks = (chunks || []).filter(
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
    .map((chunk, i) => `[Chunk ${i + 1} - ${chunk.document_title || 'Document'}]\n${chunk.content}`)
    .join('\n\n');

  const systemPrompt = `You are CampusMind, a helpful and knowledgeable college assistant. Answer the user's question accurately using ONLY the provided document chunks and conversation history.

Guidelines:
- If the answer is found in the context, provide a clear, concise, and structured answer.
- If the answer is NOT in the provided documents or context, say "I don't have that information in the college knowledge base."
- Do not invent facts, dates, or details.`;

  const historyText = conversationHistory
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  const userPrompt = `${historyText ? `Previous conversation:\n${historyText}\n\n` : ''}Knowledge Base Context:
${contextText}

Question: ${question}

Answer:`;

  return { systemPrompt, userPrompt };
}

async function callOpenRouter(systemPrompt, userPrompt) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ragConfig.openrouterApiKey}`,
        'HTTP-Referer': 'https://campusmind.local',
        'X-Title': 'CampusMind',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ragConfig.openrouterModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: ragConfig.llmTemperature,
        max_tokens: ragConfig.llmMaxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const answerText = data.choices?.[0]?.message?.content?.trim() || '';
    return answerText;
  } catch (error) {
    console.error('OpenRouter error:', error);
    throw new Error(`OpenRouter error: ${error.message}`);
  }
}

async function callGroq(systemPrompt, userPrompt) {
  try {
    if (!groqInstance) {
      throw new Error('Groq client is not configured.');
    }

    const chatCompletion = await groqInstance.chat.completions.create({
      model: ragConfig.groqModel,
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
    throw new Error(`Groq error: ${error.message}`);
  }
}

async function callLLM(systemPrompt, userPrompt) {
  if (ragConfig.aiProvider === 'openrouter' && ragConfig.openrouterApiKey) {
    console.log(`[RAG] Calling OpenRouter model: ${ragConfig.openrouterModel}`);
    return await callOpenRouter(systemPrompt, userPrompt);
  }

  if (ragConfig.groqApiKey) {
    console.log(`[RAG] Calling Groq model: ${ragConfig.groqModel}`);
    return await callGroq(systemPrompt, userPrompt);
  }

  throw new Error('No valid AI provider configured. Please check your OPENROUTER_API_KEY or GROQ_API_KEY.');
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
          "I couldn't find relevant information in the uploaded college documents for your question. Please try rephrasing your question or upload relevant documents to the knowledge base.",
        sources: [],
        usedFallback: true,
      };
    }

    const { systemPrompt, userPrompt } = assemblePrompt(question, relevantChunks, conversationHistory);

    const answer = await callLLM(systemPrompt, userPrompt);

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
  callOpenRouter,
  callGroq,
  callLLM,
  extractSources,
  chunkText,
};
