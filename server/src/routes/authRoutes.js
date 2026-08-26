// Auth Routes
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const authService = require('../services/authService');

const router = express.Router();

// GET /api/auth/profile - Get current user's profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const profile = await authService.getProfile(userId);

    // Merge the email from the verified auth user (profiles table has no email column)
    res.json({ ...profile, email: req.user?.email || null });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
