const express = require('express');
const multer = require('multer');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const {
  uploadDocument,
  deleteDocument,
  listDocuments,
  getDocument,
  getDocumentIntelligence,
  createShare,
  listShares,
  revokeShare,
  createAnnotation,
  listAnnotations,
  resolveAnnotation,
  deleteAnnotation,
  listVersions,
} = require('../controllers/documentController');

const router = express.Router();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

// Configure multer for memory storage (Render & cloud hosts have ephemeral filesystem)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB max
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, TXT and image files (PNG, JPG, JPEG, WEBP) are allowed.'));
    }
  },
});

// GET /api/documents - List documents
router.get('/', requireAuth, listDocuments);

// GET /api/documents/:id - Get a single document (used by polling/status checks)
router.get('/:id', requireAuth, getDocument);

// GET /api/documents/:id/intelligence - tables/metadata/key points
router.get('/:id/intelligence', requireAuth, getDocumentIntelligence);

// Phase 4: sharing, annotations, versions
router.post('/:id/share', requireAuth, requireAdmin, createShare);
router.get('/:id/shares', requireAuth, requireAdmin, listShares);
router.delete('/:id/shares/:shareId', requireAuth, requireAdmin, revokeShare);

router.get('/:id/annotations', requireAuth, listAnnotations);
router.post('/:id/annotations', requireAuth, createAnnotation);
router.patch('/:id/annotations/:annotationId/resolve', requireAuth, resolveAnnotation);
router.delete('/:id/annotations/:annotationId', requireAuth, deleteAnnotation);

router.get('/:id/versions', requireAuth, listVersions);

// POST /api/documents - Upload document (PDF or Image with OCR)
router.post('/', requireAuth, requireAdmin, upload.single('file'), uploadDocument);

// DELETE /api/documents/:id - Delete document
router.delete('/:id', requireAuth, requireAdmin, deleteDocument);

module.exports = router;
