import React from 'react';
import { Archive, Building2, DoorOpen, RotateCcw, Trash2, X } from 'lucide-react';
import { Block, Project, Space, TrashItem } from '../types/boq';

interface TrashDrawerProps {
  open: boolean;
  items: TrashItem[];
  onClose: () => void;
  onRestore: (item: TrashItem) => void;
  onPermanentDelete: (trashId: string) => void;
  onEmptyTrash: () => void;
}

export const TrashDrawer: React.FC<TrashDrawerProps> = ({
  open,
  items,
  onClose,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-full w-full max-w-md flex-col bg-[#111827] border-r border-slate-800 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">
              سلة المحذوفات / التراجع ({items.length})
            </h3>
            <p className="text-xs text-slate-400">
              يمكنك استعادة أي مشروع أو بناء أو فراغ محذوف بنقرة واحدة
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 py-12 px-4 text-center">
              <Trash2 className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-300">سلة المحذوفات فارغة</p>
              <p className="mt-1 text-xs text-slate-500">
                أي مشروع أو بناء أو فراغ يتم حذفه سيُحفظ هنا مؤقتاً للحماية من الحذف غير المقصود.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const title =
                item.kind === 'project'
                  ? (item.data as Project).name || item.projectName || 'مشروع بدون اسم'
                  : item.kind === 'block'
                  ? (item.data as Block).name || 'بناء بدون اسم'
                  : (item.data as Space).name || 'فراغ بدون اسم';
              const deletedTime = new Date(item.deletedAt).toLocaleString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit',
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={item.id}
                  className="rounded-xl bg-[#0b0f19] border border-slate-800 p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 ${
                        item.kind === 'project' ? 'text-emerald-400' : 'text-cyan-400'
                      }`}
                    >
                      {item.kind === 'project' ? (
                        <Archive className="h-4 w-4" />
                      ) : item.kind === 'block' ? (
                        <Building2 className="h-4 w-4" />
                      ) : (
                        <DoorOpen className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-100 truncate">{title}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {item.kind === 'project'
                          ? `مشروع كامل (${(item.data as Project).blocks?.length || 0} أبنية)`
                          : item.kind === 'block'
                          ? 'كتلة / بناء كامل'
                          : `فراغ داخل ${item.blockName} · ${item.floorName || ''}`}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">حُذف في: {deletedTime}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/70">
                    <button
                      type="button"
                      onClick={() => onPermanentDelete(item.id)}
                      className="min-h-[38px] px-3 rounded-lg text-xs font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                    >
                      حذف نهائي
                    </button>
                    <button
                      type="button"
                      onClick={() => onRestore(item)}
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>استعادة</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-slate-800 p-4">
            <button
              type="button"
              onClick={onEmptyTrash}
              className="w-full min-h-[44px] rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
            >
              تفريغ سلة المحذوفات نهائياً
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
