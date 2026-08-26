const supabase = require('../config/supabaseClient');

/**
 * Middleware to verify user is admin
 * Must be called AFTER requireAuth
 */
async function requireAdmin(req, res, next) {
  try {
    // requireAuth must run first
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch user profile from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.userId)
      .single();

    if (error || !profile) {
      console.error('Failed to fetch profile:', error);
      return res.status(403).json({ error: 'Forbidden: Profile not found' });
    }

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Attach role to request
    req.userRole = profile.role;

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = requireAdmin;
