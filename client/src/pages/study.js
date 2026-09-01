import { useEffect, useState } from 'react';
import api from '@/services/api';
import Flashcard from '@/components/Flashcard';
import { useStudyStore } from '@/store/studyStore';

const TABS = [
  { id: 'quiz', label: 'Quiz Me' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'review', label: 'Review' },
  { id: 'summary', label: 'Summary' },
];

const SUMMARY_MODES = [
  { id: 'bullets', label: 'Bullet notes' },
  { id: 'exam', label: 'Exam revision' },
  { id: 'eli5', label: 'Explain simply' },
];

export default function StudyPage() {
  const [tab, setTab] = useState('quiz');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('bullets');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState({});
  const [flashcards, setFlashcards] = useState(null);
  const [flipped, setFlipped] = useState({});
  const [summary, setSummary] = useState('');

  const {
    progress,
    recommendations,
    dueFlashcards,
    fetchProgress,
    fetchRecommendations,
    fetchDueFlashcards,
    reviewFlashcard,
    deleteFlashcard,
  } = useStudyStore();

  useEffect(() => {
    if (tab === 'review') {
      fetchProgress();
      fetchRecommendations();
      fetchDueFlashcards();
    }
  }, [tab, fetchProgress, fetchRecommendations, fetchDueFlashcards]);

  const run = async (fn) => {
    setLoading(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateQuiz = () =>
    run(async () => {
      const res = await api.post('/api/study/quiz', { topic, count: 5 });
      setQuiz(res.data.quiz || []);
      setSelected({});
    });

  const generateFlashcards = () =>
    run(async () => {
      const res = await api.post('/api/study/flashcards', { topic, count: 10 });
      setFlashcards(res.data.flashcards || []);
      setFlipped({});
    });

  const generateSummary = () =>
    run(async () => {
      const res = await api.post('/api/study/summarize', { title: topic, mode });
      setSummary(res.data.summary || '');
    });

  const inputBar = (onSubmit, cta) => (
    <div className="flex flex-col gap-3 sm:flex-row">
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && topic.trim() && onSubmit()}
        placeholder={tab === 'summary' ? 'Document title or topic...' : 'Topic to study (e.g. DBMS normalization)...'}
        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
      />
      {tab === 'summary' && (
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none"
        >
          {SUMMARY_MODES.map((m) => (
            <option key={m.id} value={m.id} className="bg-slate-900">
              {m.label}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={onSubmit}
        disabled={!topic.trim() || loading}
        className="rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, rgb(139,92,246), rgb(124,58,237))' }}
      >
        {loading ? 'Generating…' : cta}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: 'rgb(15,15,23)' }}>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-bold text-white">Study Tools</h1>
        <p className="mb-6 text-sm text-slate-400">
          Generate quizzes, flashcards, and summaries grounded in your uploaded documents.
        </p>

        <div className="mb-6 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(''); }}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === t.id
                ? 'bg-violet-600 text-white'
                : 'border border-white/10 bg-white/5 text-slate-400 hover:text-white'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {progress && (
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Messages (30d)</p>
              <p className="mt-1 text-xl font-bold text-white">{progress.messages}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Due flashcards</p>
              <p className="mt-1 text-xl font-bold text-violet-400">{progress.flashcards?.due || 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Mastery</p>
              <p className="mt-1 text-xl font-bold text-emerald-400">
                {progress.sessions?.mastery != null
                  ? `${Math.round(progress.sessions.mastery * 100)}%`
                  : '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Helpful ratio</p>
              <p className="mt-1 text-xl font-bold text-amber-400">
                {progress.feedback?.ratio != null
                  ? `${Math.round(progress.feedback.ratio * 100)}%`
                  : '—'}
              </p>
            </div>
          </div>
        )}

        {tab === 'review' && (
          <div className="mt-6 space-y-6">
            {recommendations?.weak_areas?.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-xs font-semibold text-amber-300">⚠️ Topics you struggled with</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recommendations.weak_areas.map((t, i) => (
                    <span key={i} className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                      {t.topic} {t.count ? `(${t.count})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="mb-3 text-sm font-semibold text-white">Due flashcards ({dueFlashcards.length})</h2>
              {dueFlashcards.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                  No flashcards due. Save Q&amp;A pairs from the chat to start building your deck.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {dueFlashcards.map((card) => (
                    <Flashcard
                      key={card.id}
                      card={card}
                      onReview={reviewFlashcard}
                      onDelete={deleteFlashcard}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'quiz' && inputBar(generateQuiz, 'Generate Quiz')}
        {tab === 'flashcards' && inputBar(generateFlashcards, 'Generate Flashcards')}
        {tab === 'summary' && inputBar(generateSummary, 'Summarize')}

        {error && (
          <div className="cm-banner-error mt-4">{error}</div>
        )}

        {quiz && tab === 'quiz' && (
          <div className="mt-6 space-y-5">
            {quiz.map((q, qi) => (
              <div key={qi} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="mb-3 text-sm font-medium text-white">{qi + 1}. {q.question}</p>
                <div className="grid gap-2">
                  {q.options.map((opt, oi) => {
                    const chosen = selected[qi] === oi;
                    const revealed = selected[qi] != null;
                    const correct = q.answer_index === oi;
                    let cls = 'border-white/10 text-slate-300 hover:border-violet-500/40';
                    if (revealed && correct) cls = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200';
                    else if (revealed && chosen && !correct) cls = 'border-red-500/60 bg-red-500/10 text-red-200';
                    return (
                      <button
                        key={oi}
                        disabled={revealed}
                        onClick={() => setSelected({ ...selected, [qi]: oi })}
                        className={`rounded-xl border px-4 py-2 text-left text-sm transition-colors ${cls}`}
                      >
                        {String.fromCharCode(65 + oi)}. {opt}
                      </button>
                    );
                  })}
                </div>
                {selected[qi] != null && q.explanation && (
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">💡 {q.explanation}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {flashcards && tab === 'flashcards' && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {flashcards.map((card, ci) => (
              <button
                key={ci}
                onClick={() => setFlipped({ ...flipped, [ci]: !flipped[ci] })}
                className="min-h-[120px] rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-colors hover:border-violet-500/40"
              >
                <p className="text-[10px] uppercase tracking-wide text-violet-400">
                  {flipped[ci] ? 'Answer' : 'Question'} · tap to flip
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-100">
                  {flipped[ci] ? card.back : card.front}
                </p>
              </button>
            ))}
          </div>
        )}

        {summary && tab === 'summary' && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}
