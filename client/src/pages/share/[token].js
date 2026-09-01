import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/services/api';

export default function SharedDocumentPage() {
  const router = useRouter();
  const { token } = router.query;
  const [share, setShare] = useState(null);
  const [document, setDocument] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.get(`/api/shares/${token}`)
      .then(async (res) => {
        const s = res.data?.share;
        setShare(s);
        if (s?.document_id) {
          try {
            const doc = await api.get(`/api/documents/${s.document_id}`);
            setDocument(doc.data?.document || null);
          } catch {
            // ignore
          }
        }
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to resolve share link');
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <ProtectedRoute>
      <Head><title>Shared Document — CampusMind</title></Head>
      <div className="min-h-screen px-4 py-8" style={{ background: 'rgb(15,15,23)' }}>
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-2 text-2xl font-bold text-white">Shared Document</h1>

          {loading && <p className="text-sm text-slate-400">Resolving share link…</p>}
          {error && <div className="cm-banner-error mt-4">{error}</div>}

          {share && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">Access level</p>
              <p className="mt-1 text-sm font-semibold text-white">{share.role}</p>

              {document ? (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Document</p>
                  <p className="mt-1 text-base font-semibold text-white">{document.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {document.chunk_count} chunk{document.chunk_count === 1 ? '' : 's'} · Status: {document.status}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Document metadata unavailable.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
