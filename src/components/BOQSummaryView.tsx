import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Search } from 'lucide-react';
import { Project } from '../types/boq';
import {
  calculateBlockSummary,
  calculateProjectBOQ,
  collectProjectCustomColumns,
  formatNum,
  STANDARD_BOQ_COLUMNS,
} from '../utils/calculations';

interface BOQSummaryViewProps {
  project: Project;
  onExportExcel: () => void;
}

export const BOQSummaryView: React.FC<BOQSummaryViewProps> = ({
  project,
  onExportExcel,
}) => {
  const [search, setSearch] = useState('');
  const [hideZeros, setHideZeros] = useState(true);

  const customCols = useMemo(() => collectProjectCustomColumns(project), [project]);
  const blockSummaries = useMemo(
    () => project.blocks.map((b) => ({ block: b, summary: calculateBlockSummary(b) })),
    [project.blocks]
  );
  const totalBOQ = useMemo(() => calculateProjectBOQ(project), [project]);

  const rows = useMemo(() => {
    const standard = STANDARD_BOQ_COLUMNS.map((c) => ({
      key: c.key as string,
      label: c.label,
      unit: c.unit,
      category: c.category,
      perBlock: blockSummaries.map((bs) => bs.summary.boq[c.key]),
      total: totalBOQ[c.key],
    }));

    const custom = customCols.map((c) => ({
      key: c.key,
      label: c.name,
      unit: c.unit as string,
      category: 'بنود الاحتياط السريعة',
      perBlock: blockSummaries.map((bs) => bs.summary.boq.custom[c.key] || 0),
      total: totalBOQ.custom[c.key] || 0,
    }));

    return [...standard, ...custom].filter((row) => {
      if (hideZeros && row.total <= 0) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          row.label.toLowerCase().includes(q) || row.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [blockSummaries, customCols, totalBOQ, hideZeros, search]);

  const totalSpaces = blockSummaries.reduce((acc, b) => acc + b.summary.totalSpacesCount, 0);
  const totalEffectiveRooms = blockSummaries.reduce(
    (acc, b) => acc + b.summary.totalEffectiveRooms,
    0
  );
  const totalArea = blockSummaries.reduce((acc, b) => acc + b.summary.totalFloorArea, 0);

  return (
    <div className="space-y-6">
      {/* Top KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-[#111827] border border-slate-800/90 p-4">
          <span className="text-xs text-slate-400">عدد الكتل / الأبنية</span>
          <div className="mt-1.5 font-num text-2xl font-bold text-slate-100">
            {project.blocks.length}
          </div>
        </div>
        <div className="rounded-2xl bg-[#111827] border border-slate-800/90 p-4">
          <span className="text-xs text-slate-400">إجمالي الفراغات الفعلية</span>
          <div className="mt-1.5 font-num text-2xl font-bold text-cyan-300">
            {totalEffectiveRooms}
            <span className="text-xs font-normal text-slate-500 mr-1.5">
              ({totalSpaces} مدخل)
            </span>
          </div>
        </div>
        <div className="rounded-2xl bg-[#111827] border border-slate-800/90 p-4">
          <span className="text-xs text-slate-400">مجموع مساحات الأرضيات</span>
          <div className="mt-1.5 font-num text-2xl font-bold text-emerald-400">
            {formatNum(totalArea)} <span className="text-xs font-normal text-slate-400">م²</span>
          </div>
        </div>
        <div className="rounded-2xl bg-[#111827] border border-slate-800/90 p-4">
          <span className="text-xs text-slate-400">البنود النشطة بالجدول</span>
          <div className="mt-1.5 font-num text-2xl font-bold text-slate-100">
            {rows.length}
          </div>
        </div>
      </div>

      {/* Filters & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#111827] border border-slate-800/90 p-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في بنود جدول الكميات..."
            className="w-full min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 pr-10 pl-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setHideZeros((v) => !v)}
            className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
              hideZeros
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-[#0b0f19] border-slate-800 text-slate-300'
            }`}
          >
            {hideZeros ? 'عرض البنود النشطة فقط' : 'عرض جميع البنود (شامل الصفرية)'}
          </button>

          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>تصدير Excel RTL</span>
          </button>
        </div>
      </div>

      {/* BOQ Table */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0b0f19]/80 text-xs font-semibold text-slate-400">
                <th className="py-3.5 px-4 w-12">م</th>
                <th className="py-3.5 px-4 min-w-[200px]">اسم البند</th>
                <th className="py-3.5 px-4 w-20">الوحدة</th>
                {blockSummaries.map(({ block }) => (
                  <th key={block.id} className="py-3.5 px-4 min-w-[130px] text-left">
                    {block.name}
                  </th>
                ))}
                <th className="py-3.5 px-4 min-w-[140px] text-left text-emerald-400">
                  الإجمالي الكلي
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4 + blockSummaries.length}
                    className="py-12 text-center text-slate-400"
                  >
                    لا توجد كميات مطابقة — أدخل أبعاد الفراغات في شاشة المسح الميداني لظهور جدول الكميات.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={row.key}
                    className="hover:bg-slate-800/35 transition-colors"
                  >
                    <td className="py-3 px-4 font-num text-xs text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-100">{row.label}</div>
                      <div className="text-[11px] text-slate-500">{row.category}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">{row.unit}</td>
                    {row.perBlock.map((val, bIdx) => (
                      <td
                        key={blockSummaries[bIdx].block.id}
                        className="py-3 px-4 text-left font-num text-slate-300"
                      >
                        {val > 0 ? formatNum(val) : '—'}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-left font-num font-bold text-emerald-400">
                      {formatNum(row.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Site & Block Notes Recap */}
      {(project.generalNotes.trim() ||
        project.blocks.some((b) => b.generalNotes.trim())) && (
        <div className="rounded-2xl bg-[#111827] border border-slate-800/90 p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-200">ملخص الملاحظات الهندسية</h4>
          {project.generalNotes.trim() && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-cyan-400">ملاحظات عامة للموقع ككل</div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {project.generalNotes}
              </p>
            </div>
          )}
          {project.blocks
            .filter((b) => b.generalNotes.trim())
            .map((b) => (
              <div key={b.id} className="pt-3 border-t border-slate-800/70 space-y-1">
                <div className="text-xs font-semibold text-emerald-400">
                  ملاحظات البناء: {b.name}
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {b.generalNotes}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
