import React, { useEffect, useState } from 'react';
import { AlertTriangle, Archive, ArrowRight, RotateCcw, Trash2, X } from 'lucide-react';
import { Project } from '../types/boq';
import { calculateBlockSummary, formatNum } from '../utils/calculations';

interface ResetProjectModalProps {
  open: boolean;
  currentProject: Project;
  onClose: () => void;
  onArchiveAndStartNew: (nextProjectName: string) => void;
  onResetCurrentOnly: () => void;
}

export const ResetProjectModal: React.FC<ResetProjectModalProps> = ({
  open,
  currentProject,
  onClose,
  onArchiveAndStartNew,
  onResetCurrentOnly,
}) => {
  const [nextName, setNextName] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmWipe(false);
    }
  }, [open]);

  if (!open) return null;

  const blockSummaries = currentProject.blocks.map((b) => calculateBlockSummary(b));
  const totalSpaces = blockSummaries.reduce((acc, s) => acc + s.totalSpacesCount, 0);
  const totalArea = blockSummaries.reduce((acc, s) => acc + s.totalFloorArea, 0);

  const handleClose = () => {
    setConfirmWipe(false);
    onClose();
  };

  const handleArchiveConfirm = () => {
    onArchiveAndStartNew(nextName.trim());
    setNextName('');
    setConfirmWipe(false);
  };

  const handleWipeExecute = () => {
    onResetCurrentOnly();
    setNextName('');
    setConfirmWipe(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#111827] border-t sm:border border-slate-700/80 p-5 sm:p-6 shadow-2xl space-y-5"
      >
        {confirmWipe ? (
          /* Step 2: Confirmation Screen for Option 2 (Wipe Without Saving) */
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-300">
                    تأكيد تصفير المشروع بدون حفظ؟
                  </h3>
                  <p className="text-xs text-slate-400">
                    هذا الإجراء لا يمكن التراجع عنه بعد التأكيد
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-rose-500/[0.08] border border-rose-500/35 p-4 space-y-2 text-sm text-slate-200 leading-relaxed">
              <p>
                هل أنت متأكد من مسح وتصفير المشروع{' '}
                <strong className="text-white">
                  «{currentProject.name || 'مشروع بدون اسم'}»
                </strong>{' '}
                بالكامل دون حفظه في سجل المشاريع؟
              </p>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-rose-200/80 pt-1">
                <span>{currentProject.blocks.length} أبنية</span>
                <span aria-hidden="true">·</span>
                <span>{totalSpaces} فراغ</span>
                <span aria-hidden="true">·</span>
                <span>
                  المساحة:{' '}
                  <strong className="font-num">{formatNum(totalArea)}</strong> م²
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleWipeExecute}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold text-white transition-colors"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span>نعم، تأكيد التصفير والمسح النهائي</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmWipe(false)}
                className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-700 bg-[#0b0f19] hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors"
              >
                <ArrowRight className="h-4 w-4 shrink-0" />
                <span>رجوع إلى الخيارات</span>
              </button>
            </div>
          </div>
        ) : (
          /* Step 1: Main Reset / Start New Project Options */
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    إغلاق وتصفير الملف لبدء مشروع جديد
                  </h3>
                  <p className="text-xs text-slate-400">
                    اختر حفظ المشروع الحالي في السجل أو التصفير المباشر
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current Project Snapshot */}
            <div className="rounded-xl bg-[#0b0f19] border border-slate-800 p-3.5 text-xs space-y-1">
              <div className="text-slate-400">المشروع المفتوح حالياً:</div>
              <div className="text-sm font-bold text-slate-100">
                {currentProject.name || 'مشروع بدون اسم'}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 text-slate-400 pt-0.5">
                <span>{currentProject.blocks.length} أبنية</span>
                <span aria-hidden="true">·</span>
                <span>{totalSpaces} فراغ</span>
                <span aria-hidden="true">·</span>
                <span>
                  المساحة:{' '}
                  <strong className="font-num text-emerald-400">
                    {formatNum(totalArea)}
                  </strong>{' '}
                  م²
                </span>
              </div>
            </div>

            {/* Optional Name for the Fresh Project */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                اسم المشروع الجديد (اختياري)
              </label>
              <input
                type="text"
                value={nextName}
                onChange={(e) => setNextName(e.target.value)}
                placeholder="مثال: مشروع تأهيل مدرسة الأمل..."
                className="w-full min-h-[44px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>

            {/* Recommended Safe Choice vs Wipe Choice (with 2-step confirmation) */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleArchiveConfirm}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-[0_0_20px_-6px_rgba(16,185,129,0.65)] transition-colors"
              >
                <Archive className="h-4 w-4 shrink-0" />
                <span>حفظ الحالي في سجل المشاريع + تصفير لبدء جديد</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmWipe(true)}
                className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-300 transition-colors"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span>تصفير وتفريغ المشروع الحالي فقط بدون حفظه في السجل</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full min-h-[42px] rounded-xl border border-slate-800 text-xs font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
