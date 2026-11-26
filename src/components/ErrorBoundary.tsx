import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan pada antarmuka Nocty.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0B0F] text-[#F4F4F6] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#121218] border border-white/[0.08] p-6 text-center space-y-4">
            <h1 className="font-display text-xl font-bold text-white">
              Noct<span className="text-neon-gradient">y</span> mengalami kendala
            </h1>
            <p className="text-sm text-[#9499A6]">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#0B0B0F] bg-neon-gradient hover:brightness-110 transition-all"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={2} />
              <span>Muat Ulang Nocty</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
