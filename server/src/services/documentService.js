// Document Service - PDF/Image/DOCX/TXT upload, extraction, chunking, embedding, storage
// Async pipeline: uploadDocument creates a record; processDocument does the heavy work
// in a BullMQ background worker (queued via documentQueue.js).

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const supabase = require('../config/supabaseClient');
const embeddingService = require('./embeddingService');
const ocrService = require('./ocrService');
const ragConfig = require('../config/rag');
const documentIntelligenceService = require('./documentIntelligenceService');
const RecursiveCharacterTextSplitter = require('../utils/textSplitter');

const textSplitter = new RecursiveCharacterTextSplitter();

/**
 * Extract text from PDF buffer
 */
async function extractPdfText(fileBuffer) {
  try {
    const data = await pdfParse(fileBuffer);
    return data.text || '';
  } catch (error) {
    console.warn(`[DocumentService] PDF Parse warning: ${error.message}`);
    return '';
  }
}

/**
 * Extract text from DOCX buffer (paragraphs + tables)
 */
async function extractDocxText(fileBuffer) {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value || '';
  } catch (error) {
    console.warn('[DocumentService] DOCX extraction warning:', error.message);
    return '';
  }
}

/**
 * Split text into semantic chunks using recursive character splitting.
 * Preserves paragraph, sentence, and word boundaries.
 */
function chunkText(text, chunkSize, overlap) {
  return textSplitter.splitText(
    text,
    chunkSize || ragConfig.chunkSize,
    overlap || ragConfig.chunkOverlap
  );
}

/**
 * Generate embeddings for all chunks and store them in the database.
 */
async function generateAndStoreChunks(documentId, chunks) {
  const chunkRecords = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embeddingService.embedText(chunks[i]);
    chunkRecords.push({
      document_id: documentId,
      content: chunks[i],
      embedding: embedding,
      chunk_index: i,
    });
  }

  const { error: chunkError } = await supabase
    .from('document_chunks')
    .insert(chunkRecords);

  if (chunkError) {
    throw new Error(`Failed to store chunks: ${chunkError.message}`);
  }

  return chunkRecords.length;
}

/**
 * Update document status in the database.
 */
async function updateDocumentStatus(documentId, status) {
  const { error } = await supabase
    .from('documents')
    .update({ status })
    .eq('id', documentId);

  if (error) {
    console.warn(`[DocumentService] Failed to update document ${documentId} status to ${status}:`, error.message);
  }
}

/**
 * Extract text from an uploaded file based on its mime type.
 * Delegates to PDF, DOCX, OCR, or plain-text handlers.
 */
async function extractText(file, fileBuffer) {
  const isImage = file.mimetype.startsWith('image/');
  const isPdf = file.mimetype === 'application/pdf';
  const isDocx =
    file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.originalname.toLowerCase().endsWith('.docx');
  const isTxt =
    file.mimetype === 'text/plain' || file.originalname.toLowerCase().endsWith('.txt');

  if (!isImage && !isPdf && !isDocx && !isTxt) {
    throw new Error(
      'Supported file types: PDF, DOCX, TXT, PNG, JPG, JPEG, and WEBP.'
    );
  }

  let extractedText = '';

  if (isImage) {
    console.log(`[DocumentService] Processing image upload with OCR: ${file.originalname}`);
    extractedText = await ocrService.extractTextFromImage(fileBuffer);
  } else if (isDocx) {
    console.log(`[DocumentService] Extracting text from DOCX: ${file.originalname}`);
    extractedText = await extractDocxText(fileBuffer);
  } else if (isTxt) {
    console.log(`[DocumentService] Reading TXT: ${file.originalname}`);
    extractedText = fileBuffer.toString('utf-8');
  } else if (isPdf) {
    console.log(`[DocumentService] Extracting text from PDF: ${file.originalname}`);
    extractedText = await extractPdfText(fileBuffer);

    // If PDF text is empty or very small (scanned image PDF), run OCR fallback
    if (!extractedText || extractedText.trim().length < 20) {
      console.log('[DocumentService] PDF appears to be a scanned image. Running OCR extraction...');
      try {
        extractedText = await ocrService.extractTextFromImage(fileBuffer);
      } catch (ocrErr) {
        console.warn('[DocumentService] PDF OCR fallback warning:', ocrErr.message);
      }
    }
  }

  return extractedText;
}

