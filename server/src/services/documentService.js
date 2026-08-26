// Document Service - PDF upload, extraction, chunking, embedding, storage
// Operates fully in memory to comply with ephemeral server environments

const pdfParse = require('pdf-parse');
const supabase = require('../config/supabaseClient');
const embeddingService = require('./embeddingService');
const ragConfig = require('../config/rag');
const RecursiveCharacterTextSplitter = require('../utils/textSplitter');

const textSplitter = new RecursiveCharacterTextSplitter();

/**
 * Extract text from PDF buffer
 */
async function extractPdfText(fileBuffer) {
  try {
    const data = await pdfParse(fileBuffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to extract PDF text: ${error.message}`);
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
 * Upload and process a PDF document synchronously in memory
 */
async function uploadDocument(file, userId) {
  if (!file || !file.buffer) {
    throw new Error('Invalid file');
  }

  if (file.mimetype !== 'application/pdf') {
    throw new Error('Only PDF files are allowed');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File size exceeds 10MB limit');
  }

  const pdfText = await extractPdfText(file.buffer);

  if (!pdfText || pdfText.trim().length === 0) {
    throw new Error('PDF contains no readable text');
  }

  const chunks = chunkText(pdfText);

  if (chunks.length === 0) {
    throw new Error('Failed to create chunks from PDF');
  }

  const { data: documentData, error: docError } = await supabase
    .from('documents')
    .insert({
      title: file.originalname,
      uploaded_by: userId,
      status: 'ready',
    })
    .select()
    .single();

  if (docError || !documentData) {
    throw new Error(`Failed to create document record: ${docError?.message}`);
  }

  try {
    const chunkCount = await generateAndStoreChunks(documentData.id, chunks);

    return {
      id: documentData.id,
      title: documentData.title,
      uploaded_by: documentData.uploaded_by,
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
      throw new Error('Document not found');
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
 * List all documents with chunk counts
 */
async function listDocuments() {
  try {
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, title, uploaded_by, status, created_at')
      .order('created_at', { ascending: false });

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
    chunkCounts.forEach((chunk) => {
      counts[chunk.document_id] = (counts[chunk.document_id] || 0) + 1;
    });

    const docsWithCounts = documents.map((doc) => ({
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
    throw new Error('Document not found');
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
