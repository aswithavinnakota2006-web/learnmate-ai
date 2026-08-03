import { useEffect, useRef, useState } from 'react';
import { FileQuestion, Sparkles, Loader2, Download, Settings, AlertCircle, Check, BookOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Note } from '@/lib/supabase';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { getApiKey, hasApiKey, SUPABASE_FUNCTION_URL } from '@/lib/apiKey';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const PROGRESS_STEPS = [
  'Analyzing subject & exam type...',
  'Generating previous year questions...',
  'Writing step-by-step solutions...',
  'Formatting exam paper...',
];

const EXAM_TYPES = [
  { value: 'University Mid-Term', label: 'University Mid-Term' },
  { value: 'University Semester Exam', label: 'University Semester Exam' },
  { value: 'GATE', label: 'GATE' },
  { value: 'JEE', label: 'JEE' },
  { value: 'NEET', label: 'NEET' },
  { value: 'Interview', label: 'Technical Interview' },
  { value: 'Certification', label: 'Certification Exam' },
  { value: 'School Board', label: 'School Board Exam' },
];

export default function PyqPage() {
  const { user } = useAuth();
  const [pyqContent, setPyqContent] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [savedPyqs, setSavedPyqs] = useState<Note[]>([]);
  const [selectedPyq, setSelectedPyq] = useState<Note | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    subject: '',
    examType: 'University Semester Exam',
    units: '',
    language: '',
  });

  useEffect(() => {
    loadSaved();
  }, [user]);

  async function loadSaved() {
    if (!user) return;
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .ilike('topic', 'PYQ%')
      .order('created_at', { ascending: false });
    setSavedPyqs((data as Note[]) || []);
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
    setPyqContent(null);
    setSelectedPyq(null);

    const stepInterval = setInterval(() => {
      setProgressStep((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, 2000);

    try {
      const response = await fetch(`${SUPABASE_FUNCTION_URL}/functions/v1/ai-pyq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          subject: form.subject,
          examType: form.examType,
          units: form.units || undefined,
          language: form.language || undefined,
          apiKey: getApiKey(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const content = data.content as string;
      if (!content) throw new Error('No content returned from AI.');

      setPyqContent(content);

      // Save to notes table with PYQ topic
      const title = `${form.subject} — ${form.examType} PYQs`;
      const tags = [form.subject, form.examType, 'PYQ', 'Exam Prep', 'AI Generated'];

      const { data: noteRow } = await supabase
        .from('notes')
        .insert({
          title,
          subject: form.subject,
          topic: `PYQ: ${form.examType}`,
          content,
          summary: `Previous year questions for ${form.subject} (${form.examType}).`,
          tags,
        })
        .select()
        .single();

      if (noteRow) {
        await loadSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PYQs');
    } finally {
      clearInterval(stepInterval);
      setProgressStep(0);
      setGenerating(false);
    }
  }

  async function exportPDF() {
    const content = selectedPyq ? selectedPyq.content : pyqContent;
    if (!content || !contentRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: '#0f172a',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }

      const fileName = `${form.subject || 'Exam'}_${form.examType.replace(/[^a-zA-Z0-9]/g, '_')}_PYQ.pdf`;
      pdf.save(fileName);
    } catch {
      setError('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function viewSavedPyq(note: Note) {
    setSelectedPyq(note);
    setPyqContent(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PYQ & Exam Prep</h1>
          <p className="text-slate-400 text-sm mt-1">AI-generated previous year questions with step-by-step solutions</p>
        </div>
        <button
          onClick={() => setShowApiModal(true)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-slate-300 text-sm font-medium transition-colors"
        >
          <Settings className="w-4 h-4" /> API Key
        </button>
      </div>

      <ApiKeyModal open={showApiModal} onClose={() => setShowApiModal(false)} />

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Generate form */}
      <form onSubmit={handleGenerate} className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 space-y-4">
        <div className="flex items-center gap-2 text-emerald-400 mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="font-medium">Generate Previous Year Questions for any subject & exam</span>
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
              placeholder="e.g. Data Structures, Thermodynamics..."
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Exam Type</label>
            <select
              value={form.examType}
              onChange={(e) => setForm({ ...form, examType: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
            >
              {EXAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Units (optional)</label>
            <input
              type="text"
              value={form.units}
              onChange={(e) => setForm({ ...form, units: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
              placeholder="e.g. Unit 1-5, All units..."
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Language (optional)</label>
            <input
              type="text"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
              placeholder="e.g. English, Hindi..."
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate PYQs
        </button>
      </form>

      {/* Generating progress */}
      {generating && (
        <div className="p-8 rounded-2xl bg-slate-900/50 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <FileQuestion className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-emerald-400">Generating Previous Year Questions</p>
              <p className="text-sm text-slate-400">AI is creating 10 PYQs with step-by-step solutions for {form.subject}</p>
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

      {/* Saved PYQs list */}
      {savedPyqs.length > 0 && !pyqContent && !generating && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" /> Previously Generated
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedPyqs.map((pyq) => (
              <button
                key={pyq.id}
                onClick={() => viewSavedPyq(pyq)}
                className="text-left p-4 rounded-xl bg-slate-900/50 border border-white/5 hover:border-emerald-500/30 transition-all"
              >
                <p className="font-medium truncate">{pyq.title}</p>
                <p className="text-sm text-slate-400 mt-0.5">{new Date(pyq.created_at).toLocaleDateString()}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pyq.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-slate-800 text-xs text-slate-400">{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PYQ content display */}
      {(pyqContent || selectedPyq) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {selectedPyq ? selectedPyq.title : `${form.subject} — ${form.examType} PYQs`}
            </h2>
            <button
              onClick={exportPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Exporting...' : 'Download Exam Paper PDF'}
            </button>
          </div>
          <div ref={contentRef} className="p-6 rounded-2xl bg-slate-900/50 border border-white/5">
            <MarkdownRenderer content={selectedPyq ? selectedPyq.content : (pyqContent || '')} />
          </div>
        </div>
      )}
    </div>
  );
}
