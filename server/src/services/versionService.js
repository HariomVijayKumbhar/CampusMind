// Version Service - lightweight version snapshots for documents.
// On re-upload of the same title, the previous chunk_count and total_chars
// are captured into `document_versions` for audit/rollback.

const supabase = require('../config/supabaseClient');

async function archiveVersion({ documentId, createdBy, chunkCount, totalChars }) {
  if (!documentId) return null;
  try {
    const { data: existing, error: countError } = await supabase
      .from('document_versions')
      .select('version_number')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1);
    if (countError) {
      console.warn('[Version] count query failed:', countError.message);
    }
    const last = existing && existing[0] ? existing[0].version_number : 0;
    const next = last + 1;

    const { data, error } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: next,
        chunk_count: chunkCount || 0,
        total_chars: totalChars || 0,
        snapshot: { chunk_count: chunkCount || 0, total_chars: totalChars || 0, created_by: createdBy },
        created_by: createdBy,
      })
      .select()
      .single();
    if (error) {
      console.warn('[Version] archiveVersion failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[Version] archiveVersion error:', err.message);
    return null;
  }
}

async function listVersions(documentId) {
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false });
  if (error) {
    console.warn('[Version] listVersions failed:', error.message);
    return [];
  }
  return data || [];
}

module.exports = {
  archiveVersion,
  listVersions,
};
