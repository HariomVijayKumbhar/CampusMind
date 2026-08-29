import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/chatStore';

export default function SessionsSidebar({ open, onClose }) {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeConversationId);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);

  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');

  useEffect(() => {
    if (open) loadConversations();
  }, [open, loadConversations]);

  if (!open) return null;

  const startRename = (conv) => {
    setRenamingId(conv.id);
    setRenameText(conv.title);
  };

  const commitRename = async () => {
    if (renamingId && renameText.trim()) {
      await renameConversation(renamingId, renameText.trim());
    }
    setRenamingId(null);
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onClose} />

      <aside
        className="fixed inset-y-0 left-0 z-30 flex w-72 flex-col sidebar-surface lg:static lg:z-0"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Conversations</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close sidebar">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* New chat */}
        <div className="p-3">
          <button
            onClick={() => { selectConversation(null); onClose(); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {conversations.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-500">
              No conversations yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((conv) => (
                <li key={conv.id} className="group relative">
                  {renamingId === conv.id ? (
                    <input
                      autoFocus
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="w-full rounded-lg border border-violet-500/50 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => { selectConversation(conv.id); onClose(); }}
                      className={`w-full rounded-xl px-3 py-2.5 pr-14 text-left text-sm transition-colors ${activeId === conv.id
                        ? 'bg-white/10 text-white'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                      <span className="block truncate">{conv.title}</span>
                      <span className="block text-[10px] text-slate-500">
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </span>
                    </button>
                  )}

                  {/* Row actions */}
                  {renamingId !== conv.id && (
                    <div className="absolute right-2 top-2.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => startRename(conv)}
                        className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                        title="Rename"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { if (window.confirm('Delete this conversation?')) deleteConversation(conv.id); }}
                        className="rounded-md p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-300"
                        title="Delete"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
