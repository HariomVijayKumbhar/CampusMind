import { useState, useEffect, useRef, useCallback } from 'react';
import MessageBubble from '@/components/MessageBubble';
import FileUploadModal from '@/components/FileUploadModal';
import { useChatStore } from '@/store/chatStore';
import { useSpeechInput } from '@/hooks/useSpeech';

function TypingIndicator() {
  return (
    <div className="flex w-full justify-start animate-slide-up">
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3 chat-bubble-assistant">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20">
          <svg className="h-3 w-3 text-violet-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h3a3 3 0 013 3v9a3 3 0 01-3 3H8a3 3 0 01-3-3v-9a3 3 0 013-3h3V5.73A2 2 0 0112 2zm-3 9a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2zm-3 4a3 3 0 01-2.83-2H9a3 3 0 005.66 0h-.83A3 3 0 0112 15z"/>
          </svg>
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 rounded-full bg-violet-400/80"
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
  const sendMessage = useChatStore((state) => state.sendMessageStream);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center animate-fade-in">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20">
        <svg className="h-8 w-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
        </svg>
      </div>

      <h2 className="mb-2 text-xl font-semibold text-white">CampusMind</h2>
      <p className="mb-8 max-w-sm text-sm leading-relaxed text-slate-400">
        Ask me anything about admissions, courses, fees, exams, hostels, and campus life.
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
  const sendMessage = useChatStore((state) => state.sendMessageStream);
  const clearError = useChatStore((state) => state.clearError);
  const chatQuota = useChatStore((state) => state.chatQuota);
  const agentMode = useChatStore((state) => state.agentMode);
  const setAgentMode = useChatStore((state) => state.setAgentMode);

  const [input, setInput] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const previousScrollHeight = useRef(0);
  const fileInputRef = useRef(null);

  const speech = useSpeechInput((transcript) => {
    setInput(transcript);
  });

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

  const handleFileSelect = (file) => {
    if (!file) return;
    setAttachments((prev) => [...prev, file]);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-full min-h-0 flex-col chat-surface">
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
      <div className="chat-input-surface px-4 py-4">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl flex-col gap-2">
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, idx) => (
                <span key={idx} className="attachment-chip">
                  <svg className="h-3.5 w-3.5 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
                  </svg>
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button type="button" onClick={() => removeAttachment(idx)}>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* "+" upload button */}
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              disabled={sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all duration-200 hover:border-violet-500/40 hover:text-white disabled:opacity-40"
              aria-label="Attach a file"
              title="Attach a file"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>

            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message CampusMind..."
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
              type="button"
              onClick={() => setAgentMode(!agentMode)}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all duration-200 ${
                agentMode
                  ? 'border-violet-500/60 bg-violet-500/20 text-violet-200'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-violet-500/40 hover:text-white'
              }`}
              title="Agent mode: multi-step research with tool calls"
              aria-pressed={agentMode}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/>
              </svg>
              Agent
            </button>

            <button
              id="chat-send"
              type="submit"
              disabled={sending || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition-all duration-200 hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              {sending ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                </svg>
              )}
            </button>
          </div>

          <p className="mx-auto mt-2 flex items-center justify-center gap-2 text-center text-xs text-slate-600">
            <span>Shift+Enter for new line</span>
            {chatQuota && (
              <span
                className={`rounded-full border px-2 py-0.5 font-semibold ${
                  chatQuota.remaining <= Math.ceil(chatQuota.limit * 0.2)
                    ? 'border-red-500/40 text-red-300'
                    : 'border-white/10 text-slate-500'
                }`}
                title="Messages remaining in the current rate-limit window"
              >
                {chatQuota.remaining}/{chatQuota.limit} left
              </span>
            )}
          </p>
        </form>

        <FileUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onFileSelect={handleFileSelect} />
      </div>
    </div>
  );
}
