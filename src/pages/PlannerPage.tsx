import { useEffect, useState } from 'react';
import { CalendarCheck, Plus, Trash2, Check, Clock, Loader2, Sparkles, ChevronDown, ChevronRight, Target, TrendingUp, Settings, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type StudyPlan, type Task } from '@/lib/supabase';
import { getApiKey, hasApiKey, SUPABASE_FUNCTION_URL } from '@/lib/apiKey';
import { ApiKeyModal } from '@/components/ApiKeyModal';

type RoadmapTask = {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  resources: string[];
};
type RoadmapDay = {
  day: string;
  tasks: RoadmapTask[];
};
type RoadmapWeek = {
  week: number;
  theme: string;
  days: RoadmapDay[];
};
type Roadmap = {
  title: string;
  weeks: RoadmapWeek[];
};

const PROGRESS_STEPS = [
  'Analyzing subject & skill level...',
  'Generating weekly themes...',
  'Creating daily tasks...',
  'Finalizing roadmap...',
];

const STORAGE_KEY = 'learnmate_roadmap_progress';

function loadProgress(roadmapId: string): Record<string, boolean> {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return all[roadmapId] || {};
  } catch {
    return {};
  }
}

function saveProgress(roadmapId: string, taskIds: Record<string, boolean>) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    all[roadmapId] = taskIds;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

