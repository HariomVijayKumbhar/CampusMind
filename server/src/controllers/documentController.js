// Document Controller - request parsing and response shaping
// Async upload: validates file, creates DB record with status 'processing',
// saves temp file, enqueues background job, returns 202 Accepted immediately.

const documentService = require('../services/documentService');
const documentQueue = require('../services/documentQueue');
const documentIntelligenceService = require('../services/documentIntelligenceService');
const shareService = require('../services/shareService');
const annotationService = require('../services/annotationService');
const versionService = require('../services/versionService');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

async function uploadDocument(req, res) {
  try {
    const userId = req.userId;
    const file = req.file;
    const collectionId = req.body.collection_id || null;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // 1. Create document record with status 'processing'
    const document = await documentService.uploadDocument(file, userId, collectionId);

    // 2. Save file to temp disk for the background worker
    const tempPath = path.join(os.tmpdir(), `document-${document.id}.pdf`);
    await fs.writeFile(tempPath, file.buffer);

    // 3. Enqueue background processing job
    await documentQueue.enqueueDocument(document.id, tempPath, {
      originalName: file.originalname,
      mimetype: file.mimetype,
    });

    // 4. Return 202 — processing happens asynchronously
    res.status(202).json({
      success: true,
      document,
      message: 'Document uploaded. Processing in background.',
    });
  } catch (error) {
    console.error('Upload controller error:', error);
    res.status(400).json({ error: error.message || 'Failed to upload document' });
  }
}

async function deleteDocument(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!id) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    await documentService.deleteDocument(id, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete document' });
  }
}

async function listDocuments(req, res) {
  try {
    const collectionId = req.query.collection_id || null;
    const documents = await documentService.listDocuments(collectionId);

    res.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: error.message || 'Failed to list documents' });
  }
}

async function getDocument(req, res) {
  try {
    const { id } = req.params;
    const document = await documentService.getDocument(id);

    res.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(404).json({ error: error.message || 'Document not found' });
  }
}

async function getDocumentIntelligence(req, res) {
  try {
    const { id } = req.params;
    const intelligence = await documentIntelligenceService.getDocumentIntelligence(id);
    res.json({ success: true, ...intelligence });
  } catch (error) {
    console.error('Get document intelligence error:', error);
    res.status(500).json({ error: error.message || 'Failed to load intelligence' });
  }
}

// --- Phase 4: Collaboration -------------------------------------------------

async function createShare(req, res) {
  try {
    const { id } = req.params;
    const { role, expires_at, max_uses } = req.body || {};
    const result = await shareService.createShare({
      documentId: id,
      createdBy: req.userId,
      role,
      expiresAt: expires_at || null,
      maxUses: max_uses == null ? null : Number(max_uses),
    });
    if (result.error) return res.status(result.status || 500).json({ error: result.error });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ error: error.message || 'Failed to create share' });
  }
}

async function listShares(req, res) {
  try {
    const { id } = req.params;
    const shares = await shareService.listSharesForDocument(id);
    res.json({ success: true, shares });
  } catch (error) {
    console.error('List shares error:', error);
    res.status(500).json({ error: error.message || 'Failed to list shares' });
  }
}

async function resolveShare(req, res) {
  try {
    const { token } = req.params;
    const result = await shareService.resolveShare(token);
    if (result.error) return res.status(result.status || 500).json({ error: result.error });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Resolve share error:', error);
    res.status(500).json({ error: error.message || 'Failed to resolve share' });
  }
}

async function revokeShare(req, res) {
  try {
    const { shareId } = req.params;
    const result = await shareService.revokeShare(shareId);
    if (result.error) return res.status(result.status || 500).json({ error: result.error });
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke share error:', error);
    res.status(500).json({ error: error.message || 'Failed to revoke share' });
  }
}

async function createAnnotation(req, res) {
  try {
    const { id } = req.params;
    const { chunk_id, start_offset, end_offset, selected_text, comment, parent_annotation_id } = req.body || {};
    if (start_offset == null || end_offset == null) {
      return res.status(400).json({ error: 'start_offset and end_offset are required' });
    }
    const result = await annotationService.createAnnotation({
      userId: req.userId,
      documentId: id,
      chunkId: chunk_id || null,
      startOffset: Number(start_offset),
      endOffset: Number(end_offset),
      selectedText: selected_text,
      comment,
      parentAnnotationId: parent_annotation_id || null,
    });
    if (result.error) return res.status(result.status || 500).json({ error: result.error });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Create annotation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create annotation' });
  }
}

async function listAnnotations(req, res) {
  try {
    const { id } = req.params;
    const annotations = await annotationService.listAnnotations(id);
    res.json({ success: true, annotations });
  } catch (error) {
    console.error('List annotations error:', error);
    res.status(500).json({ error: error.message || 'Failed to list annotations' });
  }
}

async function resolveAnnotation(req, res) {
  try {
    const { annotationId } = req.params;
    const result = await annotationService.resolveAnnotation(req.userId, annotationId);
    if (result.error) return res.status(result.status || 500).json({ error: result.error });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Resolve annotation error:', error);
    res.status(500).json({ error: error.message || 'Failed to resolve annotation' });
  }
}

async function deleteAnnotation(req, res) {
  try {
    const { annotationId } = req.params;
    const result = await annotationService.deleteAnnotation(req.userId, annotationId);
    if (result.error) return res.status(result.status || 500).json({ error: result.error });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete annotation error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete annotation' });
  }
}

async function listVersions(req, res) {
  try {
    const { id } = req.params;
    const versions = await versionService.listVersions(id);
    res.json({ success: true, versions });
  } catch (error) {
    console.error('List versions error:', error);
    res.status(500).json({ error: error.message || 'Failed to list versions' });
  }
}

module.exports = {
  uploadDocument,
  deleteDocument,
  listDocuments,
  getDocument,
  getDocumentIntelligence,
  createShare,
  listShares,
  resolveShare,
  revokeShare,
  createAnnotation,
  listAnnotations,
  resolveAnnotation,
  deleteAnnotation,
  listVersions,
};
