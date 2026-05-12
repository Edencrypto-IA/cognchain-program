'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ForgeErrorBoundaryState {
  hasError: boolean;
}

export class ForgeErrorBoundary extends Component<{ children: ReactNode }, ForgeErrorBoundaryState> {
  state: ForgeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ForgeErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Forge] isolated boundary caught error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-[#050505] p-6 text-white">
          <div className="max-w-md rounded-3xl border border-red-400/20 bg-red-400/[0.06] p-6 text-center">
            <AlertTriangle className="mx-auto size-8 text-red-300" />
            <h1 className="mt-4 text-xl font-semibold">Forge paused safely</h1>
            <p className="mt-2 text-sm leading-6 text-white/50">
              The isolated Forge workspace hit a client error. The main CongChain chat, Memory Brain, and Solana flows are untouched.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm text-white/70"
            >
              Retry Forge
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
