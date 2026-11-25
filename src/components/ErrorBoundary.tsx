import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

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
      message: error?.message || 'حدث خطأ غير متوقع في التطبيق.',
    };
  }

  componentDidCatch(error: Error): void {
    console.error('App ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-6"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#111827] border border-rose-500/40 p-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-slate-100">
              حدث خطأ غير متوقع أثناء التشغيل
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              بيانات مشاريعك محفوظة بأمان على جهازك. يمكنك إعادة تحميل التطبيق للمتابعة.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>إعادة تحميل التطبيق</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
