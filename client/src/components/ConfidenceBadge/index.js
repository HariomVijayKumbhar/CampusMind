/**
 * Confidence badge shown on assistant messages.
 * Props: confidence - number 0..1 (or null/undefined to hide)
 * Color-coded: High (>= 0.7), Medium (>= 0.45), Low (< 0.45).
 */
export default function ConfidenceBadge({ confidence }) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return null;

  const pct = Math.round(confidence * 100);
  const label = confidence >= 0.7 ? 'High' : confidence >= 0.45 ? 'Medium' : 'Low';

  const styles = {
    High: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
    Medium: 'bg-amber-500/15 border-amber-500/25 text-amber-400',
    Low: 'bg-red-500/15 border-red-500/25 text-red-400',
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[label]}`}
      title={`Confidence: ${pct}%`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label} · {pct}%
    </span>
  );
}
