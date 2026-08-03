import { Link } from 'react-router-dom';
import { Brain, CalendarCheck, NotebookPen, ListChecks, MessageSquareText, Sparkles, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const features = [
  { icon: CalendarCheck, title: 'AI Study Planner', desc: 'Generate personalized study schedules based on your subjects, topics, and exam dates.' },
  { icon: MessageSquareText, title: 'AI Tutor', desc: 'Chat with an AI tutor that explains concepts, helps with problems, and keeps you on track.' },
  { icon: NotebookPen, title: 'Notes Generator', desc: 'Turn any topic into structured, comprehensive notes with summaries and key points.' },
  { icon: ListChecks, title: 'Quiz Generator', desc: 'Create practice quizzes with multiple-choice questions, answers, and explanations.' },
];

const steps = [
  { num: '01', title: 'Set Your Goals', desc: 'Tell LearnMate what you are studying and when your exams are.' },
  { num: '02', title: 'Get Your Plan', desc: 'AI generates a personalized study schedule and materials instantly.' },
  { num: '03', title: 'Study & Track', desc: 'Follow your plan, chat with your tutor, and track your progress.' },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-slate-950/70 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-slate-950" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">LearnMate AI</span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/app/dashboard" className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/auth/signin" className="text-sm text-slate-300 hover:text-white transition-colors">
                  Sign In
                </Link>
                <Link to="/auth/signup" className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15),_transparent_50%)]" />
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            AI-Powered Learning Platform
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
            Study smarter with your
            <span className="block bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
              personal AI tutor
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            LearnMate AI creates personalized study plans, generates notes and quizzes, and gives you an AI tutor that is available 24/7.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/auth/signup" className="group px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20">
              Start Learning Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link to="/auth/signin" className="px-7 py-3.5 rounded-xl border border-white/10 hover:border-white/20 text-slate-200 font-semibold transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to learn</h2>
            <p className="text-slate-400 text-lg">Four powerful AI tools in one platform</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="group p-6 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-emerald-500/30 transition-all hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <f.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 border-t border-white/5 bg-slate-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-slate-400 text-lg">Three steps to smarter studying</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.num} className="relative">
                <div className="text-5xl font-bold text-emerald-500/30 mb-3">{s.num}</div>
                <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
                <p className="text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to transform your learning?</h2>
          <p className="text-slate-400 text-lg mb-8">Join LearnMate AI and study smarter, not harder.</p>
          <Link to="/auth/signup" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-lg transition-all shadow-lg shadow-emerald-500/20">
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-400" /> No credit card</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-400" /> Free forever</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-400" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5 text-center text-sm text-slate-500">
        LearnMate AI — Your personal AI learning companion
      </footer>
    </div>
  );
}
