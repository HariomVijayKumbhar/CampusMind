import SourcesPanel from '@/components/SourcesPanel';

/**
 * Renders a single chat message.
 * User messages: right-aligned blue bubble.
 * Assistant messages: left-aligned white bubble with optional Sources panel.
 * Props: message - { role, content, sources, pending }
 */
export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  const content = message.content || '';
  const sources = message.sources || [];

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'border border-gray-200 bg-white text-gray-900'
        }`}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {content}
        </div>

        {!isUser && sources.length > 0 && (
          <SourcesPanel sources={sources} />
        )}

        {message.pending && (
          <div className="mt-1 text-xs text-blue-200">Sending...</div>
        )}
      </div>
    </div>
  );
}
