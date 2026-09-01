import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/services/api';

function AnnotationBubble({ annotation, onResolve, onDelete, canManage }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="line-clamp-2 text-[11px] italic text-slate-400">&ldquo;{annotation.selected_text}&rdquo;</p>
      {annotation.comment && (
        <p className="mt-1 text-sm text-slate-200">{annotation.comment}</p>
      )}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
        {annotation.resolved ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">Resolved</span>
        ) : canManage ? (
          <button onClick={() => onResolve(annotation.id)} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 hover:bg-white/10 hover:text-white">
            Mark resolved
          </button>
        ) : null}
        {canManage && (
          <button onClick={() => onDelete(annotation.id)} className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-300 hover:bg-red-500/20">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default function DocumentDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [doc, setDoc] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [versions, setVersions] = useState([]);
  const [intelligence, setIntelligence] = useState({ tables: [], metadata: null, key_points: [] });
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, a, v, intel] = await Promise.all([
        api.get(`/api/documents/${id}`),
        api.get(`/api/documents/${id}/annotations`),
        api.get(`/api/documents/${id}/versions`),
        api.get(`/api/documents/${id}/intelligence`).catch(() => ({ data: { tables: [], metadata: null, key_points: [] } })),
      ]);
      setDoc(d.data?.document || null);
      setAnnotations(a.data?.annotations || []);
      setVersions(v.data?.versions || []);
      setIntelligence(intel.data || { tables: [], metadata: null, key_points: [] });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const addAnnotation = async () => {
    if (!newComment.trim() || !doc) return;
    // Demo: annotate the document's first available content. In a real UI,
    // selection would provide start_offset/end_offset from the user's text selection.
    try {
      await api.post(`/api/documents/${id}/annotations`, {
        start_offset: 0,
        end_offset: Math.min(20, (doc.title || '').length || 1),
        selected_text: doc.title?.slice(0, 20) || 'document',
        comment: newComment.trim(),
      });
      setNewComment('');
      const a = await api.get(`/api/documents/${id}/annotations`);
      setAnnotations(a.data?.annotations || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add annotation');
    }
  };

  const onResolve = async (annotationId) => {
    await api.patch(`/api/documents/${id}/annotations/${annotationId}/resolve`).catch(() => {});
    const a = await api.get(`/api/documents/${id}/annotations`);
    setAnnotations(a.data?.annotations || []);
  };

  const onDelete = async (annotationId) => {
    await api.delete(`/api/documents/${id}/annotations/${annotationId}`).catch(() => {});
    setAnnotations((arr) => arr.filter((a) => a.id !== annotationId));
  };

  return (
    <ProtectedRoute>
      <Head><title>{doc ? doc.title : 'Document'} — CampusMind</title></Head>
      <div className="min-h-screen px-4 py-8" style={{ background: 'rgb(15,15,23)' }}>
        <div className="mx-auto max-w-4xl space-y-6">
          <Link href="/admin/documents" className="text-xs text-slate-400 hover:text-white">← Back to documents</Link>

          {error && <div className="cm-banner-error">{error}</div>}
          {loading && <p className="text-sm text-slate-400">Loading…</p>}

          {doc && (
            <div>
              <h1 className="text-2xl font-bold text-white">{doc.title}</h1>
              <p className="mt-1 text-sm text-slate-400">
                {doc.chunk_count} chunks · Status: {doc.status} · Added {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-2 text-sm font-semibold text-white">📊 Tables ({intelligence.tables.length})</h2>
              {intelligence.tables.length === 0 ? (
                <p className="text-xs text-slate-500">No tables detected.</p>
              ) : (
                <div className="space-y-3">
                  {intelligence.tables.slice(0, 3).map((t, i) => (
                    <div key={i} className="overflow-x-auto">
                      {t.title && <p className="mb-1 text-xs font-semibold text-violet-300">{t.title}</p>}
                      <table className="min-w-full text-xs text-slate-200">
                        {t.headers && t.headers.length > 0 && (
                          <thead>
                            <tr>{t.headers.map((h, j) => <th key={j} className="border-b border-white/10 px-2 py-1 text-left text-slate-300">{h}</th>)}</tr>
                          </thead>
                        )}
                        <tbody>
                          {(t.rows || []).slice(0, 5).map((r, j) => (
                            <tr key={j}>{r.map((c, k) => <td key={k} className="border-b border-white/5 px-2 py-1">{c}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-2 text-sm font-semibold text-white">📝 Metadata</h2>
              {intelligence.metadata ? (
                <ul className="space-y-1 text-xs text-slate-300">
                  {intelligence.metadata.page_count != null && <li>Pages: {intelligence.metadata.page_count}</li>}
                  {intelligence.metadata.author && <li>Author: {intelligence.metadata.author}</li>}
                  {intelligence.metadata.subject && <li>Subject: {intelligence.metadata.subject}</li>}
                  {intelligence.metadata.keywords && intelligence.metadata.keywords.length > 0 && (
                    <li>Keywords: {intelligence.metadata.keywords.join(', ')}</li>
                  )}
                  {intelligence.metadata.has_ocr && <li>OCR: yes</li>}
                </ul>
              ) : <p className="text-xs text-slate-500">No metadata available.</p>}

              {intelligence.key_points && intelligence.key_points.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Key points</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-slate-300">
                    {intelligence.key_points.slice(0, 3).flatMap((kp) => kp.points || []).slice(0, 5).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-sm font-semibold text-white">💬 Annotations ({annotations.length})</h2>
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAnnotation()}
                placeholder="Add a comment…"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
              />
              <button
                onClick={addAnnotation}
                disabled={!newComment.trim()}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
              >
                Add
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {annotations.length === 0 ? (
                <p className="text-xs text-slate-500">No annotations yet.</p>
              ) : (
                annotations.map((a) => (
                  <AnnotationBubble
                    key={a.id}
                    annotation={a}
                    onResolve={onResolve}
                    onDelete={onDelete}
                    canManage
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-sm font-semibold text-white">🕒 Version history ({versions.length})</h2>
            {versions.length === 0 ? (
              <p className="text-xs text-slate-500">No previous versions.</p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-300">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between border-b border-white/5 py-1">
                    <span>v{v.version_number} · {v.chunk_count} chunks · {v.total_chars} chars</span>
                    <span className="text-slate-500">{new Date(v.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
