import { useState } from 'react';

const QUALITY_BUTTONS = [
  { value: 0, label: 'Again', color: 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20' },
  { value: 2, label: 'Hard', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20' },
  { value: 3, label: 'Good', color: 'border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20' },
  { value: 5, label: 'Easy', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' },
];

export default function Flashcard({ card, onReview, onDelete }) {
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!card) return null;
  const front = card.front || card.question;
  const back = card.back || card.answer;
  const due = card.due_date ? new Date(card.due_date).toLocaleDateString() : '—';

  const handleReview = async (quality) => {
    setBusy(true);
    try {
      await onReview?.(card.id, quality);
      setFlipped(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 p-4" style={{ background: 'rgba(22,22,34,0.7)' }}>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="block w-full text-left"
        aria-label="Flip card"
      >
        <p className="text-[10px] uppercase tracking-wider text-slate-500">
          {flipped ? 'Answer' : 'Question'} · due {due} · reps {card.repetitions || 0}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
          {flipped ? back : front}
        </p>
        <p className="mt-2 text-[11px] text-slate-500">Click to {flipped ? 'see question' : 'reveal answer'}</p>
      </button>

      {flipped && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {QUALITY_BUTTONS.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => handleReview(b.value)}
              disabled={busy}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${b.color} disabled:opacity-40`}
            >
              {b.label}
            </button>
          ))}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="ml-auto rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-white"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
