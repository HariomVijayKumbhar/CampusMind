const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { resolveShare } = require('../controllers/documentController');

const router = express.Router();

// GET /api/shares/:token - resolve a share token to a document
router.get('/:token', requireAuth, resolveShare);

module.exports = router;
