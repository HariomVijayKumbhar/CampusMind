// Admin Analytics Service - usage stats for the admin dashboard

const supabase = require('../config/supabaseClient');

async function getUsageStats() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Run all queries in parallel; each degrades to a default on error
  const safe = async (fn, fallback) => {
    try { return await fn(); } catch (e) { console.warn('[Analytics]', e.message); return fallback; }
  };

  const [totals, daily, topUsers, feedback] = await Promise.all([
    safe(async () => {
      const { count } = await supabase
        .from('usage_events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since);
      return count || 0;
    }, 0),

    safe(async () => {
      const { data } = await supabase
        .from('usage_events')
        .select('event_type, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      // Bucket by day
      const byDay = {};
      for (const row of data || []) {
        const day = row.created_at.slice(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
      }
      return Object.entries(byDay)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);
    }, []),

    safe(async () => {
      const { data } = await supabase
        .from('usage_events')
        .select('user_id')
        .gte('created_at', since)
        .limit(5000);
      const counts = {};
      for (const row of data || []) {
        if (row.user_id) counts[row.user_id] = (counts[row.user_id] || 0) + 1;
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      // Enrich with emails
      if (top.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', top.map(([id]) => id));
      return top.map(([userId, count]) => {
        const p = (profiles || []).find((pr) => pr.id === userId);
        return { user_id: userId, name: p?.full_name || 'Unknown', email: p?.email || '', count };
      });
    }, []),

    safe(async () => {
      const { count } = await supabase
        .from('message_feedback')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    }, 0),
  ]);

  // Event-type breakdown
  const breakdown = await safe(async () => {
    const { data } = await supabase
      .from('usage_events')
      .select('event_type')
      .gte('created_at', since)
      .limit(5000);
    const counts = {};
    for (const row of data || []) counts[row.event_type] = (counts[row.event_type] || 0) + 1;
    return counts;
  }, {});

  return {
    period_days: 30,
    total_events: totals,
    event_breakdown: breakdown,
    daily_activity: daily,
    top_users: topUsers,
    total_feedback: feedback,
  };
}

module.exports = { getUsageStats };
