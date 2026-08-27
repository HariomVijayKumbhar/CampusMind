const express = require('express');
const multer = require('multer');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { uploadDocument, deleteDocument, listDocuments } = require('../controllers/documentController');

const router = express.Router();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

// Configure multer for memory storage (Render & cloud hosts have ephemeral filesystem)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (PNG, JPG, JPEG, WEBP) are allowed.'));
    }
  },
});

// GET /api/documents - List documents
router.get('/', requireAuth, listDocuments);

// POST /api/documents - Upload document (PDF or Image with OCR)
router.post('/', requireAuth, requireAdmin, upload.single('file'), uploadDocument);

// DELETE /api/documents/:id - Delete document
router.delete('/:id', requireAuth, requireAdmin, deleteDocument);

module.exports = router;
