import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useStore } from "@/lib/storage";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const setMenu = useStore((s) => s.setMenu);
  return (
    <div className="card p-5 mt-6 space-y-3">
      <h2 className="display text-lg font-semibold">Something broke</h2>
      <p className="text-sm text-muted">{error.message || "Unknown error."}</p>
      <div className="flex gap-2">
        <button
          onClick={() => {
            setMenu(null);
            onReset();
          }}
          className="btn-primary flex-1"
        >
          Clear menu & reload
        </button>
        <button onClick={onReset} className="btn-ghost flex-1">
          Try again
        </button>
      </div>
    </div>
  );
}
