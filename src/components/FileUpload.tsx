import { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { extractFileContent, type ExtractedFile } from '@/lib/fileExtract';

export function FileUpload({
  onFileExtracted,
  label = 'Upload Syllabus or Exam Paper',
  accept = '.pdf,.txt,.md,text/plain,application/pdf',
}: {
  onFileExtracted: (file: ExtractedFile) => void;
  label?: string;
  accept?: string;
}) {
  const [extracting, setExtracting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setExtracting(true);
    try {
      const extracted = await extractFileContent(file);
      onFileExtracted(extracted);
    } catch {
      setError('Failed to read file. Please try a different file.');
    } finally {
      setExtracting(false);
    }
  }

  function clear() {
    setFileName('');
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFile}
        className="hidden"
      />
      {!fileName ? (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={extracting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/15 hover:border-emerald-500/40 text-slate-400 hover:text-emerald-400 text-sm transition-colors disabled:opacity-50"
        >
          {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {extracting ? 'Extracting text...' : label}
        </button>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900/50 border border-white/10">
          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm text-slate-300 truncate flex-1">{fileName}</span>
          {extracting && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
          <button onClick={clear} className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}
