import { useEffect, useState } from 'react';
import { ListChecks, Plus, Trash2, Loader2, Sparkles, Check, X, ChevronRight, RotateCcw, Award } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Quiz, type QuizQuestion } from '@/lib/supabase';
import { generateQuiz } from '@/lib/ai';

export default function QuizzesPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizMode, setQuizMode] = useState<'list' | 'taking' | 'results'>('list');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const [form, setForm] = useState({ subject: '', topic: '', difficulty: 'intermediate', count: '5' });

  useEffect(() => {
    load();
  }, [user]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from('quizzes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setQuizzes((data as Quiz[]) || []);
    setLoading(false);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setGenerating(true);

    const generated = generateQuiz(form.subject, form.topic, form.difficulty, parseInt(form.count) || 5);

    const { data: quizRow } = await supabase
      .from('quizzes')
      .insert({
        title: generated.title,
        subject: form.subject,
        topic: form.topic,
        difficulty: form.difficulty,
      })
      .select()
      .single();

    if (quizRow) {
      const quiz = quizRow as Quiz;
      const questionInserts = generated.questions.map((q) => ({
        quiz_id: quiz.id,
        question_text: q.question_text,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
      }));
      await supabase.from('quiz_questions').insert(questionInserts);
      await load();
      setShowForm(false);
      setForm({ subject: '', topic: '', difficulty: 'intermediate', count: '5' });
    }
    setGenerating(false);
  }

  async function deleteQuiz(quiz: Quiz) {
    await supabase.from('quizzes').delete().eq('id', quiz.id);
    setQuizzes(quizzes.filter((q) => q.id !== quiz.id));
    if (activeQuiz?.id === quiz.id) setActiveQuiz(null);
  }

  async function startQuiz(quiz: Quiz) {
    const { data } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('created_at', { ascending: true });
    setQuestions((data as QuizQuestion[]) || []);
    setActiveQuiz(quiz);
    setQuizMode('taking');
    setCurrentQ(0);
    setAnswers([]);
    setSelectedAnswer(null);
  }

  function submitAnswer() {
    if (selectedAnswer === null) return;
    const newAnswers = [...answers, selectedAnswer];
    setAnswers(newAnswers);
    setSelectedAnswer(null);
    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1);
    } else {
      setQuizMode('results');
    }
  }

  function resetQuiz() {
    setQuizMode('taking');
    setCurrentQ(0);
    setAnswers([]);
    setSelectedAnswer(null);
  }

  const score = answers.filter((a, i) => a === questions[i]?.correct_index).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quizzes</h1>
          <p className="text-slate-400 text-sm mt-1">AI-generated practice quizzes</p>
        </div>
        {quizMode === 'list' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> New Quiz
          </button>
        )}
      </div>

      {showForm && quizMode === 'list' && (
        <form onSubmit={handleGenerate} className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">Generate a quiz with AI</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Subject *</label>
              <input
                required
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
                placeholder="e.g. History"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Topic</label>
              <input
                type="text"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
                placeholder="e.g. World War II"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Questions</label>
              <select
                value={form.count}
                onChange={(e) => setForm({ ...form, count: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
              >
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="8">8</option>
                <option value="10">10</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Quiz
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : quizMode === 'list' ? (
        quizzes.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/50 border border-white/5 text-center">
            <ListChecks className="w-10 h-10 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No quizzes yet. Click "New Quiz" to generate one with AI.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="group p-5 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-emerald-500/30 transition-all">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{quiz.title}</p>
                    <p className="text-sm text-slate-400">{quiz.subject}{quiz.topic ? ` · ${quiz.topic}` : ''}</p>
                  </div>
                  <button
                    onClick={() => deleteQuiz(quiz)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-xs text-slate-400 capitalize">{quiz.difficulty}</span>
                </div>
                <button
                  onClick={() => startQuiz(quiz)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium text-sm transition-colors"
                >
                  Start Quiz <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )
      ) : quizMode === 'taking' && activeQuiz && questions.length > 0 ? (
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">{activeQuiz.title}</h2>
              <p className="text-sm text-slate-400">Question {currentQ + 1} of {questions.length}</p>
            </div>
            <button
              onClick={() => { setQuizMode('list'); setActiveQuiz(null); }}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Exit
            </button>
          </div>

          <div className="w-full h-1.5 rounded-full bg-slate-800 mb-8 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${((currentQ) / questions.length) * 100}%` }}
            />
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5">
            <p className="text-lg font-medium mb-6">{questions[currentQ].question_text}</p>
            <div className="space-y-2">
              {(questions[currentQ].options as string[]).map((option, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedAnswer(i)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                    selectedAnswer === i
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-950/50 border-white/5 hover:border-white/15 text-slate-300'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0 ${
                    selectedAnswer === i ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-600'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </button>
              ))}
            </div>
            <button
              onClick={submitAnswer}
              disabled={selectedAnswer === null}
              className="w-full mt-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {currentQ + 1 < questions.length ? 'Next Question' : 'Finish Quiz'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : quizMode === 'results' && activeQuiz ? (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-8 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 text-center">
            <Award className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <p className="text-4xl font-bold mb-2">{score} / {questions.length}</p>
            <p className="text-slate-400">
              {score === questions.length ? 'Perfect score! Excellent work!' : score >= questions.length * 0.7 ? 'Great job!' : score >= questions.length * 0.5 ? 'Good effort — keep practicing!' : 'Keep studying — you\'ll get there!'}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Review Answers</h3>
            {questions.map((q, i) => (
              <div key={q.id} className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
                <div className="flex items-start gap-3 mb-2">
                  {answers[i] === q.correct_index ? (
                    <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-medium">{q.question_text}</p>
                </div>
                <div className="ml-8 space-y-1">
                  {answers[i] !== q.correct_index && (
                    <p className="text-sm text-red-400">Your answer: {(q.options as string[])[answers[i]]}</p>
                  )}
                  <p className="text-sm text-emerald-400">Correct: {(q.options as string[])[q.correct_index]}</p>
                  <p className="text-sm text-slate-400 mt-1">{q.explanation}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetQuiz}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Retake Quiz
            </button>
            <button
              onClick={() => { setQuizMode('list'); setActiveQuiz(null); }}
              className="px-5 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-slate-200 font-semibold text-sm transition-colors"
            >
              Back to Quizzes
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
