import { useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '@/store/documentStore';

/**
 * ChatGPT-style "+" upload modal: pick a file, optionally choose a
 * collection (department), upload it straight into the knowledge base
 * without leaving the chat.
 */
export default function FileUploadModal({ open, onClose }) {
  const {
    collections,
    fetchCollections,
    uploadDocument,
    uploading,
    error,
    success,
    clearError,
    clearSuccess,
  } = useDocumentStore();

  const [selectedFile, setSelectedFile] = useState(null);
  const [collectionId, setCollectionId] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      fetchCollections();
      setSelectedFile(null);
      setCollectionId('');
      clearError();
      clearSuccess();
    }
  }, [open, fetchCollections, clearError, clearSuccess]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const pickFile = (file) => {
    clearError();
    clearSuccess();
    setSelectedFile(file || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      await uploadDocument(selectedFile, collectionId || null);
      setTimeout(() => {
        onClose();
        clearSuccess();
      }, 1400);
    } catch {
      /* error banner shown by the store */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl border-white/10 p-6 shadow-2xl animate-slide-up"
        style={{ background: 'rgba(22,22,34,0.98)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <svg className="h-5 w-5 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M15.5 2A1.5 1.5 0 0013.05 3.05l-8.9 8.9a3.5 3.5 0 00-.86 1.53L2.6 16.4a.6.6 0 00.75.75l2.92-.69a3.5 3.5 0 001.53-.86l8.9-8.9A1.5 1.5 0 0015.5 2z" />
              <path d="M2 17.5A.75.75 0 012.75 17h5.5a.75.75 0 010 1.5h-5.5a.75.75 0 01-.75-.75z" />
            </svg>
            Upload a document
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close upload dialog"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors
            ${dragOver ? 'border-violet-400 bg-violet-500/10' : 'border-white/15 bg-white/5 hover:border-violet-500/50'}`}
        >
          <svg className="mb-2 h-8 w-8 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
            <path d="M9 13h2v5a1 1 0 11-2 0v-5z" />
          </svg>
          {selectedFile ? (
            <>
              <p className="text-sm font-semibold text-white truncate max-w-[260px]">{selectedFile.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {(selectedFile.size / 1024).toFixed(0)} KB — click to choose a different file
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-300">Click to browse or drop a file here</p>
              <p className="mt-0.5 text-xs text-slate-500">PDF, DOCX, TXT, images (OCR supported)</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>

        {/* Collection picker */}
        {collections.length > 0 && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-400">
              Add to collection (optional)
            </span>
            <select
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="w-full rounded-xl border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50"
            >
              <option value="">General knowledge base</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}

        {/* Banners */}
        {error && (
          <div className="cm-banner-error mt-4">
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="cm-banner-success mt-4">
            <span>{success}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, rgb(139,92,246), rgb(124,58,237))' }}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading…
              </span>
            ) : (
              'Upload & Index'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
