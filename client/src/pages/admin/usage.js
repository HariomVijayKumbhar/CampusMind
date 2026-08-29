import { useEffect, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/services/api';

const EVENT_LABELS = {
  chat: '💬 Chat messages',
  quiz: '📝 Quizzes generated',
  flashcards: '🃏 Flashcard sets',
  summary: '📄 Summaries',
  upload: '📤 Document uploads',
};

export default function AdminUsage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/admin/usage')
      .then((res) => setStats(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load usage stats'))
      .finally(() => setLoading(false));
  }, []);

  const maxDaily = stats?.daily_activity?.length
    ? Math.max(...stats.daily_activity.map((d) => d.count))
    : 1;

  return (
    <ProtectedRoute adminOnly>
      <Head>
        <title>Usage Analytics — CampusMind Admin</title>
      </Head>

      <div className="min-h-screen px-4 py-8 sm:px-6" style={{ background: 'rgb(15,15,23)' }}>
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400">
                Admin Workspace
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Usage Analytics</h1>
              <p className="mt-1 text-sm text-slate-400">Platform activity over the last 30 days</p>
            </div>
            <Link
              href="/admin/documents"
              className="self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:border-violet-500/40 hover:text-white sm:self-auto"
            >
              ← Knowledge Base
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <svg className="h-6 w-6 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : error ? (
            <div className="cm-banner-error">{error}</div>
          ) : stats ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Events</p>
                  <p className="mt-2 text-2xl font-bold text-white">{stats.total_events}</p>
                </div>
                {['chat', 'quiz', 'upload'].map((type) => (
                  <div key={type} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {type === 'chat' ? 'Chat Messages' : type === 'quiz' ? 'Quizzes' : 'Uploads'}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-violet-400">{stats.event_breakdown?.[type] || 0}</p>
                  </div>
                ))}
              </div>

              {/* Daily activity bar chart */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="mb-4 text-base font-semibold text-white">Daily Activity (30 days)</h2>
                {stats.daily_activity?.length ? (
                  <div className="flex h-32 items-end gap-1">
                    {stats.daily_activity.map((d) => (
                      <div key={d.date} className="group relative flex-1" title={`${d.date}: ${d.count} events`}>
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-violet-600 to-pink-500 transition-opacity group-hover:opacity-80"
                          style={{ height: `${Math.max((d.count / maxDaily) * 100, 4)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-slate-500">No activity recorded yet.</p>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Event breakdown */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="mb-3 text-base font-semibold text-white">Event Breakdown</h2>
                  <ul className="space-y-2">
                    {Object.entries(EVENT_LABELS).map(([type, label]) => (
                      <li key={type} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{label}</span>
                        <span className="font-semibold text-violet-300">{stats.event_breakdown?.[type] || 0}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 border-t border-white/10 pt-3 text-sm text-slate-400">
                    User ratings received: <span className="font-semibold text-emerald-400">{stats.total_feedback}</span>
                  </div>
                </div>

                {/* Top users */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="mb-3 text-base font-semibold text-white">Most Active Users</h2>
                  {stats.top_users?.length ? (
                    <ul className="space-y-2">
                      {stats.top_users.map((u, i) => (
                        <li key={u.user_id} className="flex items-center justify-between text-sm">
                          <span className="min-w-0 truncate text-slate-300">
                            <span className="mr-2 text-slate-500">#{i + 1}</span>
                            {u.name} <span className="text-xs text-slate-500">({u.email})</span>
                          </span>
                          <span className="ml-2 shrink-0 font-semibold text-violet-300">{u.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-4 text-center text-sm text-slate-500">No user activity yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </ProtectedRoute>
  );
}
