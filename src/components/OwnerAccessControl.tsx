import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Lock,
  LogOut,
  Power,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  AppAccessState,
  MAX_PAUSE_MESSAGE_LENGTH,
  setRemoteAppStatus,
  signInOwnerWithGoogle,
  signOutOwner,
} from '../services/firebaseService';

interface OwnerControlBarProps {
  accessState: AppAccessState;
  onStatusChanged: (msg: string) => void;
}

export const OwnerControlBar: React.FC<OwnerControlBarProps> = ({
  accessState,
  onStatusChanged,
}) => {
  const [busy, setBusy] = useState(false);
  const [editMessageOpen, setEditMessageOpen] = useState(false);
  const [draftMessage, setDraftMessage] = useState(accessState.pauseMessage);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleToggleApp = async () => {
    setBusy(true);
    setErrorText(null);
    try {
      const nextActive = !accessState.isActive;
      await setRemoteAppStatus(nextActive, draftMessage || accessState.pauseMessage);
      onStatusChanged(
        nextActive
          ? 'تم تشغيل المشروع للجميع بنجاح'
          : 'تم إيقاف المشروع عن جميع المستخدمين (باستثناء جهازك)'
      );
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'تعذر تحديث حالة المشروع — تأكد من الاتصال بالإنترنت.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveMessage = async () => {
    setBusy(true);
    setErrorText(null);
    try {
      await setRemoteAppStatus(accessState.isActive, draftMessage);
      setEditMessageOpen(false);
      onStatusChanged('تم حفظ رسالة الإيقاف المخصّصة');
    } catch {
      setErrorText('تعذر حفظ الرسالة — تأكد من الاتصال بالإنترنت.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOutOwner();
    onStatusChanged('تم إخفاء لوحة المالك وتسجيل الخروج');
  };

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        accessState.isActive
          ? 'bg-[#111827] border-emerald-500/40'
          : 'bg-rose-950/35 border-rose-500/60'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              accessState.isActive
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
            }`}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-bold text-slate-100">
                لوحة تحكم المالك (تظهر على جهازك وحسابك فقط)
              </span>
              <span
                className={`text-xs font-semibold ${
                  accessState.isActive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {accessState.isActive
                  ? 'الحالة للرابط المشترك: يعمل للجميع'
                  : 'الحالة للرابط المشترك: متوقف عن الجميع'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              أي تغيير هنا يُطبَّق فورياً على كل من يملك الرابط المشترك للتطبيق
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            disabled={busy}
            onClick={handleToggleApp}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold text-white transition-colors whitespace-nowrap disabled:opacity-50 ${
              accessState.isActive
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            <Power className="h-4 w-4" />
            <span>
              {busy
                ? 'جارٍ التحديث...'
                : accessState.isActive
                ? 'إيقاف المشروع عن الجميع'
                : 'تشغيل المشروع للجميع'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDraftMessage(accessState.pauseMessage);
              setEditMessageOpen((v) => !v);
            }}
            className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-xl border border-slate-700 bg-[#0b0f19] text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors whitespace-nowrap"
          >
            <span>رسالة الإيقاف</span>
            {editMessageOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            title="إخفاء لوحة المالك"
            className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-slate-600 hover:text-slate-100 transition-colors"
            aria-label="إخفاء لوحة المالك"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {errorText && (
        <p className="mt-2.5 text-xs font-medium text-rose-300">{errorText}</p>
      )}

      {editMessageOpen && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-slate-400">
              الرسالة التي تظهر للمستخدمين عند إيقاف التطبيق ({draftMessage.length}/
              {MAX_PAUSE_MESSAGE_LENGTH})
            </label>
            <input
              type="text"
              maxLength={MAX_PAUSE_MESSAGE_LENGTH}
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              className="w-full min-h-[44px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 text-sm text-slate-100 focus:border-cyan-400/70 outline-none"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleSaveMessage}
            className="min-h-[44px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition-colors whitespace-nowrap disabled:opacity-50"
          >
            حفظ الرسالة
          </button>
        </div>
      )}
    </div>
  );
};

interface OwnerLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const OwnerLoginModal: React.FC<OwnerLoginModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const res = await signInOwnerWithGoogle();
    setLoading(false);
    if (res.ok) {
      onSuccess();
      onClose();
    } else {
      setError(res.error || 'تعذر التحقق من صلاحية المالك.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-[#111827] border border-slate-700/80 p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">بوابة تحكم المالك</h3>
              <p className="text-xs text-slate-400">
                تفعيل زر إيقاف وتشغيل المشروع على جهازك فقط
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-slate-300">
          يتم التحقق عبر حساب Google الخاص بمالك التطبيق فقط. بعد تسجيل الدخول مرة واحدة سيظهر
          زر الإيقاف والتشغيل تلقائياً على جهازك فقط دون أن يظهر لأي شخص آخر يملك الرابط.
        </p>

        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/35 px-3.5 py-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleLogin}
          className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white transition-colors disabled:opacity-50"
        >
          {loading ? 'جارٍ التحقق من الحساب...' : 'تسجيل الدخول بحساب Google للمالك'}
        </button>
      </div>
    </div>
  );
};

interface AppPausedScreenProps {
  message: string;
  onSecretOwnerTrigger: () => void;
}

export const AppPausedScreen: React.FC<AppPausedScreenProps> = ({
  message,
  onSecretOwnerTrigger,
}) => {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-[#111827] border border-slate-800 p-8 text-center space-y-4 shadow-2xl">
        <button
          type="button"
          onClick={onSecretOwnerTrigger}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 cursor-default focus:outline-none"
          aria-label="حالة التطبيق"
        >
          <Lock className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-bold text-slate-100">التطبيق متوقف مؤقتاً</h1>
        <p className="text-sm leading-relaxed text-slate-300">{message}</p>
      </div>
    </div>
  );
};
