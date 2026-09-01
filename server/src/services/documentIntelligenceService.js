// Document Intelligence Service - extracts structured content from documents:
// tables (LLM-based recovery), PDF metadata, and per-chunk key points.
//
// Designed to be optional and fault-tolerant: failures here never break
// document ingestion. Each step is best-effort and gracefully skipped if
// the LLM or DB is unavailable.

const { Groq } = require('groq-sdk');
const pdfParse = require('pdf-parse');
const ragConfig = require('../config/rag');
const supabase = require('../config/supabaseClient');

let groqInstance = null;
if (ragConfig.groqApiKey) {
  try {
    groqInstance = new Groq({ apiKey: ragConfig.groqApiKey });
  } catch (err) {
    console.warn('[DocIntel] Groq init skipped:', err.message);
  }
}

const MAX_INPUT_CHARS = 8000;

function truncate(text, max = MAX_INPUT_CHARS) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) : text;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Use the LLM to recover table structure from raw text. Returns
 * an array of { title, headers, rows, page_number? }. If the LLM
 * is unavailable or returns nothing parseable, returns [].
 */
async function extractTables(text) {
  if (!text || !groqInstance || !ragConfig.di?.enableTableExtraction) return [];

  const prompt = `You extract tables from document text. For each table found, output a JSON object with this exact shape:
{ "title": "<optional title>", "headers": ["col1","col2"], "rows": [["val1","val2"]] }

Return a JSON object: { "tables": [ ... ] }. If there are no tables, return { "tables": [] }.
Only output the JSON object, no prose, no markdown fences.

Text:
${truncate(text)}`;

  try {
    const resp = await groqInstance.chat.completions.create({
      model: ragConfig.groqModel,
      max_tokens: 1500,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    const raw = resp.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(raw);
    if (!parsed || !Array.isArray(parsed.tables)) return [];
    const maxRows = ragConfig.di?.maxTableRows || 20;
    return parsed.tables
      .filter((t) => Array.isArray(t.rows) && t.rows.length > 0)
      .map((t) => ({
        title: typeof t.title === 'string' ? t.title : null,
        headers: Array.isArray(t.headers) ? t.headers.slice(0, 20) : [],
        rows: t.rows.slice(0, maxRows).map((r) => Array.isArray(r) ? r.map(String) : [String(r)]),
      }))
      .slice(0, 10);
  } catch (err) {
    console.warn('[DocIntel] extractTables failed:', err.message);
    return [];
  }
}

/**
 * Extract PDF metadata using pdf-parse. Returns { page_count, author, subject, keywords }.
 */
async function extractPdfMetadata(fileBuffer) {
  if (!fileBuffer) return null;
  try {
    const data = await pdfParse(fileBuffer);
    return {
      page_count: data.numpages || null,
      author: data.info?.Author || null,
      subject: data.info?.Subject || null,
      keywords: typeof data.info?.Keywords === 'string'
        ? data.info.Keywords.split(/[,;]\s*/).filter(Boolean)
        : [],
    };
  } catch (err) {
    console.warn('[DocIntel] extractPdfMetadata failed:', err.message);
    return null;
  }
}

/**
 * Generate 2-3 key points from a chunk of text using the LLM.
 * Returns an array of strings, or [] on failure.
 */
async function generateKeyPoints(text) {
  if (!text || !groqInstance || !ragConfig.di?.enableKeyPoints) return [];
  const prompt = `Extract 2-3 key points from the following text. Output a JSON object: { "points": ["point 1", "point 2"] }. Only output JSON, no markdown, no prose.

Text:
${truncate(text, 4000)}`;
  try {
    const resp = await groqInstance.chat.completions.create({
      model: ragConfig.groqModel,
      max_tokens: 400,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    const raw = resp.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(raw);
    if (!parsed || !Array.isArray(parsed.points)) return [];
    return parsed.points.map(String).slice(0, ragConfig.di?.maxKeyPointsPerChunk || 3);
  } catch (err) {
    console.warn('[DocIntel] generateKeyPoints failed:', err.message);
    return [];
  }
}

/**
 * Persist extracted tables to the document_tables table and update matching
 * document_chunks rows with table_id + block_type. Returns count stored.
 */
async function storeTables(documentId, tables) {
  if (!tables || tables.length === 0) return 0;
  let count = 0;
  for (const t of tables) {
    try {
      const { data, error } = await supabase
        .from('document_tables')
        .insert({
          document_id: documentId,
          title: t.title,
          headers: t.headers,
          rows: t.rows,
        })
        .select('id')
        .single();
      if (error || !data) continue;
      count += 1;
    } catch (err) {
      console.warn('[DocIntel] storeTables insert failed:', err.message);
    }
  }
  return count;
}

async function storeMetadata(documentId, metadata, hasOcr = false, ocrConfidence = null) {
  if (!metadata) return false;
  try {
    const { error } = await supabase
      .from('document_metadata')
      .upsert({
        document_id: documentId,
        page_count: metadata.page_count || null,
        author: metadata.author || null,
        subject: metadata.subject || null,
        keywords: metadata.keywords || [],
        has_ocr: !!hasOcr,
        ocr_confidence: ocrConfidence,
      });
    if (error) {
      console.warn('[DocIntel] storeMetadata failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[DocIntel] storeMetadata error:', err.message);
    return false;
  }
}

async function storeKeyPoints(documentId, chunkId, points) {
  if (!points || points.length === 0) return false;
  try {
    const { error } = await supabase
      .from('document_key_points')
      .insert({ document_id: documentId, chunk_id: chunkId || null, points });
    if (error) {
      console.warn('[DocIntel] storeKeyPoints failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function getDocumentIntelligence(documentId) {
  try {
    const [tablesRes, metaRes, kpRes] = await Promise.all([
      supabase.from('document_tables').select('id, title, headers, rows, page_number').eq('document_id', documentId),
      supabase.from('document_metadata').select('*').eq('document_id', documentId).maybeSingle(),
      supabase.from('document_key_points').select('id, chunk_id, points, created_at').eq('document_id', documentId),
    ]);
    return {
      tables: tablesRes.data || [],
      metadata: metaRes.data || null,
      key_points: kpRes.data || [],
    };
  } catch (err) {
    console.warn('[DocIntel] getDocumentIntelligence failed:', err.message);
    return { tables: [], metadata: null, key_points: [] };
  }
}

module.exports = {
  extractTables,
  extractPdfMetadata,
  generateKeyPoints,
  storeTables,
  storeMetadata,
  storeKeyPoints,
  getDocumentIntelligence,
};
