import { useState, useEffect } from 'react';
import api from '@/services/api';

const ROLES = [
  { value: 'viewer', label: 'Viewer (read-only)' },
  { value: 'annotator', label: 'Annotator (can comment)' },
  { value: 'editor', label: 'Editor (can re-upload)' },
];

export default function ShareDialog({ documentId, documentTitle, onClose }) {
  const [role, setRole] = useState('viewer');
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    api.get(`/api/documents/${documentId}/shares`)
      .then((res) => {
        const existing = (res.data?.shares || [])[0];
        if (existing) setShare(existing);
      })
      .catch(() => {});
  }, [documentId]);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/api/documents/${documentId}/share`, { role });
      setShare(res.data.share);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create share link');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!share) return;
    setBusy(true);
    try {
      await api.delete(`/api/documents/${documentId}/shares/${share.id}`);
      setShare(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke share');
    } finally {
      setBusy(false);
    }
  };

  const url = share ? `${window.location.origin}/share/${share.token}` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(22,22,34,0.95)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Share document</h2>
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{documentTitle || 'Document'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close">✕</button>
        </div>

        {error && <div className="cm-banner-error mt-4">{error}</div>}

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-300">Access level</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value} className="bg-slate-900">{r.label}</option>
            ))}
          </select>

          {share ? (
            <>
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3">
                <p className="text-[10px] uppercase tracking-wider text-violet-300">Share link</p>
                <p className="mt-1 break-all text-xs text-slate-200">{url}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
                    className="rounded-lg border border-violet-500/40 bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-200 hover:bg-violet-500/30"
                  >
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                  <button
                    type="button"
                    onClick={revoke}
                    disabled={busy}
                    className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-40"
                  >
                    Revoke
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">Role: {share.role} · Used {share.used_count || 0} times</p>
            </>
          ) : (
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
            >
              {busy ? 'Creating…' : 'Create share link'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
