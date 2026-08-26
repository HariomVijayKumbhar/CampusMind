const express = require('express');
const multer = require('multer');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { uploadDocument, deleteDocument, listDocuments } = require('../controllers/documentController');

const router = express.Router();

// Configure multer for memory storage (Render has ephemeral filesystem)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed'));
    }
  },
});

// GET /api/documents - List documents
router.get('/', requireAuth, listDocuments);

// POST /api/documents - Upload document (admin only)
router.post('/', requireAuth, requireAdmin, upload.single('file'), uploadDocument);

// DELETE /api/documents/:id - Delete document (admin only)
router.delete('/:id', requireAuth, requireAdmin, deleteDocument);

module.exports = router;
