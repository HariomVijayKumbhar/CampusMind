// Share Service - token-based document sharing
//
// Admin creates a share link with a role (viewer/annotator/editor) and
// optional expiry/max-uses. Anyone with the token can resolve the share
// and gain read access to the document (and write access for annotator/editor).

const crypto = require('crypto');
const supabase = require('../config/supabaseClient');
const ragConfig = require('../config/rag');

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

async function createShare({ documentId, createdBy, role, expiresAt = null, maxUses = null }) {
  const finalRole = ['viewer', 'annotator', 'editor'].includes(role)
    ? role
    : (ragConfig.collab?.defaultShareRole || 'viewer');

  const token = generateToken();
  const { data, error } = await supabase
    .from('document_shares')
    .insert({
      document_id: documentId,
      token,
      role: finalRole,
      expires_at: expiresAt || null,
      max_uses: maxUses == null ? (ragConfig.collab?.maxShareUses ?? null) : maxUses,
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) {
    return { error: error.message, status: 500 };
  }
  return { share: data };
}

async function resolveShare(token) {
  if (!token) return { error: 'Missing token', status: 400 };
  const { data, error } = await supabase
    .from('document_shares')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!data) return { error: 'Share not found', status: 404 };

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { error: 'Share expired', status: 410 };
  }
  if (data.max_uses != null && data.used_count >= data.max_uses) {
    return { error: 'Share usage limit reached', status: 410 };
  }

  // Increment used_count (best-effort).
  try {
    await supabase
      .from('document_shares')
      .update({ used_count: (data.used_count || 0) + 1 })
      .eq('id', data.id);
  } catch {
    // ignore
  }

  return { share: data };
}

async function listSharesForDocument(documentId) {
  const { data, error } = await supabase
    .from('document_shares')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

async function revokeShare(shareId) {
  const { error } = await supabase
    .from('document_shares')
    .delete()
    .eq('id', shareId);
  return error ? { error: error.message, status: 500 } : { success: true };
}

module.exports = {
  createShare,
  resolveShare,
  listSharesForDocument,
  revokeShare,
};
