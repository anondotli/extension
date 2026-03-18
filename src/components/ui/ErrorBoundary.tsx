import { Component } from "preact";
import type { ComponentChildren } from "preact";

interface Props {
  children: ComponentChildren;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center bg-background">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" className="text-muted-foreground">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="text-sm font-medium text-foreground">Something went wrong</p>
            <p className="text-xs text-muted-foreground mt-1">An unexpected error occurred</p>
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="h-8 px-4 text-xs font-medium rounded-md bg-primary text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
