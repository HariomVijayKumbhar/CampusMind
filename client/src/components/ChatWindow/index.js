import { useState, useEffect, useRef, useCallback } from 'react';
import MessageBubble from '@/components/MessageBubble';
import { useChatStore } from '@/store/chatStore';

function TypingIndicator() {
  return (
    <div className="flex w-full justify-start animate-slide-up">
      <div className="flex items-center gap-2 rounded-2xl px-4 py-3 bubble-assistant">
        {/* Robot icon */}
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
             style={{ background: 'linear-gradient(135deg, rgb(139,92,246), rgb(236,72,153))' }}>
          <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h3a3 3 0 013 3v9a3 3 0 01-3 3H8a3 3 0 01-3-3v-9a3 3 0 013-3h3V5.73A2 2 0 0112 2zm-3 9a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2zm-3 4a3 3 0 01-2.83-2H9a3 3 0 005.66 0h-.83A3 3 0 0112 15z"/>
          </svg>
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 rounded-full bg-violet-400"
              style={{ animation: `bounceDot 1.2s ease-in-out ${delay}ms infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const suggestions = [
    'What are the admission requirements?',
    'Tell me about the hostel facilities.',
    'What courses are available in CS?',
    'What are the exam schedules?',
  ];
  const sendMessage = useChatStore((state) => state.sendMessage);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center animate-fade-in">
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.1))',
          boxShadow: '0 0 40px rgba(139,92,246,0.2)',
          border: '1px solid rgba(139,92,246,0.25)',
        }}
      >
        <svg className="h-10 w-10 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
        </svg>
      </div>

      <h2 className="mb-2 text-2xl font-bold text-white">Ask CampusMind</h2>
      <p className="mb-8 max-w-sm text-sm leading-relaxed text-slate-400">
        Get instant answers about admissions, courses, fees, exams, hostels, and more — powered by your college&apos;s official documents.
      </p>

      <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => sendMessage(s)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-300
                       transition-all duration-200 hover:border-violet-500/40 hover:bg-white/10 hover:text-white"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatWindow() {
  const messages = useChatStore((state) => state.messages);
  const loadingHistory = useChatStore((state) => state.loadingHistory);
  const loadingOlder = useChatStore((state) => state.loadingOlder);
  const sending = useChatStore((state) => state.sending);
  const error = useChatStore((state) => state.error);
  const hasMoreHistory = useChatStore((state) => state.hasMoreHistory);
  const loadHistory = useChatStore((state) => state.loadHistory);
  const loadOlderMessages = useChatStore((state) => state.loadOlderMessages);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const clearError = useChatStore((state) => state.clearError);

  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const previousScrollHeight = useRef(0);

  // Load chat history on initial mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollTop < 100 && hasMoreHistory && !loadingOlder) {
      previousScrollHeight.current = container.scrollHeight;
      loadOlderMessages();
    }
  }, [hasMoreHistory, loadingOlder, loadOlderMessages]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    if (loadingOlder && previousScrollHeight.current > 0) {
      const container = containerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight - previousScrollHeight.current;
      }
      previousScrollHeight.current = 0;
    }
  }, [loadingOlder, messages]);

  useEffect(() => {
    if (bottomRef.current && !loadingOlder) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending, loadingOlder]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    await sendMessage(content);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ background: 'rgb(15,15,23)' }}
    >
      {/* Message list */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {loadingHistory ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <svg className="h-6 w-6 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="text-sm text-slate-500">Loading conversation...</p>
            </div>
          </div>
        ) : messages.length === 0 && !sending ? (
          <EmptyState />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
            {hasMoreHistory && (
              <div className="flex justify-center py-2">
                {loadingOlder && (
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Loading older messages...
                  </span>
                )}
              </div>
            )}

            {messages.map((message, idx) => (
              <MessageBubble key={message.id} message={message} index={idx} />
            ))}

            {sending && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-auto mb-2 w-full max-w-3xl px-4">
          <div className="cm-banner-error justify-between">
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
              {error}
            </span>
            <button
              type="button"
              onClick={clearError}
              className="shrink-0 text-xs font-medium text-red-400 hover:text-red-200 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div
        className="border-t border-white/10 px-4 py-4"
        style={{ background: 'rgba(22,22,34,0.9)', backdropFilter: 'blur(16px)' }}
      >
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-end gap-3">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your college..."
              rows={1}
              disabled={sending}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-4 text-sm text-white placeholder-slate-500
                         outline-none transition-all duration-200
                         focus:border-violet-500/50 focus:bg-white/10 focus:ring-2 focus:ring-violet-500/20
                         disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '160px' }}
            />
          </div>

          <button
            id="chat-send"
            type="submit"
            disabled={sending || !input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-200
                       disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, rgb(139,92,246), rgb(124,58,237))',
              boxShadow: input.trim() && !sending ? '0 4px 20px rgba(139,92,246,0.4)' : 'none',
            }}
            aria-label="Send message"
          >
            {sending ? (
              <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
              </svg>
            )}
          </button>
        </form>

        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-slate-600">
          Shift+Enter for new line · answers grounded in college documents
        </p>
      </div>
    </div>
  );
}
