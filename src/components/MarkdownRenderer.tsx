import { useEffect, useRef, useState, type ReactNode } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';
import { MermaidDiagram } from '@/components/MermaidDiagram';

function renderMath(html: string): string {
  return html
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
      try {
        return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return `<span class="text-red-400">[math error]</span>`;
      }
    })
    .replace(/\$([^\n$]+?)\$/g, (_, expr) => {
      try {
        return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return `<span class="text-red-400">[math error]</span>`;
      }
    });
}

function highlightCode(html: string): string {
  return html.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, (_, lang, code) => {
    if (lang === 'mermaid') return code;
    const decoded = code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    try {
      const highlighted = hljs.highlight(decoded, { language: lang }).value;
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
    } catch {
      const highlighted = hljs.highlightAuto(decoded).value;
      return `<pre><code class="hljs">${highlighted}</code></pre>`;
    }
  });
}

type DiagramBlock = { id: string; code: string };

function extractMermaidBlocks(content: string): { textParts: string[]; diagrams: DiagramBlock[] } {
  const diagrams: DiagramBlock[] = [];
  const parts: string[] = [];
  let lastIndex = 0;
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    parts.push(content.slice(lastIndex, match.index));
    const id = `mermaid-block-${diagrams.length}`;
    diagrams.push({ id, code: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  parts.push(content.slice(lastIndex));
  return { textParts: parts, diagrams };
}

export function MarkdownRenderer({ content }: { content: string }) {
  const [htmlParts, setHtmlParts] = useState<string[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramBlock[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { textParts, diagrams } = extractMermaidBlocks(content);
    setDiagrams(diagrams);

    const htmlSegments = textParts.map((text) => {
      const raw = marked.parse(text, { breaks: true, gfm: true }) as string;
      const withMath = renderMath(raw);
      return highlightCode(withMath);
    });
    setHtmlParts(htmlSegments);
  }, [content]);

  const segments: ReactNode[] = [];
  for (let i = 0; i < htmlParts.length; i++) {
    segments.push(<div key={`text-${i}`} dangerouslySetInnerHTML={{ __html: htmlParts[i] }} />);
    if (i < diagrams.length) {
      const d = diagrams[i];
      segments.push(<MermaidDiagram key={`diagram-${d.id}`} code={d.code} />);
    }
  }

  return (
    <div ref={containerRef} className="markdown-body text-sm text-slate-200 leading-relaxed">
      {segments}
    </div>
  );
}

export function MarkdownRendererSafe({ content }: { content: string }): ReactNode {
  return <MarkdownRenderer content={content} />;
}
