import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'monospace',
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
  sequence: { useMaxWidth: true, wrap: true },
  er: { useMaxWidth: true },
});

let idCounter = 0;

export default function MermaidRenderer({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-svg-${idCounter++}`);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const id = idRef.current;
        mermaid.parse(code);
        const result = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setSvg(null);
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="my-4 rounded-xl bg-slate-950 border border-red-500/20 overflow-hidden">
        <div className="px-4 py-2 bg-red-500/10 text-xs text-red-400 font-medium border-b border-red-500/20">
          Diagram syntax error — showing source
        </div>
        <pre className="p-4 overflow-x-auto text-xs text-slate-300 font-mono leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 p-4 rounded-xl bg-slate-950 border border-white/10 flex items-center gap-2 text-slate-500 text-sm">
        <span className="typing-dot w-2 h-2 rounded-full bg-emerald-400" />
        <span className="typing-dot w-2 h-2 rounded-full bg-emerald-400" />
        <span className="typing-dot w-2 h-2 rounded-full bg-emerald-400" />
        <span className="ml-2">Rendering diagram...</span>
      </div>
    );
  }

  return (
    <div className="my-4 p-4 rounded-xl bg-slate-950 border border-white/10 overflow-x-auto">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
