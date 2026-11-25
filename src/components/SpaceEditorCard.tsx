import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  DoorOpen,
  Grid2x2,
  Hammer,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  CeilingType,
  DoorEntry,
  DoorType,
  MasonryEntry,
  Space,
  SpaceType,
  WindowEntry,
  WindowType,
} from '../types/boq';
import {
  applySpaceTypePreset,
  calcMasonryArea,
  calculateSpace,
  CEILING_TYPE_LABELS,
  createId,
  DOOR_TYPE_LABELS,
  formatNum,
  resolveEffectiveSubRooms,
  safeNum,
  SPACE_TYPE_META,
  STANDARD_BOQ_COLUMNS,
  WINDOW_TYPE_LABELS,
} from '../utils/calculations';
import { CustomItemsSection } from './CustomItemsSection';
import { NumericInput } from './NumericInput';

interface SpaceEditorCardProps {
  space: Space;
  defaultExpanded?: boolean;
  expandSignal?: { value: boolean; seq: number } | null;
  autoScroll?: boolean;
  onChange: (updated: Space) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const SPACE_TYPE_LIST: SpaceType[] = [
  'office_dorm',
  'bathrooms',
  'buffet_kitchen',
  'corridor',
  'staircase',
  'custom',
];

const CEILING_LIST: CeilingType[] = [
  'none',
  'paint',
  'ceramic',
  'tiles_60x60',
  'gypsum',
  'gypsum_and_paint',
];

export const SpaceEditorCard: React.FC<SpaceEditorCardProps> = ({
  space,
  defaultExpanded = false,
  expandSignal = null,
  autoScroll = false,
  onChange,
  onDuplicate,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [sinkManuallyShown, setSinkManuallyShown] = useState(space.sinkLength > 0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [showMasonry, setShowMasonry] = useState(
    () =>
      calcMasonryArea(space.block20) > 0 ||
      calcMasonryArea(space.block15) > 0 ||
      calcMasonryArea(space.block10) > 0 ||
      calcMasonryArea(space.demolition) > 0 ||
      safeNum(space.extraPlaster) > 0
  );

  useEffect(() => {
    if (expandSignal) {
      setExpanded(expandSignal.value);
    }
  }, [expandSignal]);

  useEffect(() => {
    if (autoScroll && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [autoScroll]);

  const calc = calculateSpace(space);
  const mult = calc.multiplier;
  const resolvedSubRooms =
    space.spaceType === 'bathrooms' ? resolveEffectiveSubRooms(space.subRooms) : [];

  const update = (patch: Partial<Space>) => {
    onChange({ ...space, ...patch });
  };

  const handleSelectSpaceType = (nextType: SpaceType) => {
    onChange(applySpaceTypePreset(space, nextType));
  };

  // Sub-rooms (0 to 6) for bathrooms
  const setSubRoomsCount = (count: number) => {
    const safeCount = Math.max(0, Math.min(6, Math.floor(count)));
    if (safeCount === space.subRooms.length) return;
    if (safeCount < space.subRooms.length) {
      update({ subRooms: space.subRooms.slice(0, safeCount) });
      return;
    }
    const next = [...space.subRooms];
    for (let i = space.subRooms.length + 1; i <= safeCount; i++) {
      next.push({
        id: createId('sub'),
        label: `فراغ فرعي ${i}`,
        length: 0,
        width: 0,
        height: 2,
      });
    }
    update({ subRooms: next });
  };

  const addSubRoom = () => {
    setSubRoomsCount(space.subRooms.length + 1);
  };

  const updateSubRoom = (
    id: string,
    patch: Partial<{ label: string; length: number; width: number; height: number }>
  ) => {
    update({
      subRooms: space.subRooms.map((sr) => (sr.id === id ? { ...sr, ...patch } : sr)),
    });
  };

  const removeSubRoom = (id: string) => {
    update({ subRooms: space.subRooms.filter((sr) => sr.id !== id) });
  };

  // Doors
  const addDoor = () => {
    const entry: DoorEntry = {
      id: createId('dr'),
      type: space.spaceType === 'bathrooms' ? 'aluminum' : 'wood',
      width: space.spaceType === 'bathrooms' ? 0.8 : 1.0,
      height: 2.1,
      count: 1,
      hasIronGrille: false,
    };
    update({ doors: [...space.doors, entry] });
  };

  const updateDoor = (id: string, patch: Partial<DoorEntry>) => {
    update({ doors: space.doors.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  };

  const removeDoor = (id: string) => {
    update({ doors: space.doors.filter((d) => d.id !== id) });
  };

  // Windows
  const addWindow = () => {
    const entry: WindowEntry = {
      id: createId('wn'),
      type: 'aluminum',
      width: 1.5,
      height: 1.2,
      count: 1,
      hasIronGrille: false,
      hasMarbleSill: false,
    };
    update({ windows: [...space.windows, entry] });
  };

  const updateWindow = (id: string, patch: Partial<WindowEntry>) => {
    update({ windows: space.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  };

  const removeWindow = (id: string) => {
    update({ windows: space.windows.filter((w) => w.id !== id) });
  };

  // Masonry updater
  const updateMasonry = (
    field: 'block20' | 'block15' | 'block10',
    patch: Partial<MasonryEntry>
  ) => {
    update({ [field]: { ...space[field], ...patch } });
  };

  // Non-zero summary items for quick verification strip
  const activeSummaryItems = STANDARD_BOQ_COLUMNS.filter((c) => calc.boq[c.key] > 0).map((c) => ({
    label: c.label,
    val: formatNum(calc.boq[c.key]),
    unit: c.unit,
  }));

  const showSinkInput =
    space.spaceType === 'buffet_kitchen' || sinkManuallyShown || space.sinkLength > 0;

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl bg-[#111827] border transition-colors ${
        expanded
          ? 'border-emerald-500/35 shadow-[0_0_24px_-12px_rgba(16,185,129,0.28)]'
          : 'border-slate-800/90 hover:border-slate-700'
      }`}
    >
      {/* Space Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex flex-1 min-w-[200px] items-center gap-3 text-right focus-visible:outline-none"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800/90 text-emerald-400">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-base font-semibold text-slate-100 truncate">
                {space.name || 'فراغ بدون اسم'}
              </span>
              {mult > 1 && (
                <span className="font-num text-xs font-semibold text-cyan-400">
                  ×{mult} متماثل
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
              <span>{SPACE_TYPE_META[space.spaceType].label}</span>
              <span aria-hidden="true">·</span>
              <span>
                أرضية:{' '}
                <strong className="font-num text-slate-200">
                  {formatNum(calc.singleFloorArea * mult)}
                </strong>{' '}
                م²
              </span>
              <span aria-hidden="true">·</span>
              <span>
                صافي جدران:{' '}
                <strong className="font-num text-slate-200">
                  {formatNum(calc.singleNetWallArea * mult)}
                </strong>{' '}
                م²
              </span>
              {space.spaceType === 'bathrooms' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{space.subRooms.length} فراغات فرعية</span>
                </>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onDuplicate}
            title="تكرار الفراغ"
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-slate-800 bg-[#0b0f19] text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors whitespace-nowrap"
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">تكرار الفراغ</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="حذف الفراغ"
            className="flex h-[40px] w-[40px] items-center justify-center rounded-xl border border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
            aria-label="حذف الفراغ"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded Space Form */}
      {expanded && (
        <div className="border-t border-slate-800/80 px-4 py-5 space-y-6">
          {/* 1. Space Name, Identical Multiplier, and Note */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">رقم أو اسم الفراغ</label>
              <input
                type="text"
                value={space.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="مثال: مكتب 101، مهجع شمالي، ممر رئيسي"
                className="w-full min-h-[44px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 text-sm font-medium text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>

            <div className="md:col-span-3 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">
                عدد الفراغات المتماثلة (المضاعف)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => update({ multiplier: Math.max(1, mult - 1) })}
                  className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-[#0b0f19] text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
                  aria-label="إنقاص العدد"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <NumericInput
                  value={mult}
                  onChange={(v) => update({ multiplier: Math.max(1, Math.floor(v) || 1) })}
                  min={1}
                  accent="cyan"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => update({ multiplier: mult + 1 })}
                  className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-[#0b0f19] text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
                  aria-label="زيادة العدد"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">ملاحظة الفراغ (اختياري)</label>
              <input
                type="text"
                value={space.note}
                onChange={(e) => update({ note: e.target.value })}
                placeholder="رطوبة بالسقف، جدار متصدع..."
                className="w-full min-h-[44px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          {/* 2. Smart Space Type Quick Selector */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs font-medium text-slate-400">
                نوعية الفراغ (تفعيل تلقائي للبنود مع إمكانية التعديل اليدوي)
              </label>
              <span className="text-xs text-slate-500 hidden sm:inline">
                {SPACE_TYPE_META[space.spaceType].shortDesc}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {SPACE_TYPE_LIST.map((typeKey) => {
                const active = space.spaceType === typeKey;
                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => handleSelectSpaceType(typeKey)}
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap text-center border ${
                      active
                        ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300 shadow-[0_0_16px_-6px_rgba(16,185,129,0.5)]'
                        : 'bg-[#0b0f19] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-slate-100'
                    }`}
                  >
                    {SPACE_TYPE_META[typeKey].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Dimensions (Main Space First for ALL Types + Bathroom Sub-Rooms + Staircase Calculator) */}
          <div className="space-y-4">
            {space.spaceType === 'staircase' && (
              <div className="rounded-xl bg-[#0b0f19]/80 border border-cyan-500/35 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="text-sm font-semibold text-cyan-300">
                    حاسبة بيت الدرج (قائمة + نائمة + الاستراحة)
                  </h5>
                  <span className="font-num text-xs text-slate-400">
                    Steps × [(L × 0.30) + (L × 0.15)]
                  </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                  <NumericInput
                    label="عدد الدرجات"
                    value={space.stairStepsCount}
                    onChange={(v) => update({ stairStepsCount: v })}
                    unit="درجة"
                    accent="cyan"
                  />
                  <NumericInput
                    label="طول الدرجة (L)"
                    value={space.stairStepLength}
                    onChange={(v) => update({ stairStepLength: v })}
                    unit="م"
                    accent="cyan"
                  />
                  <div className="flex flex-col justify-center min-h-[44px] rounded-xl bg-[#111827] border border-slate-800 px-3 py-1.5">
                    <span className="text-[11px] text-slate-500">قائمة + نائمة</span>
                    <span className="font-num text-sm font-semibold text-emerald-400">
                      {formatNum(calc.boq.stairSteps)} م²
                    </span>
                  </div>
                  <NumericInput
                    label="طول الاستراحة"
                    value={space.landingLength}
                    onChange={(v) => update({ landingLength: v })}
                    unit="م"
                    accent="cyan"
                  />
                  <NumericInput
                    label="عرض الاستراحة"
                    value={space.landingWidth}
                    onChange={(v) => update({ landingWidth: v })}
                    unit="م"
                    accent="cyan"
                  />
                  <div className="flex flex-col justify-center min-h-[44px] rounded-xl bg-[#111827] border border-slate-800 px-3 py-1.5">
                    <span className="text-[11px] text-slate-500">استراحة الدرج</span>
                    <span className="font-num text-sm font-semibold text-cyan-300">
                      {formatNum(calc.boq.stairLanding)} م²
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Main Room Dimensions (ALWAYS shown first, including Bathrooms / WCs) */}
            <div className="space-y-2">
              {space.spaceType === 'bathrooms' && (
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-300">
                    أبعاد الفراغ الكامل (الحمام / الخلاءات الرئيسية)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    تُحسب الأرضية والسقف والجدران الخارجية على هذه الأبعاد
                  </span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <NumericInput
                  label={
                    space.spaceType === 'staircase'
                      ? 'طول بيت الدرج (L)'
                      : space.spaceType === 'bathrooms'
                      ? 'طول الفراغ الكامل (L)'
                      : 'الطول (L)'
                  }
                  value={space.length}
                  onChange={(v) => update({ length: v })}
                  unit="م"
                />
                <NumericInput
                  label={
                    space.spaceType === 'staircase'
                      ? 'عرض بيت الدرج (W)'
                      : space.spaceType === 'bathrooms'
                      ? 'عرض الفراغ الكامل (W)'
                      : 'العرض (W)'
                  }
                  value={space.width}
                  onChange={(v) => update({ width: v })}
                  unit="م"
                />
                <NumericInput
                  label={
                    space.spaceType === 'bathrooms' ? 'ارتفاع الفراغ الكامل (H)' : 'الارتفاع (H)'
                  }
                  value={space.height}
                  onChange={(v) => update({ height: v })}
                  unit="م"
                />
              </div>
            </div>

            {/* Sub-Rooms Section specifically for Bathrooms / WCs */}
            {space.spaceType === 'bathrooms' && (
              <div className="rounded-xl bg-[#0b0f19]/75 border border-cyan-500/30 p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold text-cyan-300">
                      الفراغات الفرعية داخل الحمام / الخلاءات
                    </h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      الارتفاع الافتراضي 2 م (قابل للتعديل). ترك الأبعاد فارغة يأخذ أبعاد الفراغ
                      الفرعي 1 تلقائياً أو 1×1 م افتراضياً.
                    </p>
                  </div>

                  {/* Quick Count Selector (0..6) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                      عدد الفراغات الفرعية:
                    </span>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2, 3, 4, 5, 6].map((cnt) => {
                        const active = space.subRooms.length === cnt;
                        return (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setSubRoomsCount(cnt)}
                            className={`font-num min-h-[38px] min-w-[38px] px-2 rounded-lg border text-xs font-bold transition-colors ${
                              active
                                ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200'
                                : 'bg-[#111827] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            {cnt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {space.subRooms.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-800 px-3.5 py-3 text-xs text-slate-400">
                    <span>لا توجد فراغات فرعية مضافة — يتم الحساب على الفراغ الرئيسي فقط.</span>
                    <button
                      type="button"
                      onClick={addSubRoom}
                      className="inline-flex items-center gap-1.5 font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>إضافة فراغ فرعي</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {space.subRooms.map((sr, idx) => {
                      const resolved = resolvedSubRooms[idx];
                      const isInherited =
                        resolved &&
                        (resolved.lengthSource === 'inherited' ||
                          resolved.widthSource === 'inherited');
                      const isDefault =
                        resolved &&
                        !isInherited &&
                        (resolved.lengthSource === 'default' ||
                          resolved.widthSource === 'default');

                      return (
                        <div
                          key={sr.id}
                          className="rounded-xl bg-[#111827]/70 border border-slate-800/80 p-3 space-y-2"
                        >
                          <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-end">
                            <div className="col-span-2 sm:col-span-3 flex flex-col gap-1">
                              <label className="text-[11px] text-slate-400">
                                تسمية الفراغ الفرعي {idx + 1}
                              </label>
                              <input
                                type="text"
                                value={sr.label}
                                onChange={(e) => updateSubRoom(sr.id, { label: e.target.value })}
                                placeholder={`فراغ فرعي ${idx + 1}`}
                                className="w-full min-h-[44px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                              />
                            </div>
                            <NumericInput
                              label="الطول (L)"
                              value={sr.length}
                              placeholder={resolved ? String(resolved.length) : '1'}
                              onChange={(v) => updateSubRoom(sr.id, { length: v })}
                              unit="م"
                              accent="cyan"
                              className="sm:col-span-2"
                            />
                            <NumericInput
                              label="العرض (W)"
                              value={sr.width}
                              placeholder={resolved ? String(resolved.width) : '1'}
                              onChange={(v) => updateSubRoom(sr.id, { width: v })}
                              unit="م"
                              accent="cyan"
                              className="sm:col-span-2"
                            />
                            <NumericInput
                              label="الارتفاع (H)"
                              value={sr.height}
                              placeholder={resolved ? String(resolved.height) : '2'}
                              onChange={(v) => updateSubRoom(sr.id, { height: v })}
                              unit="م"
                              accent="cyan"
                              className="sm:col-span-2"
                            />
                            <div className="col-span-1 sm:col-span-2 flex flex-col justify-center min-h-[44px] px-1.5 text-xs text-slate-400">
                              <span>
                                جدران:{' '}
                                <strong className="font-num text-cyan-300">
                                  {formatNum(resolved?.wallArea || 0)}
                                </strong>{' '}
                                م²
                              </span>
                              <span className="font-num text-[11px] text-slate-500">
                                {resolved
                                  ? `${formatNum(resolved.length)}×${formatNum(resolved.width)}×${formatNum(resolved.height)}م`
                                  : ''}
                              </span>
                            </div>
                            <div className="col-span-1 sm:col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeSubRoom(sr.id)}
                                className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-slate-800 bg-[#0b0f19] text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                                aria-label="حذف الفراغ الفرعي"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {(isInherited || isDefault) && resolved && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                              <span className={isInherited ? 'text-cyan-400' : 'text-amber-400'}>
                                {isInherited
                                  ? `مطابق تلقائياً لأبعاد الفراغ الفرعي 1 (${formatNum(resolved.length)}×${formatNum(resolved.width)}×${formatNum(resolved.height)} م)`
                                  : `تم اعتماد الأبعاد الافتراضية تلقائياً (${formatNum(resolved.length)}×${formatNum(resolved.width)}×${formatNum(resolved.height)} م)`}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live Geometry Summary Strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-[#0b0f19] border border-slate-800/90 px-4 py-3 text-xs">
            <div>
              <span className="text-slate-400">
                {space.spaceType === 'bathrooms' ? 'أرضية / سقف: ' : 'مساحة الأرضية: '}
              </span>
              <span className="font-num font-semibold text-emerald-400">
                {formatNum(calc.singleFloorArea)}
              </span>
              <span className="text-slate-500"> م²</span>
            </div>
            <span className="text-slate-700" aria-hidden="true">
              /
            </span>
            {space.spaceType === 'bathrooms' && calc.singleSubRoomsWallArea > 0 ? (
              <>
                <div>
                  <span className="text-slate-400">جدران الفراغ الرئيسي: </span>
                  <span className="font-num font-semibold text-slate-200">
                    {formatNum(calc.singleMainWallArea)}
                  </span>
                  <span className="text-slate-500"> م²</span>
                </div>
                <span className="text-slate-700" aria-hidden="true">
                  /
                </span>
                <div>
                  <span className="text-slate-400">جدران الفراغات الفرعية: </span>
                  <span className="font-num font-semibold text-cyan-300">
                    +{formatNum(calc.singleSubRoomsWallArea)}
                  </span>
                  <span className="text-slate-500"> م²</span>
                </div>
              </>
            ) : (
              <div>
                <span className="text-slate-400">إجمالي الجدران: </span>
                <span className="font-num font-semibold text-slate-200">
                  {formatNum(calc.singleGrossWallArea)}
                </span>
                <span className="text-slate-500"> م²</span>
              </div>
            )}
            <span className="text-slate-700" aria-hidden="true">
              /
            </span>
            <div>
              <span className="text-slate-400">خصم الفتحات: </span>
              <span className="font-num font-semibold text-amber-400">
                -{formatNum(calc.singleOpeningsArea)}
              </span>
              <span className="text-slate-500"> م²</span>
            </div>
            <span className="text-slate-700" aria-hidden="true">
              /
            </span>
            <div>
              <span className="text-slate-400">صافي الجدران: </span>
              <span className="font-num font-semibold text-cyan-300">
                {formatNum(calc.singleNetWallArea)}
              </span>
              <span className="text-slate-500"> م²</span>
            </div>
            {mult > 1 && (
              <>
                <span className="text-slate-700" aria-hidden="true">
                  /
                </span>
                <div className="text-cyan-300 font-medium">
                  جميع الكميات مضروبة تلقائياً × <span className="font-num font-bold">{mult}</span>
                </div>
              </>
            )}
          </div>

          {/* 4. Finishes & Ceiling Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-2.5">
              <span className="text-xs font-medium text-slate-400 block">
                تشطيبات الأرضيات والجدران
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'floorGrinding' as const, label: 'جلي أرضيات' },
                  { key: 'floorCeramic' as const, label: 'أرضيات سيراميك' },
                  { key: 'wallPaint' as const, label: 'دهان جدران' },
                  { key: 'wallCeramic' as const, label: 'سيراميك جدران' },
                  { key: 'wallFullPlaster' as const, label: 'طينة كامل الجدران' },
                ].map((toggle) => {
                  const active = space[toggle.key];
                  return (
                    <button
                      key={toggle.key}
                      type="button"
                      onClick={() => update({ [toggle.key]: !active })}
                      className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300'
                          : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {toggle.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-xs font-medium text-slate-400 block">
                نوع السقف (يعتمد مساحة الأرضية)
              </span>
              <div className="flex flex-wrap gap-2">
                {CEILING_LIST.map((ct) => {
                  const active = space.ceilingType === ct;
                  return (
                    <button
                      key={ct}
                      type="button"
                      onClick={() => update({ ceilingType: ct })}
                      className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300'
                          : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {CEILING_TYPE_LABELS[ct]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sink Input (auto-revealed for Buffet/Kitchen, also toggleable) */}
          {showSinkInput ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end rounded-xl bg-cyan-500/5 border border-cyan-500/30 p-3.5">
              <NumericInput
                label="طول المجلى (بوفيه / مطبخ)"
                value={space.sinkLength}
                onChange={(v) => update({ sinkLength: v })}
                unit="م.ط"
                accent="cyan"
              />
              <div className="sm:col-span-2 flex items-center justify-between gap-2 text-xs text-slate-400 pb-2">
                <span>
                  إجمالي المجلى المحسوب:{' '}
                  <strong className="font-num text-cyan-300">{formatNum(calc.boq.sink)}</strong>{' '}
                  م.ط
                </span>
                {space.spaceType !== 'buffet_kitchen' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSinkManuallyShown(false);
                      update({ sinkLength: 0 });
                    }}
                    className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    إخفاء المجلى
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSinkManuallyShown(true)}
              className="text-xs font-medium text-slate-400 hover:text-cyan-300 transition-colors"
            >
              + إضافة طول مجلى (م.ط) لهذا الفراغ
            </button>
          )}

          {/* 5. Openings: Doors & Windows (Single-Entry & Auto-Deduction) */}
          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Doors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-emerald-400" />
                  <h5 className="text-sm font-semibold text-slate-200">
                    الأبواب ({space.doors.length})
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={addDoor}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة باب</span>
                </button>
              </div>

              {space.doors.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  لا توجد أبواب مضافة — تُخصم مساحة الأبواب تلقائياً من الجدران عند إضافتها.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {space.doors.map((d) => {
                    const area = safeNum(d.width) * safeNum(d.height) * safeNum(d.count);
                    const grilleKg = area * 16 * mult;
                    const resultVal =
                      d.type === 'iron_single' || d.type === 'iron_double'
                        ? `${formatNum(area * 40 * mult)} كغ`
                        : d.type === 'maint_single' || d.type === 'maint_double'
                        ? `${formatNum(safeNum(d.count) * mult)} عدد`
                        : `${formatNum(area * mult)} م²`;

                    return (
                      <div
                        key={d.id}
                        className="rounded-xl bg-[#0b0f19]/80 border border-slate-800 p-3 space-y-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <select
                            value={d.type}
                            onChange={(e) =>
                              updateDoor(d.id, { type: e.target.value as DoorType })
                            }
                            className="flex-1 min-h-[42px] rounded-xl bg-[#111827] border border-slate-700/80 px-3 text-xs font-medium text-slate-100 outline-none focus:border-emerald-400/70"
                          >
                            {Object.entries(DOOR_TYPE_LABELS).map(([k, meta]) => (
                              <option key={k} value={k}>
                                {meta.label} ({meta.unit})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeDoor(d.id)}
                            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:border-rose-500/40 hover:text-rose-400 transition-colors"
                            aria-label="حذف الباب"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <NumericInput
                            label="العرض (W)"
                            value={d.width}
                            onChange={(v) => updateDoor(d.id, { width: v })}
                            unit="م"
                          />
                          <NumericInput
                            label="الارتفاع (H)"
                            value={d.height}
                            onChange={(v) => updateDoor(d.id, { height: v })}
                            unit="م"
                          />
                          <NumericInput
                            label="العدد (N)"
                            value={d.count}
                            onChange={(v) => updateDoor(d.id, { count: v })}
                          />
                        </div>

                        {/* Door Iron Security Grille Toggle */}
                        <div className="pt-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateDoor(d.id, { hasIronGrille: !d.hasIronGrille })
                            }
                            className={`flex w-full items-center justify-between min-h-[40px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                              d.hasIronGrille
                                ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300'
                                : 'bg-[#111827] border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>حماية حديد للباب</span>
                            <span className="font-num text-[11px]">
                              {d.hasIronGrille ? `+${formatNum(grilleKg)} كغ` : '×16 كغ'}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                          <span>
                            خصم جدران:{' '}
                            <strong className="font-num text-amber-400">
                              -{formatNum(area)} م²
                            </strong>
                          </span>
                          <span>
                            الباب:{' '}
                            <strong className="font-num text-emerald-400">{resultVal}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Windows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Grid2x2 className="h-4 w-4 text-cyan-400" />
                  <h5 className="text-sm font-semibold text-slate-200">
                    الشبابيك ({space.windows.length})
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={addWindow}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة شباك</span>
                </button>
              </div>

              {space.windows.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  لا توجد شبابيك مضافة — تشمل خيارات الحماية الحديد وملبن الرخام في نفس البطاقة.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {space.windows.map((w) => {
                    const area = safeNum(w.width) * safeNum(w.height) * safeNum(w.count);
                    const grilleKg = area * 16 * mult;
                    const marbleMl = 2 * (safeNum(w.width) + safeNum(w.height)) * safeNum(w.count) * mult;
                    const winOut =
                      w.type === 'aluminum'
                        ? `${formatNum(area * 1.3 * mult)} م²`
                        : w.type === 'iron'
                        ? `${formatNum(area * 16 * mult)} كغ`
                        : `${formatNum(safeNum(w.count) * mult)} عدد`;

                    return (
                      <div
                        key={w.id}
                        className="rounded-xl bg-[#0b0f19]/80 border border-slate-800 p-3 space-y-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <select
                            value={w.type}
                            onChange={(e) =>
                              updateWindow(w.id, { type: e.target.value as WindowType })
                            }
                            className="flex-1 min-h-[42px] rounded-xl bg-[#111827] border border-slate-700/80 px-3 text-xs font-medium text-slate-100 outline-none focus:border-cyan-400/70"
                          >
                            {Object.entries(WINDOW_TYPE_LABELS).map(([k, meta]) => (
                              <option key={k} value={k}>
                                {meta.label} ({meta.unit})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeWindow(w.id)}
                            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:border-rose-500/40 hover:text-rose-400 transition-colors"
                            aria-label="حذف الشباك"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <NumericInput
                            label="العرض (W)"
                            value={w.width}
                            onChange={(v) => updateWindow(w.id, { width: v })}
                            unit="م"
                            accent="cyan"
                          />
                          <NumericInput
                            label="الارتفاع (H)"
                            value={w.height}
                            onChange={(v) => updateWindow(w.id, { height: v })}
                            unit="م"
                            accent="cyan"
                          />
                          <NumericInput
                            label="العدد (N)"
                            value={w.count}
                            onChange={(v) => updateWindow(w.id, { count: v })}
                            accent="cyan"
                          />
                        </div>

                        {/* Attached Quick Toggles on the SAME window card */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateWindow(w.id, { hasIronGrille: !w.hasIronGrille })
                            }
                            className={`flex items-center justify-between min-h-[40px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                              w.hasIronGrille
                                ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300'
                                : 'bg-[#111827] border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>حماية حديد</span>
                            <span className="font-num text-[11px]">
                              {w.hasIronGrille ? `+${formatNum(grilleKg)} كغ` : '×16 كغ'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateWindow(w.id, { hasMarbleSill: !w.hasMarbleSill })
                            }
                            className={`flex items-center justify-between min-h-[40px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                              w.hasMarbleSill
                                ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300'
                                : 'bg-[#111827] border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>ملبن رخام</span>
                            <span className="font-num text-[11px]">
                              {w.hasMarbleSill ? `+${formatNum(marbleMl)} م.ط` : 'محيط م.ط'}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>
                            خصم جدران:{' '}
                            <strong className="font-num text-amber-400">
                              -{formatNum(area)} م²
                            </strong>
                          </span>
                          <span>
                            الشباك:{' '}
                            <strong className="font-num text-cyan-300">{winOut}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 6. Masonry, Plastering (Auto 2x Link), & Demolition */}
          <div className="pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowMasonry((p) => !p)}
              className="flex w-full items-center justify-between gap-2 text-right py-1"
            >
              <div className="flex items-center gap-2">
                <Hammer className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-slate-200">
                  بناء البلوك (20 / 15 / 10)، الطينة التلقائية (×2)، وهدم البلوك
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {calc.boq.plaster > 0 && (
                  <span>
                    طينة:{' '}
                    <strong className="font-num text-emerald-400">
                      {formatNum(calc.boq.plaster)}
                    </strong>{' '}
                    م²
                  </span>
                )}
                {showMasonry ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {showMasonry && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                  {(
                    [
                      { key: 'block20', title: 'بناء بلوك 20' },
                      { key: 'block15', title: 'بناء بلوك 15' },
                      { key: 'block10', title: 'بناء بلوك 10' },
                    ] as const
                  ).map(({ key, title }) => {
                    const m = space[key];
                    const area = calcMasonryArea(m);
                    return (
                      <div
                        key={key}
                        className="rounded-xl bg-[#0b0f19]/80 border border-slate-800 p-3.5 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-200">{title}</span>
                          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#111827] border border-slate-800">
                            <button
                              type="button"
                              onClick={() => updateMasonry(key, { mode: 'dims' })}
                              className={`px-2 py-1 rounded-md text-[11px] font-medium ${
                                m.mode === 'dims'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              ط × ع
                            </button>
                            <button
                              type="button"
                              onClick={() => updateMasonry(key, { mode: 'direct' })}
                              className={`px-2 py-1 rounded-md text-[11px] font-medium ${
                                m.mode === 'direct'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              مباشر
                            </button>
                          </div>
                        </div>

                        {m.mode === 'direct' ? (
                          <NumericInput
                            label="المساحة المباشرة"
                            value={m.directArea}
                            onChange={(v) => updateMasonry(key, { directArea: v })}
                            unit="م²"
                          />
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <NumericInput
                              label="الطول"
                              value={m.length}
                              onChange={(v) => updateMasonry(key, { length: v })}
                              unit="م"
                            />
                            <NumericInput
                              label="الارتفاع"
                              value={m.height}
                              onChange={(v) => updateMasonry(key, { height: v })}
                              unit="م"
                            />
                          </div>
                        )}

                        {/* Auto 2x Link selector: Plaster vs Wall Ceramic */}
                        <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                          <span className="text-slate-400">
                            الوجهين (×2 ={' '}
                            <strong className="font-num text-slate-200">
                              {formatNum(area * 2 * mult)}
                            </strong>{' '}
                            م²) ←
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateMasonry(key, { targetFinish: 'plaster' })}
                              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                                m.targetFinish === 'plaster'
                                  ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                                  : 'border-slate-800 text-slate-400'
                              }`}
                            >
                              طينة
                            </button>
                            <button
                              type="button"
                              onClick={() => updateMasonry(key, { targetFinish: 'ceramic' })}
                              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                                m.targetFinish === 'ceramic'
                                  ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300'
                                  : 'border-slate-800 text-slate-400'
                              }`}
                            >
                              سيراميك
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Extra Plaster Repairs + Block Demolition */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="rounded-xl bg-[#0b0f19]/80 border border-slate-800 p-3.5 space-y-2.5">
                    <NumericInput
                      label="طينة إصلاحات / مساحات إضافية (تُضاف تلقائياً لإجمالي الطينة)"
                      value={space.extraPlaster}
                      onChange={(v) => update({ extraPlaster: v })}
                      unit="م²"
                    />
                    <div className="text-xs text-slate-400">
                      إجمالي الطينة للفراغ:{' '}
                      <strong className="font-num text-emerald-400">
                        {formatNum(calc.boq.plaster)} م²
                      </strong>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#0b0f19]/80 border border-slate-800 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200">هدم بلوك</span>
                      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#111827] border border-slate-800">
                        <button
                          type="button"
                          onClick={() =>
                            update({ demolition: { ...space.demolition, mode: 'dims' } })
                          }
                          className={`px-2 py-1 rounded-md text-[11px] font-medium ${
                            space.demolition.mode === 'dims'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'text-slate-400'
                          }`}
                        >
                          ط × ع
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            update({ demolition: { ...space.demolition, mode: 'direct' } })
                          }
                          className={`px-2 py-1 rounded-md text-[11px] font-medium ${
                            space.demolition.mode === 'direct'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'text-slate-400'
                          }`}
                        >
                          مباشر
                        </button>
                      </div>
                    </div>

                    {space.demolition.mode === 'direct' ? (
                      <NumericInput
                        label="مساحة الهدم المباشرة"
                        value={space.demolition.directArea}
                        onChange={(v) =>
                          update({ demolition: { ...space.demolition, directArea: v } })
                        }
                        unit="م²"
                      />
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <NumericInput
                          label="الطول"
                          value={space.demolition.length}
                          onChange={(v) =>
                            update({ demolition: { ...space.demolition, length: v } })
                          }
                          unit="م"
                        />
                        <NumericInput
                          label="الارتفاع"
                          value={space.demolition.height}
                          onChange={(v) =>
                            update({ demolition: { ...space.demolition, height: v } })
                          }
                          unit="م"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 7. Quick Contingency Items */}
          <CustomItemsSection
            items={space.customItems}
            onChange={(next) => update({ customItems: next })}
            multiplier={mult}
          />

          {/* 8. Live Computed BOQ Strip for this Space */}
          {activeSummaryItems.length > 0 && (
            <div className="pt-4 border-t border-slate-800/80">
              <div className="text-xs font-medium text-slate-400 mb-2">
                ملخص الكميات المحسوبة لهذا الفراغ {mult > 1 ? `(بعد الضرب ×${mult})` : ''}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {activeSummaryItems.map((it) => (
                  <div
                    key={it.label}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[#0b0f19] border border-slate-800/80 px-2.5 py-2 text-xs"
                  >
                    <span className="text-slate-400 truncate">{it.label}</span>
                    <span className="font-num font-semibold text-emerald-300 shrink-0">
                      {it.val} <span className="text-[10px] text-slate-500">{it.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
