import { useState, useEffect, useRef, useCallback } from 'react';
import MessageBubble from '@/components/MessageBubble';
import { useChatStore } from '@/store/chatStore';

function TypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
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
  const topRef = useRef(null);
  const containerRef = useRef(null);
  const previousScrollHeight = useRef(0);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    if (scrollTop < 100 && hasMoreHistory && !loadingOlder) {
      previousScrollHeight.current = scrollHeight;
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
        const newScrollHeight = container.scrollHeight;
        const heightDiff = newScrollHeight - previousScrollHeight.current;
        container.scrollTop = heightDiff;
      }
      previousScrollHeight.current = 0;
    }
  }, [loadingOlder, messages]);

  useEffect(() => {
    if (bottomRef.current && !loadingOlder) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending, loadingOlder]);

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
    <div className="flex h-full min-h-0 flex-col bg-gray-50">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
          {loadingHistory ? (
            <p className="mt-10 text-center text-sm text-gray-500">
              Loading your conversation...
            </p>
          ) : messages.length === 0 && !sending ? (
            <div className="mt-16 text-center">
              <h1 className="text-xl font-bold text-gray-900">
                Ask me anything about the college
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Admissions, courses, fees, exams, hostels, library — answers
                come from the uploaded college documents.
              </p>
            </div>
          ) : (
            <>
              {hasMoreHistory && (
                <div ref={topRef} className="flex justify-center py-2">
                  {loadingOlder && (
                    <p className="text-sm text-gray-500">Loading older messages...</p>
                  )}
                </div>
              )}
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {sending && <TypingIndicator />}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && (
        <div className="mx-auto mb-2 w-full max-w-3xl px-4">
          <div className="flex items-center justify-between rounded-md bg-red-50 border border-red-200 px-4 py-2">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={clearError}
              className="ml-4 text-xs font-medium text-red-600 hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-end gap-2 px-4 py-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question..."
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