export default function PlannerPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<StudyPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [roadmapPlanId, setRoadmapPlanId] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([0]));
  const [taskProgress, setTaskProgress] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    subject: '',
    examDate: '',
    skillLevel: 'beginner',
    hoursPerWeek: '7',
  });

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    if (roadmapPlanId) {
      setTaskProgress(loadProgress(roadmapPlanId));
    }
  }, [roadmapPlanId]);

  async function load() {
    if (!user) return;
    const { data: planData } = await supabase
      .from('study_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setPlans((planData as StudyPlan[]) || []);
    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTasks((taskData as Task[]) || []);
    setLoading(false);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!hasApiKey()) {
      setShowApiModal(true);
      return;
    }

    setGenerating(true);
    setError(null);
    setProgressStep(0);

    const stepInterval = setInterval(() => {
      setProgressStep((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, 2000);

    try {
      const response = await fetch(`${SUPABASE_FUNCTION_URL}/functions/v1/ai-roadmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          subject: form.subject,
          examDate: form.examDate || null,
          skillLevel: form.skillLevel,
          hoursPerWeek: parseInt(form.hoursPerWeek) || 7,
          apiKey: getApiKey(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const generatedRoadmap = data.roadmap as Roadmap;

      if (!generatedRoadmap || !generatedRoadmap.weeks) {
        throw new Error('AI returned an invalid roadmap. Please try again.');
      }

      // Save to database
      const { data: planRow } = await supabase
        .from('study_plans')
        .insert({
          title: generatedRoadmap.title || `${form.subject} Study Roadmap`,
          subject: form.subject,
          exam_date: form.examDate || null,
          difficulty: form.skillLevel,
          schedule: generatedRoadmap,
        })
        .select()
        .single();

      if (planRow) {
        const plan = planRow as StudyPlan;
        // Insert tasks from roadmap
        const taskInserts: Record<string, unknown>[] = [];
        for (const week of generatedRoadmap.weeks) {
          for (const day of week.days) {
            for (const task of day.tasks) {
              taskInserts.push({
                user_id: user.id,
                plan_id: plan.id,
                title: task.title,
                description: task.description,
                status: 'pending',
                priority: 'medium',
                estimated_minutes: task.estimated_minutes || 60,
              });
            }
          }
        }
        if (taskInserts.length > 0) {
          await supabase.from('tasks').insert(taskInserts);
        }

        await load();
        viewRoadmap(plan);
        setShowForm(false);
        setForm({ subject: '', examDate: '', skillLevel: 'beginner', hoursPerWeek: '7' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate roadmap');
    } finally {
      clearInterval(stepInterval);
      setProgressStep(0);
      setGenerating(false);
    }
  }

  function viewRoadmap(plan: StudyPlan) {
    setSelectedPlan(plan);
    setRoadmapPlanId(plan.id);
    const schedule = plan.schedule as unknown as Roadmap | null;
    setRoadmap(schedule);
    setExpandedWeeks(new Set([0]));
  }

  function toggleTask(taskId: string) {
    const newProgress = { ...taskProgress, [taskId]: !taskProgress[taskId] };
    setTaskProgress(newProgress);
    if (roadmapPlanId) saveProgress(roadmapPlanId, newProgress);
  }

  function toggleWeek(weekIdx: number) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekIdx)) next.delete(weekIdx);
      else next.add(weekIdx);
      return next;
    });
  }

  async function deletePlan(plan: StudyPlan) {
    await supabase.from('study_plans').delete().eq('id', plan.id);
    setPlans(plans.filter((p) => p.id !== plan.id));
    if (selectedPlan?.id === plan.id) {
      setSelectedPlan(null);
      setRoadmap(null);
      setRoadmapPlanId(null);
    }
  }

  // Calculate progress
  const allRoadmapTasks: RoadmapTask[] = [];
  if (roadmap) {
    for (const week of roadmap.weeks) {
      for (const day of week.days) {
        allRoadmapTasks.push(...day.tasks);
      }
    }
  }
  const completedCount = allRoadmapTasks.filter((t) => taskProgress[t.id]).length;
  const totalCount = allRoadmapTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Study Planner</h1>
          <p className="text-slate-400 text-sm mt-1">AI-generated study roadmaps with interactive progress tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowApiModal(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-slate-300 text-sm font-medium transition-colors"
          >
            <Settings className="w-4 h-4" /> API Key
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> New Roadmap
          </button>
        </div>
      </div>

      <ApiKeyModal open={showApiModal} onClose={() => setShowApiModal(false)} />

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Generating progress */}
      {generating && (
        <div className="p-8 rounded-2xl bg-slate-900/50 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-emerald-400">Generating Your Study Roadmap</p>
              <p className="text-sm text-slate-400">AI is creating a personalized week-by-week plan</p>
            </div>
          </div>
          <div className="space-y-3">
            {PROGRESS_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  i < progressStep ? 'bg-emerald-500 text-slate-950' :
                  i === progressStep ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-slate-800 text-slate-600'
                }`}>
                  {i < progressStep ? <Check className="w-3.5 h-3.5" /> :
                   i === progressStep ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                   <span className="text-xs">{i + 1}</span>}
                </div>
                <span className={`text-sm ${i <= progressStep ? 'text-slate-200' : 'text-slate-600'}`}>{step}</span>
                {i === progressStep && <div className="flex-1 h-0.5 shimmer rounded-full" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate form */}
      {showForm && !generating && (
        <form onSubmit={handleGenerate} className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">Generate a study roadmap with AI</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Subject *</label>
              <input
                required
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
                placeholder="e.g. Data Structures, Organic Chemistry..."
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Exam Target Date</label>
              <input
                type="date"
                value={form.examDate}
                onChange={(e) => setForm({ ...form, examDate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Current Skill Level</label>
              <select
                value={form.skillLevel}
                onChange={(e) => setForm({ ...form, skillLevel: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
              >
                <option value="beginner">Beginner — starting from scratch</option>
                <option value="intermediate">Intermediate — know the basics</option>
                <option value="advanced">Advanced — need to master details</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Hours per week</label>
              <input
                type="number"
                min="1"
                max="40"
                value={form.hoursPerWeek}
                onChange={(e) => setForm({ ...form, hoursPerWeek: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Generate Roadmap
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : plans.length === 0 && !generating ? (
        <div className="p-12 rounded-2xl bg-slate-900/50 border border-white/5 text-center">
          <CalendarCheck className="w-10 h-10 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No study roadmaps yet. Click "New Roadmap" to generate one with AI.</p>
        </div>
      ) : !roadmap ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => viewRoadmap(plan)}
                className="w-full text-left p-4 rounded-xl border transition-all bg-slate-900/50 border-white/5 hover:border-emerald-500/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{plan.title}</p>
                    <p className="text-sm text-slate-400">{plan.subject}</p>
                  </div>
                  <span
                    onClick={(e) => { e.stopPropagation(); deletePlan(plan); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  {plan.exam_date && <span>Exam: {plan.exam_date}</span>}
                  <span className="capitalize">{plan.difficulty}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="lg:col-span-2 p-12 rounded-2xl bg-slate-900/50 border border-white/5 text-center">
            <CalendarCheck className="w-10 h-10 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Select a plan to view its roadmap.</p>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Plan list */}
          <div className="space-y-3">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => viewRoadmap(plan)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedPlan?.id === plan.id
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-slate-900/50 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{plan.title}</p>
                    <p className="text-sm text-slate-400">{plan.subject}</p>
                  </div>
                  <span
                    onClick={(e) => { e.stopPropagation(); deletePlan(plan); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  {plan.exam_date && <span>Exam: {plan.exam_date}</span>}
                  <span className="capitalize">{plan.difficulty}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Roadmap detail */}
          <div className="lg:col-span-2 space-y-4">
            {/* Progress bar */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-semibold">{roadmap.title}</h2>
                </div>
                <span className="text-2xl font-bold text-emerald-400">{progressPercent}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-sm text-slate-400 mt-2">
                {completedCount} of {totalCount} tasks completed
              </p>
            </div>

            {/* Weeks */}
            {roadmap.weeks.map((week, wIdx) => (
              <div key={wIdx} className="rounded-2xl bg-slate-900/50 border border-white/5 overflow-hidden">
                <button
                  onClick={() => toggleWeek(wIdx)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
                >
                  {expandedWeeks.has(wIdx) ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                  <div className="flex-1">
                    <p className="font-medium">Week {week.week}: {week.theme}</p>
                  </div>
                  <Target className="w-4 h-4 text-emerald-400" />
                </button>
                {expandedWeeks.has(wIdx) && (
                  <div className="px-4 pb-4 space-y-3">
                    {week.days.map((day, dIdx) => (
                      <div key={dIdx} className="ml-7">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">{day.day}</p>
                        <div className="space-y-2">
                          {day.tasks.map((task) => (
                            <div
                              key={task.id}
                              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                taskProgress[task.id]
                                  ? 'bg-emerald-500/5 border-emerald-500/20'
                                  : 'bg-slate-950/50 border-white/5'
                              }`}
                            >
                              <button
                                onClick={() => toggleTask(task.id)}
                                className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                  taskProgress[task.id]
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : 'border-slate-600 hover:border-emerald-500'
                                }`}
                              >
                                {taskProgress[task.id] && <Check className="w-3.5 h-3.5 text-slate-950" strokeWidth={3} />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${taskProgress[task.id] ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                  {task.title}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="flex items-center gap-1 text-xs text-slate-500">
                                    <Clock className="w-3 h-3" /> {task.estimated_minutes} min
                                  </span>
                                  {task.resources.length > 0 && (
                                    <span className="text-xs text-slate-500">Resources: {task.resources.join(', ')}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
