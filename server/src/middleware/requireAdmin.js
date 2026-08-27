const authService = require('../services/authService');

/**
 * Middleware to verify user is admin
 * Must be called AFTER requireAuth
 */
async function requireAdmin(req, res, next) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const profile = await authService.getProfile(req.user || req.userId);

    if (!profile) {
      return res.status(403).json({ error: 'Forbidden: Profile not found' });
    }

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    req.userRole = profile.role;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = requireAdmin;
