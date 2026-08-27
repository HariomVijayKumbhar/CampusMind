import { useState } from 'react';

/**
 * Expandable "Sources" panel shown under an assistant message.
 * Lists the document titles, relevance percentage, and short excerpts that grounded the answer.
 * Props: sources - array of { document_title, excerpt, similarity }
 */
export default function SourcesPanel({ sources }) {
  const [open, setOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-white/10 pt-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-violet-400
                   transition-all hover:bg-violet-500/10 hover:text-violet-300 focus:outline-none"
        aria-expanded={open}
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd"/>
        </svg>
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
        </svg>
        {sources.length} Verified Source{sources.length !== 1 ? 's' : ''}
      </button>

      {open && (
        <div className="mt-2.5 animate-slide-up space-y-2">
          {sources.map((source, idx) => {
            const similarityScore = typeof source.similarity === 'number'
              ? Math.round(source.similarity * 100)
              : null;

            return (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm transition-all hover:border-violet-500/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-medium text-slate-200 truncate">
                    <svg className="h-3.5 w-3.5 shrink-0 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
                    </svg>
                    <span className="truncate">{source.document_title || 'Campus Document'}</span>
                  </p>
                  {similarityScore !== null && (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      {similarityScore}% match
                    </span>
                  )}
                </div>
                {source.excerpt && (
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-400 italic">
                    &ldquo;{source.excerpt}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
