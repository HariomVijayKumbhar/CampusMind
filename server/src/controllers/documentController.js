// Document Controller - request parsing and response shaping
const documentService = require('../services/documentService');

async function uploadDocument(req, res) {
  try {
    const userId = req.userId;
    const file = req.file;
    const collectionId = req.body.collection_id || null;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const document = await documentService.uploadDocument(file, userId, collectionId);

    res.status(201).json({
      success: true,
      document,
      message: 'Document uploaded and processed successfully.',
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

module.exports = {
  uploadDocument,
  deleteDocument,
  listDocuments,
  getDocument,
};
