import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error.message || "알 수 없는 오류";
    return (
      <div className="flex h-full flex-col items-center justify-center bg-ink px-6 text-center">
        <p className="text-xs tracking-wide text-accent">VOLLEYBALL PLAYBOOK</p>
        <h1 className="mt-3 text-xl font-semibold">화면을 표시하지 못했습니다</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
          전술은 이 기기에 남아 있습니다. 앱을 다시 열면 홈으로 돌아갑니다.
        </p>
        <p className="mt-4 max-w-sm break-words text-xs text-white/35">{message}</p>
        <button
          type="button"
          className="mt-8 w-full max-w-xs rounded-xl bg-accent py-3 font-semibold text-ink"
          onClick={() => window.location.reload()}
        >
          앱 다시 열기
        </button>
      </div>
    );
  }
}
