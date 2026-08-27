import { useState, useRef } from 'react';

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

/**
 * Multi-format Document & Image Uploader with OCR support.
 * Supports PDF, PNG, JPG, JPEG, WEBP.
 *
 * Props:
 * - onUpload(file): async handler that performs the upload
 * - uploading: boolean, disables interactions while a file is processing
 */
export default function DocumentUploader({ onUpload, uploading }) {
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (uploading) return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleFile = (file) => {
    setLocalError('');

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const isValidType = ALLOWED_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);

    if (!isValidType) {
      setLocalError('Supported file formats: PDF, PNG, JPG, JPEG, and WEBP.');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setLocalError('File size must be less than 15 MB.');
      return;
    }

    setSelectedFile(file);
    onUpload(file);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImageFile = (file) => {
    if (!file) return false;
    return file.type?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
  };

  return (
    <div>
      {localError && (
        <div className="cm-banner-error mb-4 animate-fade-in">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
          <span>{localError}</span>
        </div>
      )}

      <div
        id="file-drop-zone"
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-all duration-200 cursor-pointer ${
          dragActive
            ? 'border-violet-500/60 bg-violet-500/10'
            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {/* Background glow when dragging */}
        {dragActive && (
          <div className="pointer-events-none absolute inset-0 rounded-2xl"
               style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
        )}

        {uploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-14 w-14">
              <svg className="h-14 w-14 animate-spin text-violet-500" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeOpacity="0.15" strokeWidth="5"/>
                <path d="M52 28A24 24 0 0128 4" stroke="url(#spin-grad)" strokeWidth="5" strokeLinecap="round"/>
                <defs>
                  <linearGradient id="spin-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgb(139,92,246)"/>
                    <stop offset="100%" stopColor="rgb(236,72,153)"/>
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="h-6 w-6 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {isImageFile(selectedFile) ? 'Running OCR on Image…' : 'Processing Document…'}
              </p>
              {selectedFile && (
                <p className="mt-1 text-xs text-slate-400 font-medium">{selectedFile.name} · {formatSize(selectedFile.size)}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {isImageFile(selectedFile)
                  ? 'Optical Character Recognition (OCR) + Semantic Embedding'
                  : 'Text extraction, recursive chunking & vector indexing'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200 ${
                dragActive ? 'scale-110' : ''
              }`}
              style={{
                background: dragActive
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(236,72,153,0.3))'
                  : 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.3)',
              }}
            >
              <svg className={`h-7 w-7 transition-colors ${dragActive ? 'text-violet-300' : 'text-violet-500'}`}
                   viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
              </svg>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">
                {dragActive ? 'Drop file to upload' : 'Drag & drop PDF, Notice, or Image'}
              </p>
              <p className="mt-1 text-xs text-slate-400">PDF, PNG, JPG, JPEG, and WEBP supported</p>
            </div>

            <div
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, rgb(139,92,246), rgb(124,58,237))',
                boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
              }}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
              </svg>
              Select File
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                OCR Enabled
              </span>
              <span>·</span>
              <span>Up to 15 MB</span>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
          onChange={handleFileInput}
          disabled={uploading}
          className="hidden"
          aria-label="Upload document or image"
        />
      </div>
    </div>
  );
}
