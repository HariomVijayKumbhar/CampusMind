// Document Service - PDF and Image (PNG/JPG/JPEG/WEBP) upload, OCR extraction, chunking, embedding, storage
// Operates fully in memory for ephemeral cloud deployments

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const supabase = require('../config/supabaseClient');
const embeddingService = require('./embeddingService');
const ocrService = require('./ocrService');
const ragConfig = require('../config/rag');
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
    console.warn(`[PDF Parse] Standard extraction warning: ${error.message}`);
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
    console.warn('[DOCX Parse] Extraction warning: ' + error.message);
    return '';
  }
}

/**
 * Split text into semantic chunks using recursive character splitting
 */
function chunkText(text, chunkSize = ragConfig.chunkSize, overlap = ragConfig.chunkOverlap) {
  return textSplitter.splitText(text, chunkSize, overlap);
}

/**
 * Generate embeddings for all chunks and store them in the database
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
    await supabase.from('documents').delete().eq('id', documentId);
    throw new Error(`Failed to store chunks: ${chunkError.message}`);
  }

  return chunkRecords.length;
}

/**
 * Update document status in the database
 */
async function updateDocumentStatus(documentId, status) {
  const { error } = await supabase
    .from('documents')
    .update({ status })
    .eq('id', documentId);

  if (error) {
    console.warn(`Failed to update document ${documentId} status to ${status}:`, error.message);
  }
}

/**
 * Upload and process a PDF or Image (PNG/JPG/JPEG/WEBP) synchronously in memory
 */
async function uploadDocument(file, userId, collectionId = null) {
  if (!file || !file.buffer) {
    throw new Error('Invalid file payload.');
  }

  const isImage = file.mimetype.startsWith('image/');
  const isPdf = file.mimetype === 'application/pdf';
  const isDocx =
    file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.originalname.toLowerCase().endsWith('.docx');
  const isTxt =
    file.mimetype === 'text/plain' || file.originalname.toLowerCase().endsWith('.txt');

  if (!isImage && !isPdf && !isDocx && !isTxt) {
    throw new Error('Supported file types: PDF, DOCX, TXT, PNG, JPG, JPEG, and WEBP.');
  }

  if (file.size > 30 * 1024 * 1024) {
    throw new Error('File size exceeds 30MB limit.');
  }

  let extractedText = '';

  if (isImage) {
    console.log(`[DocumentService] Processing image upload with OCR: ${file.originalname}`);
    extractedText = await ocrService.extractTextFromImage(file.buffer);
  } else if (isDocx) {
    console.log(`[DocumentService] Extracting text from DOCX: ${file.originalname}`);
    extractedText = await extractDocxText(file.buffer);
  } else if (isTxt) {
    console.log(`[DocumentService] Reading TXT: ${file.originalname}`);
    extractedText = file.buffer.toString('utf-8');
  } else if (isPdf) {
    console.log(`[DocumentService] Extracting text from PDF: ${file.originalname}`);
    extractedText = await extractPdfText(file.buffer);

    // If PDF text is empty or very small (e.g. scanned image PDF), run OCR fallback
    if (!extractedText || extractedText.trim().length < 20) {
      console.log(`[DocumentService] PDF appears to be a scanned image. Running OCR extraction...`);
      try {
        extractedText = await ocrService.extractTextFromImage(file.buffer);
      } catch (ocrErr) {
        console.warn(`[DocumentService] PDF OCR fallback warning: ${ocrErr.message}`);
      }
    }
  }

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error(
      'Could not extract readable text from the uploaded document or image. Please ensure the image is clear.'
    );
  }

  const chunks = chunkText(extractedText);

  if (chunks.length === 0) {
    throw new Error('Failed to create text chunks from the extracted content.');
  }

  const { data: documentData, error: docError } = await supabase
    .from('documents')
    .insert({
      title: file.originalname,
      uploaded_by: userId,
      collection_id: collectionId,
      status: 'ready',
    })
    .select()
    .single();

  if (docError || !documentData) {
    throw new Error(`Failed to create document record: ${docError?.message}`);
  }

  try {
    const chunkCount = await generateAndStoreChunks(documentData.id, chunks);

    console.log(
      `✓ Successfully indexed ${file.originalname}: ${chunkCount} chunks, ${extractedText.length} characters.`
    );

    return {
      id: documentData.id,
      title: documentData.title,
      uploaded_by: documentData.uploaded_by,
      collection_id: documentData.collection_id,
      created_at: documentData.created_at,
      status: 'ready',
      chunk_count: chunkCount,
    };
  } catch (error) {
    await supabase.from('documents').delete().eq('id', documentData.id);
    throw error;
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

    const docsWithCounts = (documents || []).map((doc) => ({
      ...doc,
      chunk_count: counts[doc.id] || 0,
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
    .select('id, title, uploaded_by, status, created_at')
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

module.exports = {
  uploadDocument,
  deleteDocument,
  listDocuments,
  getDocument,
  updateDocumentStatus,
};
