import { useEffect, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/services/api';

function ExamCard({ exam, onDelete, onGenerate, generating }) {
  const days = Math.ceil(
    (new Date(exam.exam_date + 'T00:00:00') - new Date(new Date().toDateString())) /
    (24 * 60 * 60 * 1000)
  );
  const hasPlan = Array.isArray(exam.plan) && exam.plan.length > 0;

  return (
    <div className="rounded-2xl border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">{exam.subject}</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {new Date(exam.exam_date).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
            {' · '}
            {days > 0 ? (
              <span className={days <= 7 ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                {days} day{days === 1 ? '' : 's'} left
              </span>
            ) : (
              <span className="text-slate-500">past</span>
            )}
          </p>
          {exam.topics && (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{exam.topics}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => onGenerate(exam)}
            disabled={generating === exam.id || days < 1}
            className="rounded-xl bg-violet-600/80 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-violet-500 disabled:opacity-40"
          >
            {generating === exam.id ? 'Planning…' : hasPlan ? 'Regenerate Plan' : 'Generate Plan'}
          </button>
          <button
            onClick={() => onDelete(exam)}
            className="rounded-xl border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-all hover:bg-red-500/20"
          >
            Delete
          </button>
        </div>
      </div>

      {hasPlan && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
            Study Plan ({exam.plan.length} days)
          </p>
          <ol className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {exam.plan.map((d, i) => (
              <li key={i} className="rounded-xl border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">
                    Day {d.day}: {d.focus}
                  </p>
                  {d.hours && <span className="text-xs text-violet-300">{d.hours}h</span>}
                </div>
                {Array.isArray(d.tasks) && d.tasks.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {d.tasks.map((t, ti) => (
                      <li key={ti} className="text-xs leading-relaxed text-slate-400">• {t}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function ExamPlanner() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState('');
  const [topics, setTopics] = useState('');
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(null);

  const load = () =>
    api
      .get('/api/exams')
      .then((res) => setExams(res.data?.exams || []))
      .catch(() => setError('Failed to load exams'));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !examDate) return;
    setCreating(true);
    setError('');
    try {
      await api.post('/api/exams', { subject: subject.trim(), exam_date: examDate, topics });
      setSubject('');
      setTopics('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add exam');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async (exam) => {
    setGenerating(exam.id);
    setError('');
    try {
      const res = await api.post(`/api/exams/${exam.id}/plan`, {
        subject: exam.subject,
        exam_date: exam.exam_date,
        topics: exam.topics || '',
      });
      setExams((prev) => prev.map((e) => (e.id === exam.id ? res.data.exam : e)));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate plan');
    } finally {
      setGenerating(null);
    }
  };

  const handleDelete = async (exam) => {
    if (!window.confirm(`Delete "${exam.subject}" and its plan?`)) return;
    try {
      await api.delete(`/api/exams/${exam.id}`);
      setExams((prev) => prev.filter((e) => e.id !== exam.id));
    } catch {
      setError('Failed to delete exam');
    }
  };

  return (
    <ProtectedRoute>
      <Head>
        <title>Exam Planner — CampusMind</title>
      </Head>

      <div className="min-h-screen px-4 py-8 sm:px-6" style={{ background: 'rgb(15,15,23)' }}>
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Exam Planner</h1>
              <p className="mt-1 text-sm text-slate-400">
                Add exams and get an AI-generated day-by-day study schedule.
              </p>
            </div>
            <Link
              href="/chat"
              className="self-start rounded-xl border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:border-violet-500/40 hover:text-white sm:self-auto"
            >
              ← Back to Chat
            </Link>
          </div>

          {/* Add exam form */}
          <form
            onSubmit={handleCreate}
            className="rounded-2xl border-white/10 p-5"
            style={{ background: 'rgba(22,22,34,0.7)' }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject (e.g. Operating Systems)"
                className="rounded-xl border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
              />
              <input
                type="date"
                value={examDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setExamDate(e.target.value)}
                className="rounded-xl border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 [color-scheme:dark]"
              />
            </div>
            <textarea
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Topics (comma or newline separated) — e.g. processes, scheduling, deadlocks, memory management"
              rows={2}
              className="mt-3 w-full resize-none rounded-xl border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
            />
            <button
              type="submit"
              disabled={!subject.trim() || !examDate || creating}
              className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 sm:w-auto"
              style={{ background: 'linear-gradient(135deg, rgb(139,92,246), rgb(124,58,237))' }}
            >
              {creating ? 'Adding…' : 'Add Exam'}
            </button>
          </form>

          {error && <div className="cm-banner-error">{error}</div>}

          {/* Exam list */}
          {loading ? (
            <div className="flex justify-center py-16">
              <svg className="h-6 w-6 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : exams.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-slate-300">No exams yet</p>
              <p className="mt-1 text-xs text-slate-500">Add your first exam above to generate a study plan.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {exams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  onDelete={handleDelete}
                  onGenerate={handleGenerate}
                  generating={generating}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
