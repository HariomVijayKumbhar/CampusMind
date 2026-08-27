// Collection Routes - admin-only knowledge base department management
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const supabase = require('../config/supabaseClient');

const router = express.Router();

// GET /api/collections - List all collections (readable by any authenticated user)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('id, name, created_at')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    res.json({ success: true, collections: data || [] });
  } catch (error) {
    console.error('List collections error:', error);
    res.status(500).json({ error: error.message || 'Failed to list collections' });
  }
});

// POST /api/collections - Create a collection (admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    const { data, error } = await supabase
      .from('collections')
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) {
      // unique constraint on name
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A collection with this name already exists' });
      }
      throw new Error(error.message);
    }

    res.status(201).json({ success: true, collection: data });
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(500).json({ error: error.message || 'Failed to create collection' });
  }
});

module.exports = router;
