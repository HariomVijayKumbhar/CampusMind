import { useState, useRef } from 'react';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * PDF upload area with drag-and-drop and file picker fallback.
 * Validates type and size client-side before delegating to onUpload.
 *
 * Props:
 * - onUpload(file): async handler that performs the upload
 * - uploading: boolean, disables interactions while a file is processing
 */
export default function DocumentUploader({ onUpload, uploading }) {
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState('');
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
    // Reset so picking the same file again still fires onChange
    e.target.value = '';
  };

  const handleFile = (file) => {
    setLocalError('');

    if (file.type !== 'application/pdf') {
      setLocalError('Only PDF files are allowed');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setLocalError('File size must be less than 10MB');
      return;
    }

    onUpload(file);
  };

  return (
    <div>
      {localError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{localError}</p>
        </div>
      )}

      <div
        className={`p-8 border-2 border-dashed rounded-lg transition ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 24l8-8 8 8M24 16v16"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Upload a PDF</h3>
          <p className="mt-1 text-sm text-gray-500">
            Drag and drop or use the button below
          </p>

          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Select PDF'}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileInput}
            disabled={uploading}
            className="hidden"
          />

          <p className="mt-2 text-xs text-gray-500">PDF up to 10MB</p>
        </div>
      </div>
    </div>
  );
}
