import { useEffect, useState } from 'react';
import { BarChart3, Flame, Clock, CheckCircle2, Target, TrendingUp, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type StudyProgress, type Task } from '@/lib/supabase';

export default function ProgressPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [progress, setProgress] = useState<StudyProgress[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    load();
  }, [user]);

  async function load() {
    if (!user) return;
    const { data: progData } = await supabase
      .from('study_progress')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(30);
    setProgress((progData as StudyProgress[]) || []);

    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id);
    setTasks((taskData as Task[]) || []);

    setGoal(profile?.learning_goal || '');
    setLoading(false);
  }

  async function saveGoal() {
    setSavingGoal(true);
    await supabase.from('profiles').update({ learning_goal: goal }).eq('id', user!.id);
    await refreshProfile();
    setSavingGoal(false);
  }

  const totalMinutes = progress.reduce((sum, p) => sum + (p.minutes_studied || 0), 0);
  const totalCompleted = progress.reduce((sum, p) => sum + (p.tasks_completed || 0), 0);
  const taskCompleted = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = tasks.length > 0 ? Math.round((taskCompleted / tasks.length) * 100) : 0;

  // Last 7 days chart
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const chartData = last7.map((d) => {
    const dateStr = d.toISOString().slice(0, 10);
    const entry = progress.find((p) => p.date === dateStr);
    return {
      label: dayLabels[d.getDay()],
      minutes: entry?.minutes_studied || 0,
    };
  });
  const maxMinutes = Math.max(...chartData.map((d) => d.minutes), 30);

  // Streak
  let streak = 0;
  const sortedDates = [...progress].sort((a, b) => b.date.localeCompare(a.date));
  for (const p of sortedDates) {
    if (p.minutes_studied > 0) streak++;
    else break;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-slate-400 text-sm mt-1">Track your study habits and achievements</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20">
              <Flame className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-2xl font-bold">{streak}</p>
              <p className="text-sm text-slate-400">Day streak</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5">
              <Clock className="w-5 h-5 text-sky-400 mb-2" />
              <p className="text-2xl font-bold">{totalMinutes}</p>
              <p className="text-sm text-slate-400">Minutes studied</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5">
              <CheckCircle2 className="w-5 h-5 text-amber-400 mb-2" />
              <p className="text-2xl font-bold">{totalCompleted}</p>
              <p className="text-sm text-slate-400">Tasks completed</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5">
              <TrendingUp className="w-5 h-5 text-teal-400 mb-2" />
              <p className="text-2xl font-bold">{completionRate}%</p>
              <p className="text-sm text-slate-400">Completion rate</p>
            </div>
          </div>

          {/* Weekly chart */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold">This Week</h2>
            </div>
            <div className="flex items-end justify-between gap-3 h-48">
              {chartData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500/40 to-emerald-400 transition-all min-h-[4px]"
                      style={{ height: `${(d.minutes / maxMinutes) * 100}%` }}
                      title={`${d.minutes} min`}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{d.label}</span>
                  <span className="text-xs text-slate-400">{d.minutes}m</span>
                </div>
              ))}
            </div>
          </div>

          {/* Learning goal */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold">Learning Goal</h2>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What do you want to achieve?"
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
              />
              <button
                onClick={saveGoal}
                disabled={savingGoal}
                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors"
              >
                {savingGoal ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
