import { useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '@/store/documentStore';

const MAX_SIZE_BYTES = 30 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.webp'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export default function FileUploadModal({ open, onClose, onFileSelect }) {
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
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const isValidType = ALLOWED_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);
    if (!isValidType) {
      alert('Supported formats: PDF, DOCX, TXT, PNG, JPG, JPEG, WEBP');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      alert('File size must be less than 30 MB.');
      return;
    }
    setSelectedFile(file);
    if (onFileSelect) onFileSelect(file);
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
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16161E] p-5 shadow-2xl animate-slide-up"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Upload document</h2>
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

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors
            ${dragOver ? 'border-violet-400 bg-violet-500/10' : 'border-white/15 bg-white/5 hover:border-white/25'}`}
        >
          <svg className="mb-2 h-7 w-7 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
          </svg>
          {selectedFile ? (
            <>
              <p className="text-sm font-medium text-white truncate max-w-[260px]">{selectedFile.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {(selectedFile.size / 1024).toFixed(0)} KB — click to change
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-300">Click to browse or drop a file</p>
              <p className="mt-0.5 text-xs text-slate-500">PDF, DOCX, TXT, images up to 30 MB</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>

        {collections.length > 0 && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">
              Add to collection (optional)
            </span>
            <select
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50"
            >
              <option value="">General knowledge base</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}

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

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-violet-500 disabled:opacity-40"
          >
            {uploading ? 'Uploading…' : 'Upload & Index'}
          </button>
        </div>
      </div>
    </div>
  );
}
