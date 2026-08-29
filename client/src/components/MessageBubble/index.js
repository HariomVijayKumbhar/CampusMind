import { useState } from 'react';
import SourcesPanel from '@/components/SourcesPanel';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import { useChatStore } from '@/store/chatStore';
import { useSpeechOutput } from '@/hooks/useSpeech';

export default function MessageBubble({ message, index = 0 }) {
  const isUser = message.role === 'user';
  const content = message.content || '';
  const sources = message.sources || [];

  const [copied, setCopied] = useState(false);
  const rateMessage = useChatStore((state) => state.rateMessage);
  const { ttsSupported, speaking, speak, stopSpeaking } = useSpeechOutput();
  const feedback = message.myRating || null;

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
      {!isUser && (
        <div className="mr-2.5 mt-1 flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-full bg-violet-500/15 border border-violet-500/20">
          <svg className="h-3.5 w-3.5 text-violet-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h3a3 3 0 013 3v9a3 3 0 01-3 3H8a3 3 0 01-3-3v-9a3 3 0 013-3h3V5.73A2 2 0 0112 2zm-3 9a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2zm-3 4a3 3 0 01-2.83-2H9a3 3 0 005.66 0h-.83A3 3 0 0112 15z"/>
          </svg>
        </div>
      )}

      <div className={`group relative max-w-[85%] rounded-2xl px-4 py-3 ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
        <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${isUser ? 'text-white' : 'text-slate-200'}`}>
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
        {!isUser && !message.pending && !message.streaming && content && (
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
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

            {ttsSupported && content && (
              <button
                onClick={() => (speaking ? stopSpeaking() : speak(content))}
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors ${
                  speaking ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-white/10 hover:text-white'
                }`}
                title={speaking ? 'Stop reading aloud' : 'Read answer aloud'}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d={speaking
                    ? 'M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z'
                    : 'M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z'} />
                </svg>
                <span className="text-[11px]">{speaking ? 'Stop' : 'Listen'}</span>
              </button>
            )}

            <button
              onClick={() => rateMessage(message.id, 'up')}
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
              onClick={() => rateMessage(message.id, 'down')}
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
