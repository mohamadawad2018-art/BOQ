import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CustomItem, CustomItemUnit } from '../types/boq';
import { calcCustomItemQty, createId, CUSTOM_UNITS, formatNum } from '../utils/calculations';
import { NumericInput } from './NumericInput';

interface CustomItemsSectionProps {
  items: CustomItem[];
  onChange: (next: CustomItem[]) => void;
  multiplier?: number;
  title?: string;
}

export const CustomItemsSection: React.FC<CustomItemsSectionProps> = ({
  items,
  onChange,
  multiplier = 1,
  title = 'بنود سريعة للاحتياط',
}) => {
  const addItem = () => {
    const newItem: CustomItem = {
      id: createId('cst'),
      name: '',
      unit: 'م²',
      mode: 'direct',
      directQty: 0,
      length: 0,
      width: 0,
      count: 1,
    };
    onChange([...items, newItem]);
  };

  const updateItem = (id: string, patch: Partial<CustomItem>) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((it) => it.id !== id));
  };

  return (
    <div className="pt-4 border-t border-slate-800/80">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h5 className="text-sm font-semibold text-slate-200">{title}</h5>
          <p className="text-xs text-slate-500">
            يُضاف تلقائياً لإجمالي الكتلة، شاشة الأسعار، وكعمود مستقل في Excel
          </p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>إضافة بند سريع</span>
        </button>
      </div>

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const singleQty = calcCustomItemQty(item);
            const totalQty = singleQty * multiplier;
            return (
              <div
                key={item.id}
                className="rounded-xl bg-[#0b0f19]/80 border border-slate-800 p-3.5 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-400">اسم البند</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, { name: e.target.value })}
                      placeholder="مثال: تأسيس كهرباء / دهان حديد / عزل حمام"
                      className="w-full min-h-[44px] rounded-xl bg-[#111827] border border-slate-700/80 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/20 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-400">الوحدة</label>
                    <select
                      value={item.unit}
                      onChange={(e) =>
                        updateItem(item.id, { unit: e.target.value as CustomItemUnit })
                      }
                      className="w-full min-h-[44px] rounded-xl bg-[#111827] border border-slate-700/80 px-3 text-sm text-slate-100 focus:border-cyan-400/70 outline-none"
                    >
                      {CUSTOM_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-400">طريقة الإدخال</label>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#111827] border border-slate-800 min-h-[44px]">
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { mode: 'direct' })}
                        className={`rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          item.mode === 'direct'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        مباشرة
                      </button>
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { mode: 'dims' })}
                        className={`rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          item.mode === 'dims'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ط×ع×عـ
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                      aria-label="حذف البند"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  {item.mode === 'direct' ? (
                    <NumericInput
                      label="الكمية المباشرة"
                      value={item.directQty}
                      onChange={(v) => updateItem(item.id, { directQty: v })}
                      unit={item.unit}
                      accent="cyan"
                      className="col-span-2"
                    />
                  ) : (
                    <>
                      <NumericInput
                        label="الطول (م)"
                        value={item.length}
                        onChange={(v) => updateItem(item.id, { length: v })}
                        unit="م"
                        accent="cyan"
                      />
                      <NumericInput
                        label="العرض / الارتفاع (م)"
                        value={item.width}
                        onChange={(v) => updateItem(item.id, { width: v })}
                        unit="م"
                        accent="cyan"
                      />
                      <NumericInput
                        label="العدد"
                        value={item.count}
                        onChange={(v) => updateItem(item.id, { count: v })}
                        placeholder="1"
                        accent="cyan"
                      />
                    </>
                  )}

                  <div className="col-span-2 sm:col-span-1 flex flex-col justify-center min-h-[44px] rounded-xl bg-[#111827] border border-slate-800 px-3 py-1.5">
                    <span className="text-[11px] text-slate-500">
                      الإجمالي {multiplier > 1 ? `(×${multiplier})` : ''}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-num text-sm font-semibold text-cyan-300">
                        {formatNum(totalQty)}
                      </span>
                      <span className="text-xs text-slate-400">{item.unit}</span>
                    </div>
                  </div>
                </div>
                {singleQty > 0 && !item.name.trim() && (
                  <p className="text-[11px] font-medium text-amber-400">
                    أدخل اسم البند أعلاه ليُحتسب تلقائياً في الإجمالي وتقرير Excel.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
