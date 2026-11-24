import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 min-h-[40px] rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4" />
        <span>تثبيت التطبيق</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-2 min-h-[40px] rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-4 w-4" />
          <span>تثبيت على iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#111827] border border-slate-700/80 p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-100">
                  تثبيت التطبيق على iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="font-num text-cyan-400 font-semibold">1.</span>
                  <span>
                    اضغط على زر <strong>المشاركة</strong>{' '}
                    <Share className="inline h-4 w-4 text-cyan-400 mx-0.5" /> في شريط Safari السفلي.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-num text-cyan-400 font-semibold">2.</span>
                  <span>
                    مرّر للأسفل واختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-num text-cyan-400 font-semibold">3.</span>
                  <span>سيعمل التطبيق لاحقاً بدون إنترنت بشكل كامل.</span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                حسناً
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-[#111827]/95 backdrop-blur px-3.5 py-2 text-xs font-medium text-amber-300 shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>وضع عدم الاتصال — يتم الحفظ محلياً تلقائياً</span>
    </div>
  );
};
