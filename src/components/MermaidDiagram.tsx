import { Component, Suspense, lazy, type ReactNode } from 'react';

const MermaidRenderer = lazy(() => import('@/components/MermaidRenderer'));

type DiagramBoundaryState = { hasError: boolean; code: string };

class DiagramErrorBoundary extends Component<{ code: string; children: ReactNode }, DiagramBoundaryState> {
  constructor(props: { code: string; children: ReactNode }) {
    super(props);
    this.state = { hasError: false, code: props.code };
  }

  static getDerivedStateFromError(): DiagramBoundaryState {
    return { hasError: true, code: '' };
  }

  componentDidCatch(): void {
    this.setState({ code: this.props.code });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="my-4 rounded-xl bg-slate-950 border border-red-500/20 overflow-hidden">
          <div className="px-4 py-2 bg-red-500/10 text-xs text-red-400 font-medium border-b border-red-500/20">
            Diagram rendering failed — showing source
          </div>
          <pre className="p-4 overflow-x-auto text-xs text-slate-300 font-mono leading-relaxed">
            <code>{this.props.code}</code>
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function MermaidDiagram({ code }: { code: string }) {
  return (
    <DiagramErrorBoundary code={code}>
      <Suspense
        fallback={
          <div className="my-4 p-4 rounded-xl bg-slate-950 border border-white/10 flex items-center gap-2 text-slate-500 text-sm">
            <span className="typing-dot w-2 h-2 rounded-full bg-emerald-400" />
            <span className="typing-dot w-2 h-2 rounded-full bg-emerald-400" />
            <span className="typing-dot w-2 h-2 rounded-full bg-emerald-400" />
            <span className="ml-2">Loading diagram renderer...</span>
          </div>
        }
      >
        <MermaidRenderer code={code} />
      </Suspense>
    </DiagramErrorBoundary>
  );
}
