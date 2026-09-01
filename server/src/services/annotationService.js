// Annotation Service - text-span annotations on document chunks.
// Each annotation is tied to a specific chunk_id and start/end offsets
// into that chunk's content. Re-processing may invalidate offsets; the
// client is responsible for re-resolving annotations on re-mount.

const supabase = require('../config/supabaseClient');

async function createAnnotation({ userId, documentId, chunkId = null, startOffset, endOffset, selectedText = null, comment = null, parentAnnotationId = null }) {
  if (!userId || !documentId) return { error: 'userId and documentId required', status: 400 };
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset <= startOffset) {
    return { error: 'Invalid offsets', status: 400 };
  }
  const { data, error } = await supabase
    .from('annotations')
    .insert({
      user_id: userId,
      document_id: documentId,
      chunk_id: chunkId,
      start_offset: startOffset,
      end_offset: endOffset,
      selected_text: selectedText ? String(selectedText).slice(0, 2000) : null,
      comment: comment ? String(comment).slice(0, 4000) : null,
      parent_annotation_id: parentAnnotationId,
    })
    .select()
    .single();
  if (error) return { error: error.message, status: 500 };
  return { annotation: data };
}

async function listAnnotations(documentId) {
  const { data, error } = await supabase
    .from('annotations')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[Annotation] listAnnotations failed:', error.message);
    return [];
  }
  return data || [];
}

async function resolveAnnotation(userId, annotationId) {
  const { data, error } = await supabase
    .from('annotations')
    .update({ resolved: true, updated_at: new Date().toISOString() })
    .eq('id', annotationId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) return { error: error.message, status: 500 };
  return { annotation: data };
}

async function deleteAnnotation(userId, annotationId) {
  const { error } = await supabase
    .from('annotations')
    .delete()
    .eq('id', annotationId)
    .eq('user_id', userId);
  return error ? { error: error.message, status: 500 } : { success: true };
}

module.exports = {
  createAnnotation,
  listAnnotations,
  resolveAnnotation,
  deleteAnnotation,
};