/**
 * Validate an uploaded file payload.
 */
function validateFile(file) {
  if (!file || !file.buffer) {
    throw new Error('Invalid file payload.');
  }

  if (file.size > 30 * 1024 * 1024) {
    throw new Error('File size exceeds 30MB limit.');
  }
}

/**
 * Create the initial document record in Supabase with status 'processing'.
 * Returns the created document object. The actual extraction/chunking/embedding
 * happens asynchronously in a background worker (processDocument).
 */
async function uploadDocument(file, userId, collectionId = null) {
  validateFile(file);

  const { data: documentData, error: docError } = await supabase
    .from('documents')
    .insert({
      title: file.originalname,
      uploaded_by: userId,
      collection_id: collectionId,
      status: 'processing',
    })
    .select()
    .single();

  if (docError || !documentData) {
    throw new Error(`Failed to create document record: ${docError?.message}`);
  }

  console.log(`[DocumentService] Created document record: ${documentData.id} (status: processing)`);

  return {
    id: documentData.id,
    title: documentData.title,
    uploaded_by: documentData.uploaded_by,
    collection_id: documentData.collection_id,
    created_at: documentData.created_at,
    status: 'processing',
    chunk_count: 0,
  };
}

/**
 * Background processing function — extracts text, chunks, generates embeddings,
 * and stores chunks for a previously created document record.
 * Called by the BullMQ worker in documentQueue.js.
 */
async function processDocument(documentId, file, fileBuffer) {
  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `document-${documentId}.pdf`);

  try {
    await updateDocumentStatus(documentId, 'processing');

    validateFile(file);

    let extractedText = await extractText(file, fileBuffer);

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error(
        'Could not extract readable text from the uploaded document or image.'
      );
    }

    const chunks = chunkText(extractedText);

    if (chunks.length === 0) {
      throw new Error('Failed to create text chunks from extracted content.');
    }

    const chunkCount = await generateAndStoreChunks(documentId, chunks);

    // Phase 2: Document Intelligence — best-effort, never blocks ingestion.
    await runDocumentIntelligence(documentId, extractedText, file, fileBuffer, chunks);

    await updateDocumentStatus(documentId, 'ready');

    console.log(
      `✓ [DocumentService] Successfully indexed document ${documentId}: ` +
      `${chunkCount} chunks, ${extractedText.length} characters.`
    );

    return { documentId, chunkCount };
  } catch (error) {
    console.error(`[DocumentService] Processing failed for document ${documentId}:`, error);
    await updateDocumentStatus(documentId, 'failed');
    throw error;
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

/**
 * Delete a document and cascade to its chunks
 */
async function deleteDocument(documentId, userId) {
  try {
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, uploaded_by')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      throw new Error('Document not found.');
    }

    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      throw new Error(`Failed to delete document: ${deleteError.message}`);
    }

    console.log(`✓ Document deleted: ${documentId}`);

    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    throw error;
  }
}

/**
 * List all documents with chunk counts (optionally filtered by collection)
 */
