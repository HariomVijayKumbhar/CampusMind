const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { getUsageStats } = require('../services/analyticsService');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/usage', async (req, res) => {
  try {
    const stats = await getUsageStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to load analytics' });
  }
});

module.exports = router;
