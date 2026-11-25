import React, { useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Layers,
  LayoutGrid,
  Search,
  Table2,
} from 'lucide-react';
import { Block, BOQQuantities, Project } from '../types/boq';
import {
  calcCustomItemQty,
  calculateBlockSummary,
  calculateProjectBOQ,
  calculateSpace,
  collectProjectCustomColumns,
  customItemKey,
  formatNum,
  isBathroomSpaceType,
  safeNum,
  SPACE_TYPE_META,
  STANDARD_BOQ_COLUMNS,
} from '../utils/calculations';

interface BOQSummaryViewProps {
  project: Project;
  onExportExcel: () => void;
}

interface ActiveItemEntry {
  key: string;
  label: string;
  value: number;
  unit: string;
  category: string;
  isCustom?: boolean;
}

function extractActiveItems(
  boq: BOQQuantities,
  customCols: { key: string; name: string; unit: string }[]
): ActiveItemEntry[] {
  const items: ActiveItemEntry[] = [];

  for (const col of STANDARD_BOQ_COLUMNS) {
    const val = boq[col.key];
    if (val > 0) {
      items.push({
        key: col.key,
        label: col.label,
        value: val,
        unit: col.unit,
        category: col.category,
      });
    }
  }

  for (const cc of customCols) {
    const val = boq.custom[cc.key] || 0;
    if (val > 0) {
      items.push({
        key: cc.key,
        label: cc.name,
        value: val,
        unit: cc.unit,
        category: 'بنود الاحتياط السريعة',
        isCustom: true,
      });
    }
  }

  return items;
}

function extractBlockGeneralWorks(
  block: Block,
  summaryBoq: BOQQuantities
): ActiveItemEntry[] {
  const items: ActiveItemEntry[] = [];
  if (summaryBoq.roofWaterproofing > 0) {
    items.push({
      key: 'roofWaterproofing',
      label: 'عزل أسطح',
      value: summaryBoq.roofWaterproofing,
      unit: 'م²',
      category: 'أعمال الكتلة العامة',
    });
  }
  if (summaryBoq.roofTiles > 0) {
    items.push({
      key: 'roofTiles',
      label: 'قرميد',
      value: summaryBoq.roofTiles,
      unit: 'م²',
      category: 'أعمال الكتلة العامة',
    });
  }
  if (summaryBoq.tyrolean > 0) {
    items.push({
      key: 'tyrolean',
      label: 'رشة تيرولية',
      value: summaryBoq.tyrolean,
      unit: 'م²',
      category: 'أعمال الكتلة العامة',
    });
  }
  for (const ci of block.generalWorks.customItems) {
    const qty = calcCustomItemQty(ci);
    if (ci.name.trim() && qty > 0) {
      items.push({
        key: customItemKey(ci.name, ci.unit) + '_' + ci.id,
        label: ci.name.trim(),
        value: qty,
        unit: ci.unit,
        category: 'بنود الاحتياط السريعة',
        isCustom: true,
      });
    }
  }
  return items;
}

