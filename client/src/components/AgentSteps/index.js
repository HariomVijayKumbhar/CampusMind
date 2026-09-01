import { useState } from 'react';

const TOOL_LABELS = {
  search_chunks: 'Searched knowledge base',
  summarize_sources: 'Summarized sources',
  compare_docs: 'Compared documents',
};

function StatusDot({ kind }) {
  const colors = {
    info: 'bg-violet-400',
    ok: 'bg-emerald-400',
    err: 'bg-red-400',
  };
  return <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${colors[kind] || colors.info}`} />;
}

function StepRow({ step }) {
  return (
    <div className="flex items-start gap-2 text-xs text-slate-400">
      <StatusDot kind={step.error ? 'err' : 'ok'} />
      <div className="min-w-0 flex-1">
        <span className="font-medium text-slate-200">{TOOL_LABELS[step.tool] || step.tool}</span>
        {step.result_count != null && (
          <span className="ml-2 text-slate-500">{step.result_count} result{step.result_count === 1 ? '' : 's'}</span>
        )}
        {step.output_preview && (
          <p className="mt-0.5 line-clamp-2 text-slate-500">{step.output_preview}</p>
        )}
        {step.error && <p className="mt-0.5 text-red-400">{step.error}</p>}
      </div>
    </div>
  );
}

export default function AgentSteps({ events = [] }) {
  const [open, setOpen] = useState(false);
  if (!events || events.length === 0) return null;

  const toolCalls = events.filter((e) => e.type === 'tool_call' || e.type === 'observation');
  const thoughts = events.filter((e) => e.type === 'thought');

  return (
    <div className="mt-3 border-t border-white/10 pt-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-violet-400 transition-all hover:bg-violet-500/10 hover:text-violet-300"
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
          <path d="M10 2a1 1 0 011 1v3.07A7.002 7.002 0 0117 13h2a1 1 0 110 2h-2a7.002 7.002 0 01-6 5.93V21a1 1 0 11-2 0v-.07A7.002 7.002 0 013 15H1a1 1 0 110-2h2a7.002 7.002 0 016-5.93V3a1 1 0 011-1zm0 4a5 5 0 100 10 5 5 0 000-10z"/>
        </svg>
        Agent steps ({toolCalls.length})
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 rounded-xl border border-white/10 bg-white/5 p-3 animate-slide-up">
          {thoughts.slice(0, 2).map((t, idx) => (
            <p key={`t-${idx}`} className="text-[11px] italic text-slate-500">{t.content}</p>
          ))}
          <div className="space-y-1.5 pt-1">
            {toolCalls.map((step, idx) => (
              <StepRow key={idx} step={step} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
