// Exam Planner Service - AI study schedule generation

const { Groq } = require('groq-sdk');
const supabase = require('../config/supabaseClient');
const ragConfig = require('../config/rag');
const { trackUsage } = require('./usageTracker');

let groqInstance = null;
if (ragConfig.groqApiKey) {
  try {
    groqInstance = new Groq({ apiKey: ragConfig.groqApiKey });
  } catch (err) {
    console.warn('[ExamPlanner] Groq init failed:', err.message);
  }
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr + 'T00:00:00') - new Date(new Date().toDateString());
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

async function generatePlan(userId, examId, subject, examDate, topics) {
  if (!groqInstance) throw new Error('Groq client is not configured.');

  const days = daysUntil(examDate);
  if (days < 1) {
    return { error: 'This exam date has already passed. Pick a future date.', status: 400 };
  }
  if (days > 180) {
    return { error: 'Exam date is too far away (max 180 days).', status: 400 };
  }

  const topicList = topics
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const completion = await groqInstance.chat.completions.create({
    model: ragConfig.groqModel,
    temperature: 0.6,
    messages: [
      {
        role: 'system',
        content:
          'You are CampusMind, a college study planner. Create realistic day-by-day study plans. Respond with ONLY a JSON array, no other text.',
      },
      {
        role: 'user',
        content: `Subject: ${subject}
Exam date: ${examDate} (${days} days from today)
Topics to cover: ${topicList.join(', ') || 'as covered in a standard college syllabus'}

Create a day-by-day study plan. Respond ONLY with a JSON array like:
[{"day": 1, "date": "YYYY-MM-DD", "focus": "Topic name", "tasks": ["task 1", "task 2"], "hours": 2}]
Rules: start from tomorrow, cover all topics with spaced revision, include at least one full revision day near the end, keep tasks specific and actionable.`,
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '';
  const match = raw.match(/\[[\s\S]*\]/);
  let plan = [];
  if (match) {
    try {
      plan = JSON.parse(match[0]);
    } catch {
      plan = [];
    }
  }

  if (!Array.isArray(plan) || plan.length === 0) {
    return { error: 'Failed to generate a study plan. Please try again.', status: 502 };
  }

  trackUsage(userId, 'exam_plan', { subject, days });

  const { data, error } = await supabase
    .from('exams')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('id', examId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return { error: 'Failed to save plan', status: 500 };
  return { exam: data };
}

async function listExams(userId) {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('user_id', userId)
    .order('exam_date', { ascending: true });
  if (error) throw new Error('Failed to list exams');
  return data || [];
}

async function createExam(userId, subject, examDate, topics) {
  if (!subject || !examDate) throw new Error('Subject and exam date are required');
  const { data, error } = await supabase
    .from('exams')
    .insert({ user_id: userId, subject, exam_date: examDate, topics: topics || '' })
    .select()
    .single();
  if (error) throw new Error('Failed to create exam');
  return data;
}

async function deleteExam(userId, examId) {
  const { data, error } = await supabase
    .from('exams')
    .delete()
    .eq('id', examId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw new Error('Failed to delete exam');
  if (!data) return { error: 'Exam not found', status: 404 };
  return { success: true };
}

module.exports = { listExams, createExam, deleteExam, generatePlan, daysUntil };
