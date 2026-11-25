import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Edit3,
  Layers,
  Minimize2,
  Plus,
  ShieldCheck,
  Table2,
  Trash2,
} from 'lucide-react';
import { Block, Floor, Space, SpaceType } from '../types/boq';
import {
  calculateBlockSummary,
  calculateSpace,
  createId,
  createNewSpace,
  formatNum,
  SPACE_TYPE_META,
  STANDARD_BOQ_COLUMNS,
} from '../utils/calculations';
import { CustomItemsSection } from './CustomItemsSection';
import { NumericInput } from './NumericInput';
import { SpaceEditorCard } from './SpaceEditorCard';

interface BlockCardProps {
  block: Block;
  blockIndex: number;
  projectName?: string;
  onChange: (updated: Block) => void;
  onFinishAndAddNew: () => void;
  onCloseOnly: () => void;
  onCloseProjectAndViewSummary?: () => void;
  onReopen: () => void;
  onDuplicateBlock: () => void;
  onRequestDeleteBlock: () => void;
  onDeleteFloorToTrash: (floor: Floor) => void;
  onDeleteSpaceToTrash: (floorId: string, floorName: string, space: Space) => void;
}

const DEFAULT_FLOOR_NAMES = [
  'طابق أرضي',
  'طابق أول',
  'طابق ثاني',
  'طابق ثالث',
  'طابق رابع',
  'سطح / ملحق',
];

const SPACE_PRESETS: SpaceType[] = [
  'office_dorm',
  'bathrooms',
  'prefab_dorm',
  'prefab_bathrooms',
  'buffet_kitchen',
  'corridor',
  'staircase',
  'custom',
];

