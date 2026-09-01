// Agent Service - orchestrates a multi-step agentic RAG loop using Groq function
// calling. The LLM plans sub-questions, requests tools (search, compare, etc.),
// and iterates before producing a final answer.
//
// Tools (mapped to existing services):
//   - search_chunks(question)  -> retrievalService.hybridRetrieve
//   - summarize_sources(text)  -> Groq call to compress retrieved content
//   - compare_docs(topics[])   -> multi-query retrieval + LLM compare
//
// State machine:
//   observe -> think -> tool_call -> observe -> ... -> final_answer
//
// Token usage and step log are persisted to `agent_runs` for audit.

const { Groq } = require('groq-sdk');
const ragConfig = require('../config/rag');
const retrievalService = require('./retrievalService');
const supabase = require('../config/supabaseClient');

let groqInstance = null;
if (ragConfig.groqApiKey) {
  try {
    groqInstance = new Groq({ apiKey: ragConfig.groqApiKey });
  } catch (err) {
    console.warn('[Agent] Groq init skipped:', err.message);
  }
}

const AGENT_MODEL = ragConfig.groqModel;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_chunks',
      description:
        'Search the knowledge base for chunks relevant to the given question. Use this when you need more information before answering.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'A focused sub-question to search for.' },
          collection_id: {
            type: 'string',
            description: 'Optional collection UUID to scope the search.',
            nullable: true,
          },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_sources',
      description:
        'Condense a body of retrieved text into a short paragraph of bullet points. Use this to keep your context window manageable.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text to summarize.' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_docs',
      description:
        'Run two focused sub-questions and return both result sets side by side for comparison.',
      parameters: {
        type: 'object',
        properties: {
          query_a: { type: 'string', description: 'First comparison query.' },
          query_b: { type: 'string', description: 'Second comparison query.' },
          collection_id: { type: 'string', nullable: true },
        },
        required: ['query_a', 'query_b'],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are CampusMind Agent, a college assistant that solves complex questions by planning, searching the knowledge base, observing results, and iterating before answering.

Workflow:
1. Plan: identify what you know and what you still need to find.
2. Call tools (search_chunks, summarize_sources, compare_docs) until you have enough information.
3. When ready, write a final answer as plain text (no tool calls).

Rules:
- Use tools when context is missing or when the question has multiple parts.
- After at most 5 tool calls, stop and produce the final answer.
- Never invent facts. Cite which document title your answer came from when possible.`;

const FALLBACK_ANSWER =
  "I couldn't find relevant information in the uploaded college documents for your question. Please try rephrasing your question or check back later.";

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function executeToolCall(toolCall, collectionId) {
  const name = toolCall.function?.name;
  const args = safeJsonParse(toolCall.function?.arguments || '{}') || {};
  const start = Date.now();

  try {
    if (name === 'search_chunks') {
      const question = (args.question || '').trim();
      if (!question) {
        return { tool: name, error: 'Missing question', result_count: 0 };
      }
      const results = await retrievalService.hybridRetrieve(question, collectionId);
      const top = results.slice(0, ragConfig.rerankTopK);
      return {
        tool: name,
        input: args,
        result_count: top.length,
        results: top.map((r) => ({
          id: r.id,
          document_title: r.document_title,
          content: (r.content || '').slice(0, 800),
        })),
        duration_ms: Date.now() - start,
      };
    }

    if (name === 'summarize_sources') {
      const text = (args.text || '').trim();
      if (!text || !groqInstance) {
        return { tool: name, summary: text ? text.slice(0, 400) : '' };
      }
      const resp = await groqInstance.chat.completions.create({
        model: AGENT_MODEL,
        max_tokens: 400,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You compress retrieved document passages into 3-5 concise bullet points. Output bullets only, prefixed with "- ".',
          },
          { role: 'user', content: text.slice(0, 6000) },
        ],
      });
      const summary = resp.choices?.[0]?.message?.content || '';
      return {
        tool: name,
        input: args,
        summary,
        duration_ms: Date.now() - start,
      };
    }

    if (name === 'compare_docs') {
      const [a, b] = await Promise.all([
        retrievalService.hybridRetrieve(args.query_a || '', collectionId),
        retrievalService.hybridRetrieve(args.query_b || '', collectionId),
      ]);
      return {
        tool: name,
        input: args,
        result_count: (a.length || 0) + (b.length || 0),
        results: {
          query_a: { question: args.query_a, items: a.slice(0, 3).map((r) => ({ document_title: r.document_title, content: (r.content || '').slice(0, 500) })) },
          query_b: { question: args.query_b, items: b.slice(0, 3).map((r) => ({ document_title: r.document_title, content: (r.content || '').slice(0, 500) })) },
        },
        duration_ms: Date.now() - start,
      };
    }

    return { tool: name, error: `Unknown tool: ${name}` };
  } catch (err) {
    console.warn(`[Agent] tool ${name} failed:`, err.message);
    return { tool: name, error: err.message };
  }
}

function aggregateSourcesFromSteps(steps) {
  const seen = new Set();
  const sources = [];
  for (const step of steps) {
    if (step.tool !== 'search_chunks' && step.tool !== 'compare_docs') continue;
    const items = step.tool === 'compare_docs'
      ? [...(step.results?.query_a?.items || []), ...(step.results?.query_b?.items || [])]
      : step.results || [];
    for (const item of items) {
      if (!item || seen.has(item.id)) continue;
      if (!item.id) continue;
      seen.add(item.id);
      sources.push({
        document_title: item.document_title || 'Campus Document',
        excerpt: (item.content || '').slice(0, 1500),
        highlighted_span: {
          text: (item.content || '').slice(0, 240),
          start: 0,
          end: Math.min(240, (item.content || '').length),
        },
        confidence: null,
        similarity: null,
      });
    }
  }
  return sources;
}

/**
 * Run the agentic loop. Returns:
 *   { steps, sources, finalAnswer, confidence, usedFallback, status }
 *
 * Caller is responsible for persisting the run to `agent_runs` (passing userId/conversationId).
 */
async function runAgent({ question, collectionId, onEvent = () => {} }) {
  const maxSteps = (ragConfig.agentic && ragConfig.agentic.maxSteps) || 7;
  const steps = [];
  const tokenUsage = { prompt: 0, completion: 0, total: 0 };

  if (!groqInstance) {
    return {
      steps: [],
      sources: [],
      finalAnswer: 'Agent mode is unavailable: Groq client not configured.',
      confidence: 0,
      usedFallback: true,
      status: 'failed',
    };
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question },
  ];

  let finalAnswer = '';
  let sources = [];
  let status = 'completed';

  for (let step = 0; step < maxSteps; step += 1) {
    onEvent({ type: 'thought', step, content: `Step ${step + 1}: thinking…` });

    let response;
    try {
      response = await groqInstance.chat.completions.create({
        model: AGENT_MODEL,
        max_tokens: ragConfig.llmMaxTokens,
        temperature: ragConfig.llmTemperature,
        tools: TOOLS,
        tool_choice: 'auto',
        messages,
      });
    } catch (err) {
      console.error('[Agent] LLM call failed:', err.message);
      status = 'failed';
      finalAnswer = `Agent stopped due to LLM error: ${err.message}`;
      break;
    }

    const usage = response.usage || {};
    tokenUsage.prompt += usage.prompt_tokens || 0;
    tokenUsage.completion += usage.completion_tokens || 0;
    tokenUsage.total += usage.total_tokens || 0;

    const choice = response.choices?.[0];
    const msg = choice?.message;
    if (!msg) {
      status = 'failed';
      finalAnswer = 'Agent received an empty response from the model.';
      break;
    }

    // Append assistant message to history (so the model sees its own tool calls).
    messages.push({
      role: 'assistant',
      content: msg.content || '',
      tool_calls: msg.tool_calls || undefined,
    });

    if (msg.content && (!msg.tool_calls || msg.tool_calls.length === 0)) {
      finalAnswer = msg.content;
      break;
    }

    const toolCalls = msg.tool_calls || [];
    if (toolCalls.length === 0) {
      finalAnswer = msg.content || FALLBACK_ANSWER;
      break;
    }

    for (const toolCall of toolCalls) {
      onEvent({ type: 'tool_call', step, tool: toolCall.function?.name, arguments: safeJsonParse(toolCall.function?.arguments || '{}') });
      const observation = await executeToolCall(toolCall, collectionId);
      const preview = observation.summary
        ? observation.summary.slice(0, 160)
        : observation.results
          ? `${observation.result_count} items`
          : observation.error || '';
      steps.push({
        type: 'tool_call',
        tool: observation.tool,
        input: observation.input,
        output_preview: preview,
        result_count: observation.result_count,
        duration_ms: observation.duration_ms,
      });
      onEvent({ type: 'observation', step, tool: observation.tool, preview, result_count: observation.result_count });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function?.name,
        // Send a compact JSON payload back to the LLM to keep the loop fast.
        content: JSON.stringify(observation).slice(0, 4000),
      });
    }
  }

  if (!finalAnswer) {
    finalAnswer = status === 'failed'
      ? 'The agent could not complete this request.'
      : FALLBACK_ANSWER;
    status = status === 'completed' ? 'completed' : status;
  }

  sources = aggregateSourcesFromSteps(steps);
  onEvent({ type: 'final_answer', step: steps.length, content: finalAnswer });

  return {
    steps,
    sources,
    finalAnswer,
    confidence: sources.length > 0 ? 0.5 : 0,
    usedFallback: sources.length === 0,
    status,
    tokenUsage,
  };
}

async function persistAgentRun({ userId, conversationId, question, steps, finalAnswer, status, tokenUsage }) {
  try {
    const { data, error } = await supabase
      .from('agent_runs')
      .insert({
        user_id: userId,
        conversation_id: conversationId || null,
        question,
        steps,
        final_answer: finalAnswer,
        status: status || 'completed',
        token_usage: tokenUsage || {},
      })
      .select('id')
      .single();
    if (error) {
      console.warn('[Agent] persist failed:', error.message);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.warn('[Agent] persist error:', err.message);
    return null;
  }
}

module.exports = {
  runAgent,
  persistAgentRun,
  TOOLS,
  SYSTEM_PROMPT,
};
