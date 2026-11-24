import React, { useMemo, useState } from 'react';
import { Calculator, FileSpreadsheet, Search } from 'lucide-react';
import { Project } from '../types/boq';
import {
  calculateBlockSummary,
  calculateBOQCost,
  calculateProjectBOQ,
  collectProjectCustomColumns,
  formatNum,
  safeNum,
  STANDARD_BOQ_COLUMNS,
} from '../utils/calculations';
import { NumericInput } from './NumericInput';

interface PricingViewProps {
  project: Project;
  onUpdateUnitPrice: (key: string, price: number) => void;
  onUpdateCurrency: (currency: string) => void;
  onExportExcel: () => void;
}

const CURRENCIES = ['USD', 'SAR', 'AED', 'JOD', 'SYP', 'EGP', 'EUR'];

export const PricingView: React.FC<PricingViewProps> = ({
  project,
  onUpdateUnitPrice,
  onUpdateCurrency,
  onExportExcel,
}) => {
  const [onlyActive, setOnlyActive] = useState(true);
  const [search, setSearch] = useState('');

  const customCols = useMemo(() => collectProjectCustomColumns(project), [project]);
  const projectBOQ = useMemo(() => calculateProjectBOQ(project), [project]);

  const blockCosts = useMemo(
    () =>
      project.blocks.map((block) => {
        const sum = calculateBlockSummary(block);
        const cost = calculateBOQCost(sum.boq, project.unitPrices, customCols);
        return { block, cost };
      }),
    [project.blocks, project.unitPrices, customCols]
  );

  const grandTotalCost = useMemo(
    () => calculateBOQCost(projectBOQ, project.unitPrices, customCols),
    [projectBOQ, project.unitPrices, customCols]
  );

  const items = useMemo(() => {
    const std = STANDARD_BOQ_COLUMNS.map((c) => ({
      key: c.key as string,
      label: c.label,
      unit: c.unit,
      category: c.category,
      qty: projectBOQ[c.key],
    }));
    const cst = customCols.map((c) => ({
      key: c.key,
      label: c.name,
      unit: c.unit as string,
      category: 'بنود الاحتياط السريعة',
      qty: projectBOQ.custom[c.key] || 0,
    }));
    return [...std, ...cst].filter((it) => {
      if (onlyActive && it.qty <= 0) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return it.label.toLowerCase().includes(q) || it.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [projectBOQ, customCols, onlyActive, search]);

  return (
    <div className="space-y-6">
      {/* Header + Total Cost Summary */}
      <div className="rounded-2xl bg-[#111827] border border-emerald-500/35 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                الأسعار الإفرادية والتكلفة التقديرية (اختياري)
              </h2>
              <p className="text-xs text-slate-400">
                تُدرج الأسعار الإفرادية تلقائياً في ورقة «الخلاصة الإجمالية» داخل ملف Excel
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">العملة:</label>
              <select
                value={project.currency || 'USD'}
                onChange={(e) => onUpdateCurrency(e.target.value)}
                className="min-h-[40px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3 text-xs font-semibold text-slate-100 outline-none focus:border-emerald-400/70"
              >
                {CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-left">
              <div className="text-xs text-slate-400">التكلفة الإجمالية للمشروع</div>
              <div className="font-num text-2xl font-bold text-emerald-400">
                {formatNum(grandTotalCost)}{' '}
                <span className="text-xs font-semibold text-slate-400">
                  {project.currency || 'USD'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Per-block estimated cost breakdown */}
        {blockCosts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {blockCosts.map(({ block, cost }) => (
              <div
                key={block.id}
                className="flex items-center justify-between rounded-xl bg-[#0b0f19] border border-slate-800 px-3.5 py-2.5"
              >
                <span className="text-xs font-medium text-slate-300 truncate">{block.name}</span>
                <span className="font-num text-sm font-semibold text-cyan-300 shrink-0 mr-2">
                  {formatNum(cost)} {project.currency || 'USD'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search, Filter Toggle & Excel Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#111827] border border-slate-800/90 p-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في بنود التسعير..."
            className="w-full min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 pr-10 pl-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setOnlyActive((v) => !v)}
            className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
              onlyActive
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-[#0b0f19] border-slate-800 text-slate-300'
            }`}
          >
            {onlyActive ? 'البنود ذات الكميات فقط' : 'جميع البنود (شامل الصفرية)'}
          </button>

          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>تصدير ملف Excel</span>
          </button>
        </div>
      </div>

      {/* Pricing Table */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0b0f19]/80 text-xs font-semibold text-slate-400">
                <th className="py-3.5 px-4 w-12">م</th>
                <th className="py-3.5 px-4 min-w-[200px]">البند</th>
                <th className="py-3.5 px-4 w-20">الوحدة</th>
                <th className="py-3.5 px-4 w-32 text-left">الكمية الكلية</th>
                <th className="py-3.5 px-4 w-44">السعر الإفرادي</th>
                <th className="py-3.5 px-4 w-40 text-left text-emerald-400">القيمة الإجمالية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    لا توجد بنود بكميات حالياً — بدّل الفلتر لعرض جميع البنود أو أدخل قياسات في المسح الميداني.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const unitPrice = safeNum(project.unitPrices[item.key]);
                  const lineTotal = item.qty * unitPrice;
                  return (
                    <tr key={item.key} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-num text-xs text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100">{item.label}</div>
                        <div className="text-[11px] text-slate-500">{item.category}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">{item.unit}</td>
                      <td className="py-3 px-4 text-left font-num font-semibold text-slate-200">
                        {formatNum(item.qty)}
                      </td>
                      <td className="py-2.5 px-4">
                        <NumericInput
                          value={unitPrice}
                          onChange={(v) => onUpdateUnitPrice(item.key, v)}
                          unit={project.currency || 'USD'}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-3 px-4 text-left font-num font-bold text-emerald-400">
                        {lineTotal > 0 ? formatNum(lineTotal) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
