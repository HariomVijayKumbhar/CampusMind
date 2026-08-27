import { useState } from 'react';
import SourcesPanel from '@/components/SourcesPanel';
import ConfidenceBadge from '@/components/ConfidenceBadge';

/**
 * Renders a single chat message with copy response, feedback buttons (👍 / 👎), and sources panel.
 * Props: message - { role, content, sources, pending }, index - for stagger animation
 */
export default function MessageBubble({ message, index = 0 }) {
  const isUser = message.role === 'user';
  const content = message.content || '';
  const sources = message.sources || [];

  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex w-full animate-slide-up ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      {/* Avatar — only for assistant */}
      {!isUser && (
        <div
          className="mr-2.5 mt-1 flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-xl shadow-md"
          style={{ background: 'linear-gradient(135deg, rgb(139,92,246), rgb(236,72,153))' }}
        >
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h3a3 3 0 013 3v9a3 3 0 01-3 3H8a3 3 0 01-3-3v-9a3 3 0 013-3h3V5.73A2 2 0 0112 2zm-3 9a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2zm-3 4a3 3 0 01-2.83-2H9a3 3 0 005.66 0h-.83A3 3 0 0112 15z"/>
          </svg>
        </div>
      )}

      <div className={`group relative max-w-[80%] rounded-2xl px-4 py-3 ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
        <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${isUser ? 'text-white' : 'text-slate-100'}`}>
          {content}
        </div>

        {!isUser && message.confidence != null && !message.pending && (
          <div className="mt-2 flex items-center">
            <ConfidenceBadge confidence={message.confidence} />
          </div>
        )}

        {!isUser && sources.length > 0 && (
          <SourcesPanel sources={sources} />
        )}

        {/* Assistant action buttons: Copy, Thumbs Up, Thumbs Down */}
        {!isUser && !message.pending && content && (
          <div className="mt-2.5 flex items-center gap-1 border-t border-white/5 pt-1.5 text-xs text-slate-400">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-white/10 hover:text-white transition-colors"
              title="Copy answer"
            >
              {copied ? (
                <>
                  <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-[11px] text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z"/>
                    <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z"/>
                  </svg>
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </button>

            <button
              onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
              className={`rounded-md p-1 transition-colors ${
                feedback === 'up'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'hover:bg-white/10 hover:text-white'
              }`}
              title="Helpful response"
            >
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/>
              </svg>
            </button>

            <button
              onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
              className={`rounded-md p-1 transition-colors ${
                feedback === 'down'
                  ? 'bg-red-500/20 text-red-300'
                  : 'hover:bg-white/10 hover:text-white'
              }`}
              title="Not helpful"
            >
              <svg className="h-3 w-3 rotate-180" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/>
              </svg>
            </button>
          </div>
        )}

        {message.pending && (
          <div className="mt-1.5 text-xs text-violet-300/60">Sending…</div>
        )}
      </div>
    </div>
  );
}