async function listDocuments(collectionId = null) {
  try {
    let query = supabase
      .from('documents')
      .select('id, title, uploaded_by, collection_id, status, created_at')
      .order('created_at', { ascending: false });

    if (collectionId) {
      query = query.eq('collection_id', collectionId);
    }

    const { data: documents, error: docsError } = await query;

    if (docsError) {
      throw new Error(`Failed to list documents: ${docsError.message}`);
    }

  const { data: chunkCounts, error: countsError } = await supabase
    .from('document_chunks')
    .select('document_id, id');

  if (countsError) {
    throw new Error(`Failed to get chunk counts: ${countsError.message}`);
  }

  const counts = {};
  (chunkCounts || []).forEach((chunk) => {
    counts[chunk.document_id] = (counts[chunk.document_id] || 0) + 1;
  });

  // Phase 2: pull light metadata (table count + page count) for the admin list.
  const docIds = (documents || []).map((d) => d.id);
  const intelligenceByDoc = {};
  if (docIds.length > 0) {
    try {
      const [tablesRes, metaRes] = await Promise.all([
        supabase.from('document_tables').select('document_id, id').in('document_id', docIds),
        supabase.from('document_metadata').select('document_id, page_count, has_ocr').in('document_id', docIds),
      ]);
      (tablesRes.data || []).forEach((t) => {
        intelligenceByDoc[t.document_id] = intelligenceByDoc[t.document_id] || {};
        intelligenceByDoc[t.document_id].table_count =
          (intelligenceByDoc[t.document_id].table_count || 0) + 1;
      });
      (metaRes.data || []).forEach((m) => {
        intelligenceByDoc[m.document_id] = {
          ...(intelligenceByDoc[m.document_id] || {}),
          page_count: m.page_count,
          has_ocr: m.has_ocr,
        };
      });
    } catch (err) {
      console.warn('[DocumentService] intelligence lookup skipped:', err.message);
    }
  }

  const docsWithCounts = (documents || []).map((doc) => ({
    ...doc,
    chunk_count: counts[doc.id] || 0,
    table_count: intelligenceByDoc[doc.id]?.table_count || 0,
    page_count: intelligenceByDoc[doc.id]?.page_count || null,
    has_ocr: intelligenceByDoc[doc.id]?.has_ocr || false,
  }));

  return docsWithCounts;
  } catch (error) {
    console.error('List error:', error);
    throw error;
  }
}

/**
 * Get a single document by ID
 */
async function getDocument(documentId) {
  const { data: document, error } = await supabase
    .from('documents')
    .select('id, title, uploaded_by, collection_id, status, created_at')
    .eq('id', documentId)
    .single();

  if (error || !document) {
    throw new Error('Document not found.');
  }

  const { data: chunks, error: chunksError } = await supabase
    .from('document_chunks')
    .select('id')
    .eq('document_id', documentId);

  const chunkCount = chunks ? chunks.length : 0;

  return {
    ...document,
    chunk_count: chunkCount,
  };
}

async function runDocumentIntelligence(documentId, extractedText, file, fileBuffer, chunks) {
  if (!ragConfig.di) return;
  try {
    const isPdf = file.mimetype === 'application/pdf';
    const isImage = file.mimetype?.startsWith?.('image/');

    if (ragConfig.di.enableMetadataExtraction && isPdf) {
      const metadata = await documentIntelligenceService.extractPdfMetadata(fileBuffer);
      await documentIntelligenceService.storeMetadata(documentId, metadata, isImage);
    }

    if (ragConfig.di.enableTableExtraction && extractedText && extractedText.length > 200) {
      const tables = await documentIntelligenceService.extractTables(extractedText);
      if (tables.length > 0) {
        await documentIntelligenceService.storeTables(documentId, tables);
      }
    }

    if (ragConfig.di.enableKeyPoints && Array.isArray(chunks)) {
      // Generate key points for the first ~3 chunks only to keep cost down.
      const sample = chunks.slice(0, 3);
      for (const chunk of sample) {
        if (!chunk || chunk.length < 200) continue;
        const points = await documentIntelligenceService.generateKeyPoints(chunk);
        if (points.length > 0) {
          await documentIntelligenceService.storeKeyPoints(documentId, null, points);
        }
      }
    }
  } catch (err) {
    console.warn(`[DocumentService] intelligence step failed for ${documentId}:`, err.message);
  }
}

module.exports = {
  uploadDocument,
  processDocument,
  deleteDocument,
  listDocuments,
  getDocument,
  updateDocumentStatus,
  extractPdfText,
  extractDocxText,
  chunkText,
  validateFile,
};
