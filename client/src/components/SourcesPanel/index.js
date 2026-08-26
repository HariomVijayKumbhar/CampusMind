import { useState } from 'react';

/**
 * Expandable "Sources" panel shown under an assistant message.
 * Lists the document titles and short excerpts that grounded the answer.
 * Props: sources - array of { document_title, excerpt }
 */
export default function SourcesPanel({ sources }) {
  const [open, setOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 focus:outline-none"
        aria-expanded={open}
      >
        <svg
          className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        Sources ({sources.length})
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          {sources.map((source, idx) => (
            <div key={idx} className="text-sm">
              <p className="font-medium text-gray-900">
                {source.document_title || 'Untitled document'}
              </p>
              {source.excerpt && (
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                  {source.excerpt}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
