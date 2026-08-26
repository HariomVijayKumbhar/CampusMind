import SourcesPanel from '@/components/SourcesPanel';

/**
 * Renders a single chat message.
 * User messages: right-aligned violet gradient bubble.
 * Assistant messages: left-aligned dark glass bubble with optional Sources panel.
 * Props: message - { role, content, sources, pending }, index - for stagger animation
 */
export default function MessageBubble({ message, index = 0 }) {
  const isUser = message.role === 'user';
  const content = message.content || '';
  const sources = message.sources || [];

  return (
    <div
      className={`flex w-full animate-slide-up ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      {/* Avatar — only for assistant */}
      {!isUser && (
        <div
          className="mr-2.5 mt-1 flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-xl"
          style={{ background: 'linear-gradient(135deg, rgb(139,92,246), rgb(236,72,153))' }}
        >
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h3a3 3 0 013 3v9a3 3 0 01-3 3H8a3 3 0 01-3-3v-9a3 3 0 013-3h3V5.73A2 2 0 0112 2zm-3 9a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2zm-3 4a3 3 0 01-2.83-2H9a3 3 0 005.66 0h-.83A3 3 0 0112 15z"/>
          </svg>
        </div>
      )}

      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
        <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${isUser ? 'text-white' : 'text-slate-100'}`}>
          {content}
        </div>

        {!isUser && sources.length > 0 && (
          <SourcesPanel sources={sources} />
        )}

        {message.pending && (
          <div className="mt-1.5 text-xs text-violet-300/60">Sending…</div>
        )}
      </div>
    </div>
  );
}