export const BOQSummaryView: React.FC<BOQSummaryViewProps> = ({
  project,
  onExportExcel,
}) => {
  const [viewMode, setViewMode] = useState<'breakdown' | 'table'>('breakdown');
  const [search, setSearch] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<string>('all');
  const [hideZeros, setHideZeros] = useState(true);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});

  const customCols = useMemo(() => collectProjectCustomColumns(project), [project]);
  const blockSummaries = useMemo(
    () => project.blocks.map((b) => ({ block: b, summary: calculateBlockSummary(b) })),
    [project.blocks]
  );
  const totalBOQ = useMemo(() => calculateProjectBOQ(project), [project]);

  const grandActiveItems = useMemo(
    () => extractActiveItems(totalBOQ, customCols),
    [totalBOQ, customCols]
  );

  // Combined engineering quick totals (e.g. total paint = walls + ceilings)
  const totalPaintArea = totalBOQ.wallPaint + totalBOQ.ceilingPaint;
  const totalCeramicArea =
    totalBOQ.wallCeramic + totalBOQ.floorCeramic + totalBOQ.ceilingCeramic;
  const totalMasonryArea = totalBOQ.block20 + totalBOQ.block15 + totalBOQ.block10;

  const totalSpaces = blockSummaries.reduce((acc, b) => acc + b.summary.totalSpacesCount, 0);
  const totalEffectiveRooms = blockSummaries.reduce(
    (acc, b) => acc + b.summary.totalEffectiveRooms,
    0
  );
  const totalArea = blockSummaries.reduce((acc, b) => acc + b.summary.totalFloorArea, 0);

  const normalizedSearch = search.trim().toLowerCase();

  // Filtered blocks for hierarchical breakdown
  const filteredBlockSummaries = useMemo(() => {
    return blockSummaries.filter(({ block }) => {
      if (selectedBlockId !== 'all' && block.id !== selectedBlockId) return false;
      return true;
    });
  }, [blockSummaries, selectedBlockId]);

  // Rows for side-by-side comparison table
  const tableRows = useMemo(() => {
    const standard = STANDARD_BOQ_COLUMNS.map((c) => ({
      key: c.key as string,
      label: c.label,
      unit: c.unit,
      category: c.category,
      perBlock: filteredBlockSummaries.map((bs) => bs.summary.boq[c.key]),
      total:
        selectedBlockId === 'all'
          ? totalBOQ[c.key]
          : filteredBlockSummaries.reduce((acc, bs) => acc + bs.summary.boq[c.key], 0),
    }));

    const custom = customCols.map((c) => ({
      key: c.key,
      label: c.name,
      unit: c.unit as string,
      category: 'بنود الاحتياط السريعة',
      perBlock: filteredBlockSummaries.map((bs) => bs.summary.boq.custom[c.key] || 0),
      total:
        selectedBlockId === 'all'
          ? totalBOQ.custom[c.key] || 0
          : filteredBlockSummaries.reduce(
              (acc, bs) => acc + (bs.summary.boq.custom[c.key] || 0),
              0
            ),
    }));

    return [...standard, ...custom].filter((row) => {
      if (hideZeros && row.total <= 0) return false;
      if (normalizedSearch) {
        return (
          row.label.toLowerCase().includes(normalizedSearch) ||
          row.category.toLowerCase().includes(normalizedSearch)
        );
      }
      return true;
    });
  }, [
    filteredBlockSummaries,
    customCols,
    totalBOQ,
    hideZeros,
    normalizedSearch,
    selectedBlockId,
  ]);

  const toggleBlockCollapse = (blockId: string) => {
    setCollapsedBlocks((prev) => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const setAllBlocksCollapsed = (collapsed: boolean) => {
    const next: Record<string, boolean> = {};
    for (const b of project.blocks) {
      next[b.id] = collapsed;
    }
    setCollapsedBlocks(next);
  };

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
            {formatNum(totalArea)}{' '}
            <span className="text-xs font-normal text-slate-400">م²</span>
          </div>
        </div>
        <div className="rounded-2xl bg-[#111827] border border-slate-800/90 p-4">
          <span className="text-xs text-slate-400">البنود النشطة بالموقع</span>
          <div className="mt-1.5 font-num text-2xl font-bold text-slate-100">
            {grandActiveItems.length}
          </div>
        </div>
      </div>

      {/* SECTION A: Grand Totals Overview Cards across the Entire Project */}
      <section className="rounded-2xl bg-[#111827] border border-emerald-500/30 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">
              لوحة التجميع الشاملة — إجمالي جميع البنود في المشروع
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تجميع فوري لكل البنود التي قمت بإدخالها في كامل المشروع (تُحدّث تلقائياً مع كل تعديل)
            </p>
          </div>
          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>تصدير Excel RTL</span>
          </button>
        </div>

        {/* Combined Highlight Totals (Paint, Ceramic, Masonry) */}
        {(totalPaintArea > 0 || totalCeramicArea > 0 || totalMasonryArea > 0) && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-[#0b0f19] border border-slate-800/90 px-4 py-3 text-xs">
            {totalPaintArea > 0 && (
              <div>
                <span className="text-slate-400">إجمالي الدهان الكلي (جدران + أسقف): </span>
                <strong className="font-num text-sm font-bold text-emerald-400">
                  {formatNum(totalPaintArea)}
                </strong>
                <span className="text-slate-400"> م²</span>
              </div>
            )}
            {totalCeramicArea > 0 && (
              <div>
                <span className="text-slate-400">إجمالي السيراميك الكلي (أرضيات + جدران + أسقف): </span>
                <strong className="font-num text-sm font-bold text-cyan-300">
                  {formatNum(totalCeramicArea)}
                </strong>
                <span className="text-slate-400"> م²</span>
              </div>
            )}
            {totalMasonryArea > 0 && (
              <div>
                <span className="text-slate-400">إجمالي بناء البلوك (20 + 15 + 10): </span>
                <strong className="font-num text-sm font-bold text-amber-300">
                  {formatNum(totalMasonryArea)}
                </strong>
                <span className="text-slate-400"> م²</span>
              </div>
            )}
          </div>
        )}

        {grandActiveItems.length === 0 ? (
          <div className="rounded-xl bg-[#0b0f19]/80 border border-slate-800 p-8 text-center text-sm text-slate-400">
            لا توجد كميات مسجّلة حتى الآن — ابدأ بإدخال أبعاد الفراغات في شاشة المسح الميداني.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {grandActiveItems.map((item) => (
              <div
                key={item.key}
                className="rounded-xl bg-[#0b0f19]/90 border border-slate-800/90 px-3.5 py-3 flex flex-col justify-between gap-1.5"
              >
                <div className="text-[11px] text-slate-500 truncate">{item.category}</div>
                <div className="text-xs font-semibold text-slate-200 leading-snug">
                  {item.label}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span
                    className={`font-num text-lg font-bold ${
                      item.isCustom ? 'text-cyan-300' : 'text-emerald-400'
                    }`}
                  >
                    {formatNum(item.value)}
                  </span>
                  <span className="text-xs text-slate-400">{item.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Controls, Search, Block Filter & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#111827] border border-slate-800/90 p-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم البند أو الفراغ..."
              className="w-full min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 pr-10 pl-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 outline-none"
            />
          </div>

          <select
            value={selectedBlockId}
            onChange={(e) => setSelectedBlockId(e.target.value)}
            className="min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 text-xs font-semibold text-slate-200 outline-none focus:border-cyan-400/70"
            aria-label="تصفية حسب البناء"
          >
            <option value="all">كل الأبنية ({project.blocks.length})</option>
            {project.blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[#0b0f19] border border-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewMode('breakdown')}
              className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === 'breakdown'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>تفصيل: فراغ ← بناء ← إجمالي</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === 'table'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              <span>جدول مقارنة الأبنية</span>
            </button>
          </div>

          {viewMode === 'breakdown' && filteredBlockSummaries.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAllBlocksCollapsed(false)}
                className="min-h-[40px] px-3 rounded-xl border border-slate-800 bg-[#0b0f19] text-xs font-medium text-slate-300 hover:border-slate-700 whitespace-nowrap"
              >
                فتح الكل
              </button>
              <button
                type="button"
                onClick={() => setAllBlocksCollapsed(true)}
                className="min-h-[40px] px-3 rounded-xl border border-slate-800 bg-[#0b0f19] text-xs font-medium text-slate-300 hover:border-slate-700 whitespace-nowrap"
              >
                طي الكل
              </button>
            </div>
          )}

          {viewMode === 'table' && (
            <button
              type="button"
              onClick={() => setHideZeros((v) => !v)}
              className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                hideZeros
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-[#0b0f19] border-slate-800 text-slate-300'
              }`}
            >
              {hideZeros ? 'البنود النشطة فقط' : 'جميع البنود (شامل الصفرية)'}
            </button>
          )}
        </div>
      </div>

      {/* SECTION B: Hierarchical Breakdown View (Space -> Block -> Project Grand Total) */}
      {viewMode === 'breakdown' ? (
        <div className="space-y-5">
          {filteredBlockSummaries.map(({ block, summary }) => {
            const isCollapsed = !!collapsedBlocks[block.id];
            const blockActiveItems = extractActiveItems(summary.boq, customCols).filter((item) =>
              normalizedSearch
                ? item.label.toLowerCase().includes(normalizedSearch) ||
                  item.category.toLowerCase().includes(normalizedSearch) ||
                  block.name.toLowerCase().includes(normalizedSearch)
                : true
            );
            const blockGeneralWorks = extractBlockGeneralWorks(block, summary.boq).filter((item) =>
              normalizedSearch
                ? item.label.toLowerCase().includes(normalizedSearch) ||
                  block.name.toLowerCase().includes(normalizedSearch)
                : true
            );

            return (
              <div
                key={block.id}
                className="rounded-2xl bg-[#111827] border border-slate-800/90 overflow-hidden"
              >
                {/* Block Header */}
                <button
                  type="button"
                  onClick={() => toggleBlockCollapse(block.id)}
                  className="w-full flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 bg-[#0b0f19]/65 border-b border-slate-800/80 text-right hover:bg-[#0b0f19]/90 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-slate-100 truncate">
                        {block.name}
                      </h4>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                        <span>{block.floors.length} طوابق</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          <strong className="font-num text-slate-200">
                            {summary.totalEffectiveRooms}
                          </strong>{' '}
                          فراغ فعلي
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          الأرضيات:{' '}
                          <strong className="font-num text-emerald-400">
                            {formatNum(summary.totalFloorArea)}
                          </strong>{' '}
                          م²
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          <strong className="font-num text-cyan-300">
                            {blockActiveItems.length}
                          </strong>{' '}
                          بند نشط
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 shrink-0">
                    <span>{isCollapsed ? 'عرض التفاصيل' : 'إخفاء التفاصيل'}</span>
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="p-4 sm:p-5 space-y-5">
                    {/* Floors & Spaces Breakdown */}
                    {block.floors.map((floor) => {
                      const spaceEntries = floor.spaces
                        .map((sp) => {
                          const calc = calculateSpace(sp);
                          const items = extractActiveItems(calc.boq, customCols);
                          const spaceMatches =
                            !normalizedSearch ||
                            sp.name.toLowerCase().includes(normalizedSearch) ||
                            floor.name.toLowerCase().includes(normalizedSearch) ||
                            block.name.toLowerCase().includes(normalizedSearch) ||
                            items.some(
                              (it) =>
                                it.label.toLowerCase().includes(normalizedSearch) ||
                                it.category.toLowerCase().includes(normalizedSearch)
                            );
                          const visibleItems =
                            normalizedSearch &&
                            !sp.name.toLowerCase().includes(normalizedSearch) &&
                            !floor.name.toLowerCase().includes(normalizedSearch) &&
                            !block.name.toLowerCase().includes(normalizedSearch)
                              ? items.filter(
                                  (it) =>
                                    it.label.toLowerCase().includes(normalizedSearch) ||
                                    it.category.toLowerCase().includes(normalizedSearch)
                                )
                              : items;
                          return { sp, calc, items: visibleItems, matches: spaceMatches };
                        })
                        .filter((entry) => entry.matches);

                      if (spaceEntries.length === 0) return null;

                      return (
                        <div key={floor.id} className="space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                            <Layers className="h-3.5 w-3.5" />
                            <span>{floor.name}</span>
                            <span className="text-slate-500 font-normal">
                              ({spaceEntries.length} فراغ)
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {spaceEntries.map(({ sp, calc, items }) => (
                              <div
                                key={sp.id}
                                className="rounded-xl bg-[#0b0f19]/80 border border-slate-800/90 p-3.5 space-y-2.5"
                              >
                                <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2 border-b border-slate-800/70">
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span className="text-sm font-bold text-slate-100">
                                      {sp.name || 'فراغ بدون اسم'}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                      {SPACE_TYPE_META[sp.spaceType].label}
                                    </span>
                                    {calc.multiplier > 1 && (
                                      <span className="font-num text-xs font-semibold text-cyan-400">
                                        ×{calc.multiplier} متماثل
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 font-num">
                                    {safeNum(sp.length) > 0 || safeNum(sp.width) > 0 ? (
                                      <span>
                                        {formatNum(sp.length)}×{formatNum(sp.width)}×
                                        {formatNum(sp.height)} م
                                      </span>
                                    ) : null}
                                    {isBathroomSpaceType(sp.spaceType) && sp.subRooms.length > 0 && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="text-cyan-400 font-sans">
                                          +{sp.subRooms.length} فراغات فرعية
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {items.length === 0 ? (
                                  <p className="text-xs text-slate-500">
                                    لا توجد كميات محسوبة لهذا الفراغ بعد.
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                    {items.map((it) => (
                                      <div
                                        key={it.key}
                                        className="rounded-lg bg-[#111827] border border-slate-800/80 px-2.5 py-2 flex items-baseline justify-between gap-2"
                                      >
                                        <span className="text-xs text-slate-300 truncate">
                                          {it.label}
                                        </span>
                                        <span className="font-num text-xs font-bold text-emerald-400 whitespace-nowrap">
                                          {formatNum(it.value)}{' '}
                                          <span className="font-sans font-normal text-[11px] text-slate-500">
                                            {it.unit}
                                          </span>
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {sp.note.trim() && (
                                  <div className="text-xs text-slate-400 pt-1">
                                    <span className="text-slate-500">ملاحظة: </span>
                                    {sp.note}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Block-level General Works (Roof, Tiles, Tyrolean, Block Custom Items) */}
                    {blockGeneralWorks.length > 0 && (
                      <div className="rounded-xl bg-[#0b0f19]/80 border border-cyan-500/25 p-3.5 space-y-2.5">
                        <div className="text-xs font-bold text-cyan-300">
                          الأعمال العامة للكتلة (السطح والواجهات وبنود الكتلة الإضافية)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {blockGeneralWorks.map((it) => (
                            <div
                              key={it.key}
                              className="rounded-lg bg-[#111827] border border-slate-800/80 px-2.5 py-2 flex items-baseline justify-between gap-2"
                            >
                              <span className="text-xs text-slate-300 truncate">{it.label}</span>
                              <span className="font-num text-xs font-bold text-cyan-300 whitespace-nowrap">
                                {formatNum(it.value)}{' '}
                                <span className="font-sans font-normal text-[11px] text-slate-500">
                                  {it.unit}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Block Subtotal Footer */}
                    <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/35 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="text-sm font-bold text-emerald-300">
                          إجمالي البناء — {block.name}
                        </h5>
                        <span className="text-xs text-slate-400">
                          مجموع كافة بنود الفراغات وأعمال الكتلة لهذا البناء
                        </span>
                      </div>

                      {blockActiveItems.length === 0 ? (
                        <p className="text-xs text-slate-500">لا توجد بنود نشطة في هذا البناء.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                          {blockActiveItems.map((it) => (
                            <div
                              key={it.key}
                              className="rounded-lg bg-[#0b0f19]/90 border border-emerald-500/20 px-3 py-2 flex flex-col gap-0.5"
                            >
                              <span className="text-[11px] text-slate-400 truncate">
                                {it.label}
                              </span>
                              <span className="font-num text-sm font-bold text-emerald-300">
                                {formatNum(it.value)}{' '}
                                <span className="font-sans text-[11px] font-normal text-slate-400">
                                  {it.unit}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {block.generalNotes.trim() && (
                        <div className="pt-2 border-t border-emerald-500/20 text-xs text-slate-300 whitespace-pre-wrap">
                          <span className="font-semibold text-emerald-400">
                            ملاحظات البناء العامة:{' '}
                          </span>
                          {block.generalNotes}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Final Grand Total Recap at Bottom */}
          {selectedBlockId === 'all' && grandActiveItems.length > 0 && (
            <div className="rounded-2xl bg-[#111827] border border-cyan-500/40 p-5 space-y-4 shadow-[0_0_28px_-14px_rgba(6,182,212,0.35)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-base font-bold text-cyan-300">
                    المجموع النهائي لكامل المشروع ({project.name || 'المشروع الحالي'})
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    إجمالي كافة الأبنية ({project.blocks.length} أبنية · {totalEffectiveRooms} فراغ
                    فعلي)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onExportExcel}
                  className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors whitespace-nowrap"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>تصدير التقرير الكامل Excel</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {grandActiveItems.map((it) => (
                  <div
                    key={it.key}
                    className="rounded-xl bg-[#0b0f19] border border-cyan-500/25 px-3.5 py-2.5 flex flex-col gap-0.5"
                  >
                    <span className="text-xs text-slate-300 truncate">{it.label}</span>
                    <span className="font-num text-base font-bold text-cyan-300">
                      {formatNum(it.value)}{' '}
                      <span className="font-sans text-xs font-normal text-slate-400">
                        {it.unit}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              {project.generalNotes.trim() && (
                <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  <span className="font-semibold text-cyan-400">ملاحظات عامة للموقع ككل: </span>
                  {project.generalNotes}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* SECTION C: Side-by-Side Comparison Matrix Table */
        <div className="rounded-2xl bg-[#111827] border border-slate-800/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0b0f19]/80 text-xs font-semibold text-slate-400">
                  <th className="py-3.5 px-4 w-12">م</th>
                  <th className="py-3.5 px-4 min-w-[200px]">اسم البند</th>
                  <th className="py-3.5 px-4 w-20">الوحدة</th>
                  {filteredBlockSummaries.map(({ block }) => (
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
                {tableRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4 + filteredBlockSummaries.length}
                      className="py-12 text-center text-slate-400"
                    >
                      لا توجد كميات مطابقة — أدخل أبعاد الفراغات في شاشة المسح الميداني لظهور جدول
                      الكميات.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row, idx) => (
                    <tr key={row.key} className="hover:bg-slate-800/35 transition-colors">
                      <td className="py-3 px-4 font-num text-xs text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100">{row.label}</div>
                        <div className="text-[11px] text-slate-500">{row.category}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">{row.unit}</td>
                      {row.perBlock.map((val, bIdx) => (
                        <td
                          key={filteredBlockSummaries[bIdx].block.id}
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
      )}

      {/* Site & Block Notes Recap (when in table view so notes are always accessible) */}
      {viewMode === 'table' &&
        (project.generalNotes.trim() || project.blocks.some((b) => b.generalNotes.trim())) && (
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
