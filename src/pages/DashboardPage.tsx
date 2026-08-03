import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, MessageSquareText, NotebookPen, ListChecks, ArrowRight, TrendingUp, Clock, CheckCircle2, Flame, AlertCircle, Settings, FileQuestion } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Task, type StudyPlan, type Note, type Quiz } from '@/lib/supabase';
import { hasApiKey } from '@/lib/apiKey';
import { ApiKeyModal } from '@/components/ApiKeyModal';

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState({ plans: 0, tasks: 0, completedTasks: 0, notes: 0, quizzes: 0, minutes: 0 });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApiModal, setShowApiModal] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const [plansRes, tasksRes, notesRes, quizzesRes, progressRes] = await Promise.all([
        supabase.from('study_plans').select('id').eq('user_id', user.id),
        supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('notes').select('id').eq('user_id', user.id),
        supabase.from('quizzes').select('id').eq('user_id', user.id),
        supabase.from('study_progress').select('minutes_studied,tasks_completed').eq('user_id', user.id),
      ]);

      const tasks = tasksRes.data as Task[] || [];
      const allTasksCount = tasksRes.data?.length || 0;
      const completed = tasks.filter((t) => t.status === 'completed').length;
      const totalMinutes = (progressRes.data || []).reduce((sum, p) => sum + (p.minutes_studied || 0), 0);

      setStats({
        plans: plansRes.data?.length || 0,
        tasks: allTasksCount,
        completedTasks: completed,
        notes: notesRes.data?.length || 0,
        quizzes: quizzesRes.data?.length || 0,
        minutes: totalMinutes,
      });
      setRecentTasks(tasks);
      setLoading(false);
    }
    load();
  }, [user]);

  const cards = [
    { label: 'Study Plans', value: stats.plans, icon: CalendarCheck, to: '/app/planner', color: 'emerald' },
    { label: 'Tasks', value: stats.tasks, icon: CheckCircle2, to: '/app/planner', color: 'teal' },
    { label: 'Notes', value: stats.notes, icon: NotebookPen, to: '/app/notes', color: 'sky' },
    { label: 'Quizzes', value: stats.quizzes, icon: ListChecks, to: '/app/quizzes', color: 'amber' },
  ];

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    teal: 'bg-teal-500/10 text-teal-400',
    sky: 'bg-sky-500/10 text-sky-400',
    amber: 'bg-amber-500/10 text-amber-400',
  };

  return (
    <div className="space-y-8">
      {/* API key banner */}
      {!hasApiKey() && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-300 font-medium">Set up your AI API key to unlock real AI responses</p>
              <p className="text-xs text-amber-400/70 mt-0.5">The AI Tutor and Notes Generator need a free OpenRouter API key to work.</p>
            </div>
          </div>
          <button
            onClick={() => setShowApiModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors shrink-0"
          >
            <Settings className="w-4 h-4" /> Set Up
          </button>
        </div>
      )}
      <ApiKeyModal open={showApiModal} onClose={() => setShowApiModal(false)} />

      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold mb-1">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Student'}
        </h1>
        <p className="text-slate-400">Here's your learning overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="group p-5 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-white/10 transition-all"
          >
            <div className={`w-10 h-10 rounded-xl ${colorMap[c.color]} flex items-center justify-center mb-3`}>
              <c.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold">{loading ? '—' : c.value}</p>
            <p className="text-sm text-slate-400">{c.label}</p>
          </Link>
        ))}
      </div>

      {/* Progress highlight */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <Flame className="w-5 h-5" />
            <span className="text-sm font-medium">Study Time</span>
          </div>
          <p className="text-3xl font-bold">{stats.minutes}<span className="text-lg text-slate-400 ml-1">min</span></p>
          <p className="text-sm text-slate-400 mt-1">Total minutes studied</p>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5">
          <div className="flex items-center gap-2 text-sky-400 mb-2">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">Tasks Done</span>
          </div>
          <p className="text-3xl font-bold">{stats.completedTasks}<span className="text-lg text-slate-400 ml-1">/ {stats.tasks}</span></p>
          <p className="text-sm text-slate-400 mt-1">Completed tasks</p>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Completion</span>
          </div>
          <p className="text-3xl font-bold">
            {stats.tasks > 0 ? Math.round((stats.completedTasks / stats.tasks) * 100) : 0}%
          </p>
          <p className="text-sm text-slate-400 mt-1">Task completion rate</p>
        </div>
      </div>

      {/* Recent tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Tasks</h2>
          <Link to="/app/planner" className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {recentTasks.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/50 border border-white/5 text-center">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No tasks yet. Create a study plan to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/50 border border-white/5">
                <div className={`w-2 h-2 rounded-full ${task.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className={`flex-1 text-sm ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  {task.title}
                </span>
                {task.due_date && <span className="text-xs text-slate-500">{task.due_date}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/app/planner" className="group p-5 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-emerald-500/30 transition-all">
            <CalendarCheck className="w-6 h-6 text-emerald-400 mb-3" />
            <p className="font-medium mb-1">New Study Plan</p>
            <p className="text-sm text-slate-400">Generate a schedule</p>
          </Link>
          <Link to="/app/tutor" className="group p-5 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-emerald-500/30 transition-all">
            <MessageSquareText className="w-6 h-6 text-emerald-400 mb-3" />
            <p className="font-medium mb-1">Ask AI Tutor</p>
            <p className="text-sm text-slate-400">Get instant help</p>
          </Link>
          <Link to="/app/notes" className="group p-5 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-emerald-500/30 transition-all">
            <NotebookPen className="w-6 h-6 text-emerald-400 mb-3" />
            <p className="font-medium mb-1">Generate Notes</p>
            <p className="text-sm text-slate-400">On any topic</p>
          </Link>
          <Link to="/app/quizzes" className="group p-5 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-emerald-500/30 transition-all">
            <ListChecks className="w-6 h-6 text-emerald-400 mb-3" />
            <p className="font-medium mb-1">Create Quiz</p>
            <p className="text-sm text-slate-400">Test your knowledge</p>
          </Link>
          <Link to="/app/pyq" className="group p-5 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-emerald-500/30 transition-all">
            <FileQuestion className="w-6 h-6 text-emerald-400 mb-3" />
            <p className="font-medium mb-1">PYQ & Exam Prep</p>
            <p className="text-sm text-slate-400">Previous year questions</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
