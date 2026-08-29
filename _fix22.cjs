const fs = require('fs');
const p = 'd:/CampusMind/client/src/components/ChatWindow/index.js';
let s = fs.readFileSync(p, 'utf8');

// 1. Import modal
s = s.replace(
  "import MessageBubble from '@/components/MessageBubble';",
  "import MessageBubble from '@/components/MessageBubble';\nimport FileUploadModal from '@/components/FileUploadModal';"
);

// 2. State
s = s.replace(
  "  const [input, setInput] = useState('');\n  const bottomRef",
  "  const [input, setInput] = useState('');\n  const [uploadOpen, setUploadOpen] = useState(false);\n  const bottomRef"
);

// 3. "+" button before textarea
const plusBtn = `          {/* "+" upload button */}
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            disabled={sending}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition-all duration-200 hover:border-violet-500/40 hover:text-white disabled:opacity-40"
            aria-label="Upload a document"
            title="Upload a document to the knowledge base"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="relative flex-1">`;

s = s.replace(
  '        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-end gap-3">\n          <div className="relative flex-1">',
  '        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-end gap-3">\n' + plusBtn
);

// 4. Render modal before footer note
s = s.replace(
  '        <p className="mx-auto mt-2',
  '        <FileUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />\n\n        <p className="mx-auto mt-2'
);

fs.writeFileSync(p, s);
console.log('plus:', s.includes('setUploadOpen(true)'), 'modal:', s.includes('<FileUploadModal'));
