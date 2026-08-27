const supabase = require('../config/supabaseClient');

/**
 * Middleware to verify Supabase JWT token and attach user to request
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.substring(7).trim();

    if (!token || token.length < 10) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token format' });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    req.user = data.user;
    req.userId = data.user.id;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = requireAuth;
