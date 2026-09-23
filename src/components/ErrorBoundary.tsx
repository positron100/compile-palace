import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Root cause of the "blank screen after joining a room, needs reload"
 * report: the app had ZERO error boundaries anywhere (verified via repo-wide
 * search). React's default behavior on an uncaught render/commit-phase error
 * is to unmount the entire tree -> blank page, recoverable only by a full
 * reload -- exactly the reported symptom. This is especially reachable
 * during the Room -> Editor navigation, which renders the destination route
 * synchronously inside `flushSync` (stageTransition.ts, for the View
 * Transition API), so any error thrown during that render (a still-settling
 * profile/room-state read, a `<Navigate>` fired mid-flush, etc.) has no
 * boundary anywhere above it to stop the collapse.
 *
 * This does not silence or paper over that error -- it's logged to the
 * console -- it converts "silently blank, must reload" into "visible,
 * dismissable, one-click recoverable", which is React's own prescribed
 * pattern for this exact failure class.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Unhandled render error, caught by ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center space-y-4">
            <p className="text-lg font-medium">Something went wrong.</p>
            <button
              type="button"
              className="cp-accent-bg px-4 py-2 rounded-full text-sm font-medium"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
