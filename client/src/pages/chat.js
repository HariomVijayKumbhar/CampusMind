import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import ProtectedRoute from '@/components/ProtectedRoute';
import ChatWindow from '@/components/ChatWindow';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';

export default function Chat() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const profile = useAuthStore((state) => state.profile);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const logout = useAuthStore((state) => state.logout);
  const messages = useChatStore((state) => state.messages);

  // Profile is loaded centrally in authStore.initializeAuth. This just
  // guarantees it's available (cached, no extra request if already loaded).
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExportChat = () => {
    if (!messages || messages.length === 0) {
      alert('No messages to export yet.');
      return;
    }

    let markdown = `# CampusMind Conversation Export\nGenerated on: ${new Date().toLocaleString()}\n\n---\n\n`;
    messages.forEach((msg) => {
      const sender = msg.role === 'user' ? '🧑 Student' : '🤖 CampusMind Assistant';
      markdown += `### ${sender}\n${msg.content}\n\n`;
      if (msg.sources && msg.sources.length > 0) {
        markdown += `**Sources:**\n`;
        msg.sources.forEach((s) => {
          markdown += `- *${s.document_title || 'Document'}*: "${s.excerpt || ''}"\n`;
        });
        markdown += `\n`;
      }
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `campusmind-chat-${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <ProtectedRoute>
      <Head>
        <title>Chat — CampusMind</title>
        <meta name="description" content="Ask CampusMind anything about your college." />
      </Head>

      <div
        className="flex h-screen flex-col"
        style={{ background: 'rgb(15,15,23)' }}
      >
        {/* Header */}
        <header
          className="relative z-10 flex shrink-0 items-center justify-between px-4 py-3 sm:px-6"
          style={{
            background: 'rgba(22,22,34,0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Logo */}
          <Link href="/chat" className="flex items-center gap-2.5 group">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, rgb(139,92,246), rgb(236,72,153))' }}
            >
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-white">CampusMind</span>
          </Link>

          {/* Right nav */}
          <div className="flex items-center gap-2">
            {/* Upload & Knowledge Base button */}
            <Link
              href="/admin/documents"
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-1.5
                         text-xs font-semibold text-violet-300 transition-all hover:bg-violet-500/20 hover:text-white"
            >
              <svg className="h-4 w-4 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd"/>
              </svg>
              <span>Upload Docs &amp; OCR</span>
            </Link>

            {/* Export conversation button */}
            {messages.length > 0 && (
              <button
                onClick={handleExportChat}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5
                           text-xs font-medium text-slate-300 transition-all hover:border-violet-500/40 hover:bg-white/10 hover:text-white"
                title="Export conversation as Markdown"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
                Export Chat
              </button>
            )}

            {/* User avatar menu */}
            <div className="relative" ref={menuRef}>
              <button
                id="user-menu-btn"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white
                           transition-all hover:ring-2 hover:ring-violet-500/50"
                style={{ background: 'linear-gradient(135deg, rgb(139,92,246), rgb(109,40,217))' }}
                aria-label="Open user menu"
              >
                {initials}
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-10 z-50 w-52 rounded-2xl border border-white/10 p-1.5 shadow-2xl animate-slide-up"
                  style={{ background: 'rgba(22,22,34,0.98)', backdropFilter: 'blur(20px)' }}
                >
                  {profile?.full_name && (
                    <div className="mb-1 px-3 py-2">
                      <p className="text-xs font-semibold text-white truncate">{profile.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{profile.email}</p>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-1">
                    <Link href="/admin/documents" onClick={() => setMenuOpen(false)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
                      <svg className="h-4 w-4 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
                      </svg>
                      Manage Documents
                    </Link>
                    <button
                      onClick={() => { setMenuOpen(false); handleExportChat(); }}
                      className="flex sm:hidden w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                      Export Chat
                    </button>
                    <Link href="/settings" onClick={() => setMenuOpen(false)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
                      </svg>
                      Settings
                    </Link>
                    <button
                      onClick={() => { setMenuOpen(false); logout(); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd"/>
                        <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-1.07a.75.75 0 10-1.004-1.115l-2.5 2.5a.75.75 0 000 1.07l2.5 2.5a.75.75 0 101.004-1.114L8.704 10.75H18.25A.75.75 0 0019 10z" clipRule="evenodd"/>
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Chat area */}
        <div className="min-h-0 flex-1">
          <ChatWindow />
        </div>
      </div>
    </ProtectedRoute>
  );
}
