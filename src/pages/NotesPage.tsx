import { useEffect, useRef, useState } from 'react';
import { NotebookPen, Plus, Trash2, Loader2, Sparkles, Search, FileText, Tag, Download, Settings, AlertCircle, Check, BookOpen, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Note } from '@/lib/supabase';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { FileUpload } from '@/components/FileUpload';
import { getApiKey, hasApiKey, SUPABASE_FUNCTION_URL } from '@/lib/apiKey';
import type { ExtractedFile } from '@/lib/fileExtract';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const PROGRESS_STEPS = [
  'Analyzing Syllabus...',
  'Drafting Key Concepts...',
  'Structuring Sections...',
  'Formatting PDF Layout...',
];

const DETAIL_OPTIONS = [
  { value: 'brief', label: 'Quick Exam Revision' },
  { value: 'intermediate', label: 'Unit-Wise Deep Dive' },
  { value: 'detailed', label: 'Interview Questions' },
];

export default function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const noteContentRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    subject: '',
    topic: '',
    detail: 'intermediate',
    language: '',
  });

  useEffect(() => {
    load();
  }, [user]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setNotes((data as Note[]) || []);
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
    }, 1500);

    try {
      const response = await fetch(`${SUPABASE_FUNCTION_URL}/functions/v1/ai-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          subject: form.subject,
          topic: form.topic,
          detail: DETAIL_OPTIONS.find((d) => d.value === form.detail)?.label || 'Unit-Wise Deep Dive',
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

      const title = `${form.topic || form.subject} — Study Notes`;
      const tags = [form.subject, form.topic, form.detail, 'AI Generated'].filter(Boolean) as string[];

      const { data: noteRow } = await supabase
        .from('notes')
        .insert({
          title,
          subject: form.subject,
          topic: form.topic,
          content,
          summary: content.split('\n').find((l) => l.trim() && !l.startsWith('#')) || `Comprehensive notes on ${form.subject}.`,
          tags,
        })
        .select()
        .single();

      if (noteRow) {
        const note = noteRow as Note;
        await load();
        setSelectedNote(note);
        setShowForm(false);
        setForm({ subject: '', topic: '', detail: 'intermediate', language: '' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate notes');
    } finally {
      clearInterval(stepInterval);
      setProgressStep(0);
      setGenerating(false);
    }
  }

  async function deleteNote(note: Note) {
    await supabase.from('notes').delete().eq('id', note.id);
    setNotes(notes.filter((n) => n.id !== note.id));
    if (selectedNote?.id === note.id) setSelectedNote(null);
  }

  async function handleFileExtracted(file: ExtractedFile) {
    if (!user) return;
    if (!hasApiKey()) {
      setShowApiModal(true);
      return;
    }

    setShowFileUpload(false);
    setAnalyzingFile(true);
    setError(null);
    setProgressStep(0);

    const stepInterval = setInterval(() => {
      setProgressStep((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, 1500);

    try {
      const response = await fetch(`${SUPABASE_FUNCTION_URL}/functions/v1/ai-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          fileContent: file.content,
          fileName: file.name,
          fileType: file.type,
          apiKey: getApiKey(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Analysis failed (${response.status})`);
      }

      const data = await response.json();
      const content = data.content as string;
      if (!content) throw new Error('No content returned from AI.');

      const title = `Analysis: ${file.name.slice(0, 40)}`;
      const tags = [file.name, 'File Analysis', 'AI Generated'];

      const { data: noteRow } = await supabase
        .from('notes')
        .insert({
          title,
          subject: file.name,
          topic: 'File Analysis',
          content,
          summary: content.split('\n').find((l) => l.trim() && !l.startsWith('#')) || `Analysis of ${file.name}.`,
          tags,
        })
        .select()
        .single();

      if (noteRow) {
        const note = noteRow as Note;
        await load();
        setSelectedNote(note);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    } finally {
      clearInterval(stepInterval);
      setProgressStep(0);
      setAnalyzingFile(false);
    }
  }

  async function exportPDF() {
    if (!selectedNote || !noteContentRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(noteContentRef.current, {
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

      const fileName = `${(selectedNote.subject || 'Study').replace(/[^a-zA-Z0-9]/g, '_')}_Study_Notes.pdf`;
      pdf.save(fileName);
    } catch (err) {
      setError('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.subject.toLowerCase().includes(search.toLowerCase()) ||
      n.topic.toLowerCase().includes(search.toLowerCase()) ||
      n.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="text-slate-400 text-sm mt-1">AI-generated study notes for ANY subject — with PDF export</p>
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
            <Plus className="w-4 h-4" /> Generate Notes
          </button>
          <button
            onClick={() => setShowFileUpload(!showFileUpload)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 hover:border-emerald-500/40 text-slate-300 text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" /> Analyze File
          </button>
        </div>
      </div>

      <ApiKeyModal open={showApiModal} onClose={() => setShowApiModal(false)} />

      {showFileUpload && !analyzingFile && (
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Upload className="w-5 h-5" />
            <span className="font-medium">Upload a syllabus or past exam paper for AI analysis</span>
          </div>
          <p className="text-sm text-slate-400">Upload a PDF or text file. The AI will extract topics, analyze question patterns, and generate model answers.</p>
          <FileUpload onFileExtracted={handleFileExtracted} label="Upload syllabus or exam paper" />
        </div>
      )}

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
              <p className="font-semibold text-emerald-400">Generating Your Notes</p>
              <p className="text-sm text-slate-400">AI is analyzing your subject and creating comprehensive notes</p>
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
            <span className="font-medium">Generate notes for ANY subject with AI</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Subject (any subject) *</label>
              <input
                required
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
                placeholder="e.g. Computer Science, Medicine, Commerce, Arts..."
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Topic (optional)</label>
              <input
                type="text"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
                placeholder="e.g. Data Structures, Cardiology, Taxation..."
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Depth / Purpose</label>
              <select
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
              >
                {DETAIL_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Language (optional)</label>
              <input
                type="text"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
                placeholder="e.g. English, Spanish, Hindi..."
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Generate Notes
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : notes.length === 0 && !generating ? (
        <div className="p-12 rounded-2xl bg-slate-900/50 border border-white/5 text-center">
          <NotebookPen className="w-10 h-10 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No notes yet. Click "Generate Notes" to create AI-powered notes on any subject.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Notes list */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes by subject, topic, tag..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm"
              />
            </div>
            {filtered.map((note) => (
              <div
                key={note.id}
                className={`group p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedNote?.id === note.id
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-slate-900/50 border-white/5 hover:border-white/10'
                }`}
                onClick={() => setSelectedNote(note)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{note.title}</p>
                    <p className="text-sm text-slate-400">{note.subject}{note.topic ? ` · ${note.topic}` : ''}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{new Date(note.created_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNote(note); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {note.tags.slice(0, 4).map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-slate-800 text-xs text-slate-400">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No notes match your search.</p>
            )}
          </div>

          {/* Note detail */}
          <div className="lg:col-span-2">
            {selectedNote ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between no-print">
                  <div>
                    <h2 className="text-xl font-bold">{selectedNote.title}</h2>
                    <p className="text-sm text-slate-400">{selectedNote.subject}{selectedNote.topic ? ` · ${selectedNote.topic}` : ''}</p>
                  </div>
                  <button
                    onClick={exportPDF}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {exporting ? 'Exporting...' : 'Download PDF'}
                  </button>
                </div>
                <div
                  ref={noteContentRef}
                  className="p-6 rounded-2xl bg-slate-900/50 border border-white/5"
                >
                  <MarkdownRenderer content={selectedNote.content} />
                  <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-white/5">
                    {selectedNote.tags.map((tag, i) => (
                      <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-xs text-slate-400">
                        <Tag className="w-3 h-3" /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-2xl bg-slate-900/50 border border-white/5 text-center">
                <FileText className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Select a note to read it, or generate new notes for any subject.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
