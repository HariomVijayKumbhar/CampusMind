// Auth Routes
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const authService = require('../services/authService');

const router = express.Router();

// GET /api/auth/profile - Get current user's profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await authService.getProfile(req.user || req.userId);

    // Merge the email from the verified auth user
    res.json({
      ...profile,
      email: req.user?.email || null,
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/auth/signup - Create a new user (admin-confirmed via service role)
router.post('/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.signup(email, password, fullName);
    res.json({ user: result.user, session: result.session });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message || 'Signup failed' });
  }
});

module.exports = router;