export const BlockCard: React.FC<BlockCardProps> = ({
  block,
  blockIndex,
  projectName,
  onChange,
  onFinishAndAddNew,
  onCloseOnly,
  onCloseProjectAndViewSummary,
  onReopen,
  onDuplicateBlock,
  onRequestDeleteBlock,
  onDeleteFloorToTrash,
  onDeleteSpaceToTrash,
}) => {
  const [activeFloorId, setActiveFloorId] = useState<string>(block.floors[0]?.id || '');
  const [newlyAddedSpaceId, setNewlyAddedSpaceId] = useState<string | null>(null);
  const [expandSignal, setExpandSignal] = useState<{ value: boolean; seq: number } | null>(null);
  const [showBlockSummary, setShowBlockSummary] = useState(false);

  const summary = useMemo(() => calculateBlockSummary(block), [block]);
  const gw = block.generalWorks;
  const gwCalc = summary.generalWorks;

  const effectiveActiveFloor: Floor | undefined =
    block.floors.find((f) => f.id === activeFloorId) || block.floors[0];

  const activeFloorArea = useMemo(() => {
    if (!effectiveActiveFloor) return 0;
    return effectiveActiveFloor.spaces.reduce((acc, sp) => {
      const c = calculateSpace(sp);
      return acc + c.singleFloorArea * c.multiplier;
    }, 0);
  }, [effectiveActiveFloor]);

  const activeBlockBOQItems = useMemo(() => {
    return STANDARD_BOQ_COLUMNS.filter((c) => summary.boq[c.key] > 0).map((c) => ({
      key: c.key,
      label: c.label,
      val: formatNum(summary.boq[c.key]),
      unit: c.unit,
    }));
  }, [summary.boq]);

  const updateBlock = (patch: Partial<Block>) => {
    onChange({
      ...block,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateGeneralWorks = (patch: Partial<Block['generalWorks']>) => {
    updateBlock({
      generalWorks: { ...block.generalWorks, ...patch },
    });
  };

  const addFloor = () => {
    const nextIdx = block.floors.length;
    const suggestedName = DEFAULT_FLOOR_NAMES[nextIdx] || `طابق ${nextIdx + 1}`;
    const newFloor: Floor = {
      id: createId('flr'),
      name: suggestedName,
      spaces: [],
    };
    updateBlock({ floors: [...block.floors, newFloor] });
    setActiveFloorId(newFloor.id);
  };

  const renameFloor = (floorId: string, name: string) => {
    updateBlock({
      floors: block.floors.map((f) => (f.id === floorId ? { ...f, name } : f)),
    });
  };

  /**
   * Guaranteed working Add Space inside the Block (auto-creates ground floor if empty,
   * reopens closed block if invoked from closed state, opens the new space expanded and scrolls to it).
   */
  const addSpaceInsideBlock = (presetType: SpaceType = 'office_dorm', targetFloorId?: string) => {
    let floors = block.floors;
    let floorToUse =
      floors.find((f) => f.id === (targetFloorId || effectiveActiveFloor?.id)) || floors[0];

    if (!floorToUse) {
      floorToUse = {
        id: createId('flr'),
        name: 'طابق أرضي',
        spaces: [],
      };
      floors = [floorToUse];
    }

    const defaultLabel = SPACE_TYPE_META[presetType].label;
    const newSpace = createNewSpace(defaultLabel, presetType);

    setActiveFloorId(floorToUse.id);
    setNewlyAddedSpaceId(newSpace.id);

    updateBlock({
      isClosed: false,
      floors: floors.map((f) =>
        f.id === floorToUse.id ? { ...f, spaces: [...f.spaces, newSpace] } : f
      ),
    });
  };

  const updateSpace = (floorId: string, updatedSpace: Space) => {
    updateBlock({
      floors: block.floors.map((f) =>
        f.id === floorId
          ? {
              ...f,
              spaces: f.spaces.map((s) => (s.id === updatedSpace.id ? updatedSpace : s)),
            }
          : f
      ),
    });
  };

  const duplicateSpace = (floorId: string, source: Space) => {
    const cloned: Space = {
      ...JSON.parse(JSON.stringify(source)),
      id: createId('sp'),
      name: `${source.name} (نسخة)`,
    };
    setNewlyAddedSpaceId(cloned.id);
    updateBlock({
      floors: block.floors.map((f) => {
        if (f.id !== floorId) return f;
        const idx = f.spaces.findIndex((s) => s.id === source.id);
        const nextSpaces = [...f.spaces];
        nextSpaces.splice(idx + 1, 0, cloned);
        return { ...f, spaces: nextSpaces };
      }),
    });
  };

  const addFacade = () => {
    const idx = gw.facades.length + 1;
    updateGeneralWorks({
      facades: [
        ...gw.facades,
        { id: createId('fac'), label: `واجهة ${idx}`, length: 0, height: 0 },
      ],
    });
  };

  const updateFacade = (
    id: string,
    patch: Partial<{ label: string; length: number; height: number }>
  ) => {
    updateGeneralWorks({
      facades: gw.facades.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  const removeFacade = (id: string) => {
    updateGeneralWorks({
      facades: gw.facades.filter((f) => f.id !== id),
    });
  };

  // =========================================================================
  // CLOSED / COLLAPSED SUMMARY CARD
  // =========================================================================
  if (block.isClosed) {
    return (
      <section className="rounded-2xl bg-[#111827] border border-slate-800/90 hover:border-emerald-500/40 transition-all p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onReopen}
            className="flex flex-1 min-w-[240px] items-start gap-3.5 text-right group"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                  {blockIndex + 1}. {block.name || 'بناء بدون اسم'}
                </h3>
                <span className="text-xs font-medium text-emerald-400">مغلق / مكتمل</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
                <span>
                  <strong className="font-num text-slate-200">{block.floors.length}</strong> طوابق
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="font-num text-slate-200">{summary.totalSpacesCount}</strong>{' '}
                  مدخل فراغ ({summary.totalEffectiveRooms} غرفة فعلية)
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  إجمالي المساحة:{' '}
                  <strong className="font-num text-emerald-400">
                    {formatNum(summary.totalFloorArea)}
                  </strong>{' '}
                  م²
                </span>
                {summary.boq.wallPaint > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      دهان جدران:{' '}
                      <strong className="font-num text-slate-200">
                        {formatNum(summary.boq.wallPaint)}
                      </strong>{' '}
                      م²
                    </span>
                  </>
                )}
                {summary.boq.plaster > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      طينة:{' '}
                      <strong className="font-num text-slate-200">
                        {formatNum(summary.boq.plaster)}
                      </strong>{' '}
                      م²
                    </span>
                  </>
                )}
              </div>
              {block.generalNotes.trim() && (
                <p className="mt-2 text-xs text-slate-400 line-clamp-1">
                  ملاحظات البناء: {block.generalNotes}
                </p>
              )}
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => addSpaceInsideBlock('office_dorm')}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة فراغ</span>
            </button>
            <button
              type="button"
              onClick={onReopen}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
            >
              <Edit3 className="h-4 w-4" />
              <span>تعديل البناء</span>
            </button>
            <button
              type="button"
              onClick={onDuplicateBlock}
              title="تكرار البناء بالكامل"
              className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
              aria-label="تكرار البناء"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onRequestDeleteBlock}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
              aria-label="حذف البناء"
              title="حذف البناء"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // OPEN / ACTIVE BLOCK WORKSPACE
  // =========================================================================
  return (
    <section className="rounded-2xl bg-[#111827] border border-emerald-500/40 shadow-[0_0_32px_-16px_rgba(16,185,129,0.35)] overflow-hidden">
      {/* Block Header with Direct "+ إضافة فراغ" Button */}
      <div className="border-b border-slate-800/90 bg-slate-900/50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 min-w-[240px] items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-[11px] font-medium text-emerald-400 block mb-1">
                الكتلة / البناء رقم {blockIndex + 1} (قيد المسح)
              </label>
              <input
                type="text"
                value={block.name}
                onChange={(e) => updateBlock({ name: e.target.value })}
                placeholder="مثال: مكاتب + مهاجع، مهجع حراسات..."
                className="w-full min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 text-base font-bold text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => addSpaceInsideBlock('office_dorm')}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-[0_0_16px_-6px_rgba(16,185,129,0.65)] transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة فراغ</span>
            </button>

            <button
              type="button"
              onClick={onDuplicateBlock}
              title="تكرار هذا البناء بالكامل"
              className="inline-flex items-center gap-1.5 min-h-[42px] px-3 rounded-xl border border-slate-800 bg-[#0b0f19] text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors whitespace-nowrap"
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">تكرار البناء</span>
            </button>

            <button
              type="button"
              onClick={onRequestDeleteBlock}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-3 rounded-xl border border-slate-800 bg-[#0b0f19] text-xs font-medium text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-colors whitespace-nowrap"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">حذف البناء</span>
            </button>
          </div>
        </div>

        {/* Live Block Quick Stats Line */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span>
            الطوابق: <strong className="font-num text-slate-200">{block.floors.length}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            الفراغات:{' '}
            <strong className="font-num text-slate-200">{summary.totalSpacesCount}</strong> (
            {summary.totalEffectiveRooms} غرفة فعلية)
          </span>
          <span aria-hidden="true">·</span>
          <span>
            إجمالي مساحة الأرضيات:{' '}
            <strong className="font-num text-emerald-400">
              {formatNum(summary.totalFloorArea)}
            </strong>{' '}
            م²
          </span>
        </div>
      </div>

      {/* Floors Selector Bar */}
      <div className="border-b border-slate-800/80 px-5 py-3.5 bg-[#0b0f19]/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Layers className="h-4 w-4 text-cyan-400 shrink-0" />
            {block.floors.map((floor) => {
              const isSelected = effectiveActiveFloor?.id === floor.id;
              return (
                <button
                  key={floor.id}
                  type="button"
                  onClick={() => setActiveFloorId(floor.id)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300'
                      : 'bg-[#111827] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {floor.name} ({floor.spaces.length})
                </button>
              );
            })}
            <button
              type="button"
              onClick={addFloor}
              className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl border border-dashed border-slate-700 text-xs font-medium text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>إضافة طابق</span>
            </button>
          </div>

          {effectiveActiveFloor && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">
                مساحة الطابق:{' '}
                <strong className="font-num text-cyan-300">{formatNum(activeFloorArea)}</strong> م²
              </span>
              <input
                type="text"
                value={effectiveActiveFloor.name}
                onChange={(e) => renameFloor(effectiveActiveFloor.id, e.target.value)}
                aria-label="تعديل اسم الطابق"
                className="w-36 min-h-[38px] rounded-lg bg-[#0b0f19] border border-slate-800 px-2.5 text-xs font-medium text-slate-200 focus:border-cyan-400/60 outline-none"
              />
              {block.floors.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteFloorToTrash(effectiveActiveFloor)}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-slate-800 text-slate-500 hover:border-rose-500/40 hover:text-rose-400 transition-colors"
                  title="حذف الطابق الحالي"
                  aria-label="حذف الطابق الحالي"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Active Floor Spaces Section */}
      <div className="p-5 space-y-5">
        <div className="space-y-4">
          {/* Quick Add Space Preset Buttons + Expand/Collapse All */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-300 ml-1">
                إضافة فراغ داخل {effectiveActiveFloor?.name || 'البناء'}:
              </span>
              {SPACE_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addSpaceInsideBlock(t)}
                  className="inline-flex items-center gap-1 min-h-[38px] px-3 rounded-xl bg-[#0b0f19] border border-slate-800 text-xs font-medium text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{SPACE_TYPE_META[t].label}</span>
                </button>
              ))}
            </div>

            {effectiveActiveFloor && effectiveActiveFloor.spaces.length > 1 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setExpandSignal((prev) => ({ value: true, seq: (prev?.seq || 0) + 1 }))
                  }
                  className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg border border-slate-800 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  <span>فتح الكل</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExpandSignal((prev) => ({ value: false, seq: (prev?.seq || 0) + 1 }))
                  }
                  className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg border border-slate-800 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                  <span>طي الكل</span>
                </button>
              </div>
            )}
          </div>

          {!effectiveActiveFloor || effectiveActiveFloor.spaces.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0b0f19]/50 py-10 px-6 text-center">
              <p className="text-sm font-medium text-slate-300">
                لا توجد فراغات مسجّلة في {effectiveActiveFloor?.name || 'هذا البناء'} حتى الآن
              </p>
              <p className="mt-1 text-xs text-slate-500">
                اختر نوع الفراغ من الأعلى أو اضغط أدناه لبدء الرفع الميداني مباشرة
              </p>
              <button
                type="button"
                onClick={() => addSpaceInsideBlock('office_dorm')}
                className="mt-4 inline-flex items-center gap-2 min-h-[46px] px-6 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة أول فراغ في البناء</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {effectiveActiveFloor.spaces.map((sp) => (
                <SpaceEditorCard
                  key={sp.id}
                  space={sp}
                  defaultExpanded={sp.id === newlyAddedSpaceId}
                  autoScroll={sp.id === newlyAddedSpaceId}
                  expandSignal={expandSignal}
                  onChange={(next) => updateSpace(effectiveActiveFloor.id, next)}
                  onDuplicate={() => duplicateSpace(effectiveActiveFloor.id, sp)}
                  onDelete={() =>
                    onDeleteSpaceToTrash(effectiveActiveFloor.id, effectiveActiveFloor.name, sp)
                  }
                />
              ))}

              {/* Prominent Bottom "Add Space Inside This Block" Action Bar */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-dashed border-emerald-500/35 bg-emerald-500/5 px-4 py-3">
                <button
                  type="button"
                  onClick={() => addSpaceInsideBlock('office_dorm')}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm font-bold text-white transition-colors whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة فراغ جديد في {effectiveActiveFloor.name}</span>
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      'bathrooms',
                      'prefab_dorm',
                      'prefab_bathrooms',
                      'buffet_kitchen',
                      'corridor',
                      'staircase',
                    ] as SpaceType[]
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => addSpaceInsideBlock(preset)}
                      className="min-h-[38px] px-3 rounded-lg bg-[#0b0f19] border border-slate-800 text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors whitespace-nowrap"
                    >
                      + {SPACE_TYPE_META[preset].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Block-Level General Works Panel */}
        <div className="pt-6 border-t border-slate-800/90 space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h4 className="text-base font-bold text-slate-100">
              الأعمال الكلية للكتلة (الأسطح والواجهات)
            </h4>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Roof Waterproofing (Optional: None / Auto / Manual) */}
            <div className="rounded-xl bg-[#0b0f19]/80 border border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-200">
                  عزل أسطح{' '}
                  <span className="text-xs font-normal text-slate-500">(اختياري)</span>
                </span>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#111827] border border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      updateGeneralWorks({
                        roofWaterproofingMode: 'none',
                        roofWaterproofingManual: 0,
                      })
                    }
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      gw.roofWaterproofingMode === 'none'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    بدون عزل
                  </button>
                  <button
                    type="button"
                    onClick={() => updateGeneralWorks({ roofWaterproofingMode: 'auto' })}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      gw.roofWaterproofingMode === 'auto'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    تلقائي
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateGeneralWorks({
                        roofWaterproofingMode: 'manual',
                        roofWaterproofingManual:
                          gw.roofWaterproofingManual || gwCalc.autoRoofArea,
                      })
                    }
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      gw.roofWaterproofingMode === 'manual'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    يدوي
                  </button>
                </div>
              </div>

              {gw.roofWaterproofingMode === 'none' ? (
                <div className="flex flex-wrap items-center justify-between gap-2 min-h-[44px] rounded-xl bg-[#111827]/70 border border-dashed border-slate-800 px-3.5 py-2">
                  <span className="text-xs text-slate-500">
                    تم حذف / إلغاء عزل الأسطح لهذا البناء (0 م²)
                  </span>
                  <button
                    type="button"
                    onClick={() => updateGeneralWorks({ roofWaterproofingMode: 'auto' })}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    تفعيل تلقائي
                  </button>
                </div>
              ) : gw.roofWaterproofingMode === 'auto' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between min-h-[44px] rounded-xl bg-[#111827] border border-slate-800 px-3.5">
                    <span className="text-xs text-slate-400">مجموع أرضيات أعلى طابق بالكتلة</span>
                    <span className="font-num text-base font-bold text-emerald-400">
                      {formatNum(gwCalc.autoRoofArea)} م²
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        updateGeneralWorks({
                          roofWaterproofingMode: 'manual',
                          roofWaterproofingManual: gwCalc.autoRoofArea,
                        })
                      }
                      className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                    >
                      تعديل القيمة يدوياً
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateGeneralWorks({
                          roofWaterproofingMode: 'none',
                          roofWaterproofingManual: 0,
                        })
                      }
                      className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 font-medium transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف العزل</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <NumericInput
                    label="مساحة عزل الأسطح (يدوي)"
                    value={gw.roofWaterproofingManual}
                    onChange={(v) => updateGeneralWorks({ roofWaterproofingManual: v })}
                    unit="م²"
                  />
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        updateGeneralWorks({
                          roofWaterproofingMode: 'none',
                          roofWaterproofingManual: 0,
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف عزل الأسطح</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Roof Tiles */}
            <div className="rounded-xl bg-[#0b0f19]/80 border border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-200">قرميد</span>
                <button
                  type="button"
                  onClick={() =>
                    updateGeneralWorks({
                      roofTilesArea:
                        gwCalc.roofWaterproofing > 0
                          ? gwCalc.roofWaterproofing
                          : gwCalc.autoRoofArea,
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>
                    نسخ من مساحة السطح (
                    {formatNum(
                      gwCalc.roofWaterproofing > 0
                        ? gwCalc.roofWaterproofing
                        : gwCalc.autoRoofArea
                    )}{' '}
                    م²)
                  </span>
                </button>
              </div>
              <NumericInput
                label="مساحة القرميد"
                value={gw.roofTilesArea}
                onChange={(v) => updateGeneralWorks({ roofTilesArea: v })}
                unit="م²"
                accent="cyan"
              />
            </div>
          </div>

          {/* Tyrolean Exterior Plaster */}
          <div className="rounded-xl bg-[#0b0f19]/80 border border-slate-800 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h5 className="text-sm font-semibold text-slate-200">
                  رشة تيرولية (واجهات خارجية)
                </h5>
                <p className="text-xs text-slate-500">
                  أدخل الواجهات بشكل منفصل أو محيط البناء × مجموع ارتفاعات الطوابق
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#111827] border border-slate-800">
                  <button
                    type="button"
                    onClick={() => updateGeneralWorks({ tyroleanMode: 'facades' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      gw.tyroleanMode === 'facades'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-400'
                    }`}
                  >
                    واجهات منفصلة
                  </button>
                  <button
                    type="button"
                    onClick={() => updateGeneralWorks({ tyroleanMode: 'perimeter' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      gw.tyroleanMode === 'perimeter'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-400'
                    }`}
                  >
                    محيط × ارتفاع
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateGeneralWorks({
                      deductExteriorOpenings: !gw.deductExteriorOpenings,
                    })
                  }
                  title="يخصم مجموع مساحات الشبابيك والأبواب الحديدية الخارجية في هذا البناء"
                  className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                    gw.deductExteriorOpenings
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-[#111827] border-slate-800 text-slate-400'
                  }`}
                >
                  خصم الفتحات الخارجية (-{formatNum(gwCalc.exteriorOpeningsArea)} م²)
                </button>
              </div>
            </div>

            {gw.tyroleanMode === 'facades' ? (
              <div className="space-y-2.5">
                {gw.facades.map((f) => (
                  <div
                    key={f.id}
                    className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-end"
                  >
                    <div className="col-span-2 sm:col-span-4 flex flex-col gap-1">
                      <label className="text-[11px] text-slate-400">اسم الواجهة</label>
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => updateFacade(f.id, { label: e.target.value })}
                        className="w-full min-h-[44px] rounded-xl bg-[#111827] border border-slate-700/80 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                      />
                    </div>
                    <NumericInput
                      label="طول الواجهة"
                      value={f.length}
                      onChange={(v) => updateFacade(f.id, { length: v })}
                      unit="م"
                      accent="cyan"
                      className="sm:col-span-3"
                    />
                    <NumericInput
                      label="الارتفاع"
                      value={f.height}
                      onChange={(v) => updateFacade(f.id, { height: v })}
                      unit="م"
                      accent="cyan"
                      className="sm:col-span-3"
                    />
                    <div className="col-span-2 sm:col-span-2 flex items-center justify-between gap-2">
                      <span className="font-num text-xs font-semibold text-slate-300">
                        {formatNum(f.length * f.height)} م²
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFacade(f.id)}
                        className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:border-rose-500/40 hover:text-rose-400 transition-colors"
                        aria-label="حذف الواجهة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addFacade}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-dashed border-slate-700 text-xs font-semibold text-cyan-300 hover:border-cyan-400/60 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة واجهة</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumericInput
                  label="محيط البناء الخارجي"
                  value={gw.perimeterLength}
                  onChange={(v) => updateGeneralWorks({ perimeterLength: v })}
                  unit="م"
                  accent="cyan"
                />
                <NumericInput
                  label="مجموع ارتفاعات الطوابق"
                  value={gw.totalFloorsHeight}
                  onChange={(v) => updateGeneralWorks({ totalFloorsHeight: v })}
                  unit="م"
                  accent="cyan"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-2 border-t border-slate-800/70">
              <span className="text-slate-400">
                الإجمالي:{' '}
                <strong className="font-num text-slate-200">
                  {formatNum(gwCalc.tyroleanGross)} م²
                </strong>
              </span>
              {gw.deductExteriorOpenings && (
                <span className="text-amber-400">
                  الخصم:{' '}
                  <strong className="font-num">-{formatNum(gwCalc.exteriorOpeningsArea)} م²</strong>
                </span>
              )}
              <span className="text-emerald-400 font-semibold">
                صافي الرشة التيرولية:{' '}
                <strong className="font-num text-sm">{formatNum(gwCalc.tyroleanNet)} م²</strong>
              </span>
            </div>
          </div>

          {/* Block-level Quick Contingency Items */}
          <CustomItemsSection
            items={gw.customItems}
            onChange={(next) => updateGeneralWorks({ customItems: next })}
            title="بنود سريعة للاحتياط على مستوى الكتلة"
          />
        </div>

        {/* Live Collapsible Block Totals Summary */}
        {activeBlockBOQItems.length > 0 && (
          <div className="pt-5 border-t border-slate-800/90">
            <button
              type="button"
              onClick={() => setShowBlockSummary((v) => !v)}
              className="flex w-full items-center justify-between gap-2 py-1 text-right"
            >
              <div className="flex items-center gap-2">
                <Table2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-slate-200">
                  معاينة إجمالي كميات هذا البناء ({activeBlockBOQItems.length} بند نشط)
                </span>
              </div>
              <span className="text-slate-400">
                {showBlockSummary ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>
            </button>

            {showBlockSummary && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {activeBlockBOQItems.map((it) => (
                  <div
                    key={it.key}
                    className="flex items-center justify-between gap-2 rounded-xl bg-[#0b0f19] border border-slate-800 px-3 py-2 text-xs"
                  >
                    <span className="text-slate-400 truncate">{it.label}</span>
                    <span className="font-num font-bold text-emerald-400 shrink-0">
                      {it.val} <span className="text-[10px] text-slate-500">{it.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Block-Level General Notes */}
        <div className="pt-5 border-t border-slate-800/90 space-y-2">
          <label className="text-sm font-semibold text-slate-200 block">
            ملاحظات عامة للبناء ({block.name || 'البناء الحالي'})
          </label>
          <textarea
            rows={2}
            value={block.generalNotes}
            onChange={(e) => updateBlock({ generalNotes: e.target.value })}
            placeholder="سجّل الملاحظات الهندسية الخاصة بهذا البناء (تظهر مباشرة أسفل إجمالي الكتلة في تقرير Excel)..."
            className="w-full rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-y"
          />
        </div>

        {/* Prominent Finish & Switch CTA + Close Only + Close Entire Project */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            يمكنك إعادة فتح البناء وتعديل أي قياسات أو إضافة فراغات في أي وقت لاحقاً.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onCloseOnly}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[48px] px-4 py-3 rounded-xl border border-slate-700 bg-[#0b0f19] hover:border-emerald-500/40 hover:text-emerald-300 text-xs sm:text-sm font-semibold text-slate-300 transition-colors whitespace-nowrap"
            >
              <Minimize2 className="h-4 w-4" />
              <span>إغلاق وطي البناء</span>
            </button>
            <button
              type="button"
              onClick={onFinishAndAddNew}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm font-bold text-white shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)] transition-all active:scale-[0.99] whitespace-nowrap"
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>إغلاق البناء وفتح بناء جديد</span>
            </button>
            {onCloseProjectAndViewSummary && (
              <button
                type="button"
                onClick={onCloseProjectAndViewSummary}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-xl border border-cyan-400/50 bg-cyan-500/15 hover:bg-cyan-500/25 text-xs sm:text-sm font-bold text-cyan-200 transition-all active:scale-[0.99] whitespace-nowrap"
              >
                <Table2 className="h-4 w-4" />
                <span>
                  إغلاق المشروع{projectName?.trim() ? `: ${projectName.trim()}` : ''} وعرض الملخص
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
