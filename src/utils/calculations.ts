import {
  Block,
  BOQColumnDef,
  BOQQuantities,
  CustomColumnMeta,
  CustomItem,
  CustomItemUnit,
  DemolitionEntry,
  MasonryEntry,
  Project,
  Space,
  SpaceCalculationResult,
  SpaceType,
  SubRoom,
} from '../types/boq';

export const STANDARD_BOQ_COLUMNS: BOQColumnDef[] = [
  { key: 'floorGrinding', label: 'جلي أرضيات', unit: 'م²', category: 'الأرضيات والدرج' },
  { key: 'floorCeramic', label: 'أرضيات', unit: 'م²', category: 'الأرضيات والدرج' },
  { key: 'wallPaint', label: 'دهان جدران', unit: 'م²', category: 'الجدران والأسقف' },
  { key: 'ceilingPaint', label: 'دهان أسقف', unit: 'م²', category: 'الجدران والأسقف' },
  { key: 'wallCeramic', label: 'سيراميك جدران', unit: 'م²', category: 'الجدران والأسقف' },
  { key: 'ceilingCeramic', label: 'سيراميك أسقف', unit: 'م²', category: 'الجدران والأسقف' },
  { key: 'ceilingTiles60', label: 'بلاطات 60*60', unit: 'م²', category: 'الجدران والأسقف' },
  { key: 'ceilingGypsum', label: 'جبسن بورد', unit: 'م²', category: 'الجدران والأسقف' },
  { key: 'doorsWood', label: 'أبواب خشب', unit: 'م²', category: 'الأبواب' },
  { key: 'doorsAluminum', label: 'أبواب ألمنيوم', unit: 'م²', category: 'الأبواب' },
  { key: 'doorsIronSingle', label: 'أبواب حديد درفة', unit: 'كغ', category: 'الأبواب' },
  { key: 'doorsIronDouble', label: 'أبواب حديد درفتين', unit: 'كغ', category: 'الأبواب' },
  { key: 'sink', label: 'مجلى', unit: 'م.ط', category: 'التجهيزات' },
  { key: 'windowsAluminum', label: 'نوافذ ألمنيوم', unit: 'م²', category: 'الشبابيك والحمايات' },
  { key: 'windowsIron', label: 'نوافذ حديد', unit: 'كغ', category: 'الشبابيك والحمايات' },
  { key: 'ironGrilles', label: 'حمايات حديد', unit: 'كغ', category: 'الشبابيك والحمايات' },
  { key: 'marbleSills', label: 'ملابن رخام', unit: 'م.ط', category: 'الشبابيك والحمايات' },
  { key: 'roofWaterproofing', label: 'عزل أسطح', unit: 'م²', category: 'أعمال الكتلة العامة' },
  { key: 'roofTiles', label: 'قرميد', unit: 'م²', category: 'أعمال الكتلة العامة' },
  { key: 'tyrolean', label: 'رشة تيرولية', unit: 'م²', category: 'أعمال الكتلة العامة' },
  { key: 'doorsMaintDouble', label: 'صيانة أبواب درفتين', unit: 'عدد', category: 'الصيانة' },
  { key: 'doorsMaintSingle', label: 'صيانة أبواب درفة', unit: 'عدد', category: 'الصيانة' },
  { key: 'doorsMaintAluminum', label: 'صيانة أبواب ألمنيوم', unit: 'عدد', category: 'الصيانة' },
  { key: 'windowsMaint', label: 'صيانة نوافذ ألمنيوم', unit: 'عدد', category: 'الصيانة' },
  { key: 'windowsMaintIron', label: 'صيانة نوافذ حديد', unit: 'عدد', category: 'الصيانة' },
  { key: 'block20', label: 'بناء بلوك 20', unit: 'م²', category: 'البلوك والطينة والهدم' },
  { key: 'block15', label: 'بناء بلوك 15', unit: 'م²', category: 'البلوك والطينة والهدم' },
  { key: 'block10', label: 'بناء بلوك 10', unit: 'م²', category: 'البلوك والطينة والهدم' },
  { key: 'demolition', label: 'هدم بلوك', unit: 'م²', category: 'البلوك والطينة والهدم' },
  { key: 'plaster', label: 'طينة', unit: 'م²', category: 'البلوك والطينة والهدم' },
  { key: 'stairSteps', label: 'قائمة + نائمة', unit: 'م²', category: 'الأرضيات والدرج' },
  { key: 'stairLanding', label: 'استراحة درج', unit: 'م²', category: 'الأرضيات والدرج' },
];

export function isBathroomSpaceType(type: SpaceType): boolean {
  return type === 'bathrooms' || type === 'prefab_bathrooms';
}

export const SPACE_TYPE_META: Record<
  SpaceType,
  { label: string; shortDesc: string }
> = {
  office_dorm: {
    label: 'مكتب / مهجع',
    shortDesc: 'جلي أرضيات + دهان جدران + دهان أسقف',
  },
  bathrooms: {
    label: 'حمامات / خلاءات',
    shortDesc: 'أبعاد الفراغ الكامل + فراغات فرعية (ارتفاع افتراضي 2م و 1×1 تلقائي)',
  },
  prefab_dorm: {
    label: 'مسبق صنع مهجع',
    shortDesc: 'مسبق صنع — دهان جدران + دهان أسقف + جلي أرضيات (قابل للتعديل)',
  },
  prefab_bathrooms: {
    label: 'مسبق صنع خلاءات',
    shortDesc: 'يعامل كخلاءات: أبعاد الفراغ الكامل + فراغات فرعية (2م و 1×1 تلقائي)',
  },
  buffet_kitchen: {
    label: 'بوفيه / مطبخ',
    shortDesc: 'بلاطات 60*60 + سيراميك جدران + أرضيات + المجلى',
  },
  corridor: {
    label: 'ممر',
    shortDesc: 'بلاطات 60*60 + جلي أرضيات + دهان جدران',
  },
  staircase: {
    label: 'بيت درج',
    shortDesc: 'حاسبة الدرج (قائمة + نائمة) + استراحة الدرج',
  },
  custom: {
    label: 'فراغ مخصص',
    shortDesc: 'تحكم يدوي كامل بجميع البنود',
  },
};

export const DOOR_TYPE_LABELS: Record<string, { label: string; unit: string }> = {
  wood: { label: 'أبواب خشب', unit: 'م²' },
  aluminum: { label: 'أبواب ألمنيوم', unit: 'م²' },
  iron_single: { label: 'أبواب حديد درفة (×40)', unit: 'كغ' },
  iron_double: { label: 'أبواب حديد درفتين (×40)', unit: 'كغ' },
  maint_single: { label: 'صيانة أبواب درفة', unit: 'عدد' },
  maint_double: { label: 'صيانة أبواب درفتين', unit: 'عدد' },
  maint_aluminum: { label: 'صيانة أبواب ألمنيوم', unit: 'عدد' },
};

export const WINDOW_TYPE_LABELS: Record<string, { label: string; unit: string }> = {
  aluminum: { label: 'نوافذ ألمنيوم (×1.3)', unit: 'م²' },
  iron: { label: 'نوافذ حديد (×16)', unit: 'كغ' },
  maint: { label: 'صيانة نوافذ ألمنيوم', unit: 'عدد' },
  maint_iron: { label: 'صيانة نوافذ حديد', unit: 'عدد' },
};

export const CEILING_TYPE_LABELS: Record<string, string> = {
  none: 'بدون سقف',
  paint: 'دهان أسقف',
  ceramic: 'سيراميك أسقف',
  tiles_60x60: 'بلاطات 60*60',
  gypsum: 'جبسن بورد',
  gypsum_and_paint: 'جبسن بورد ودهان',
};

export const CUSTOM_UNITS: CustomItemUnit[] = ['م²', 'م.ط', 'كغ', 'عدد', 'مقطوعية'];

export function createEmptyBOQ(): BOQQuantities {
  return {
    floorGrinding: 0,
    floorCeramic: 0,
    wallPaint: 0,
    wallCeramic: 0,
    ceilingPaint: 0,
    ceilingCeramic: 0,
    ceilingTiles60: 0,
    ceilingGypsum: 0,
    stairSteps: 0,
    stairLanding: 0,
    sink: 0,
    doorsWood: 0,
    doorsAluminum: 0,
    doorsIronSingle: 0,
    doorsIronDouble: 0,
    doorsMaintSingle: 0,
    doorsMaintDouble: 0,
    doorsMaintAluminum: 0,
    windowsAluminum: 0,
    windowsIron: 0,
    windowsMaint: 0,
    windowsMaintIron: 0,
    ironGrilles: 0,
    marbleSills: 0,
    block20: 0,
    block15: 0,
    block10: 0,
    plaster: 0,
    demolition: 0,
    roofWaterproofing: 0,
    roofTiles: 0,
    tyrolean: 0,
    custom: {},
  };
}

export function customItemKey(name: string, unit: CustomItemUnit): string {
  return `custom::${name.trim()}::${unit}`;
}

export function safeNum(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatNum(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 0.0001) return '0';
  return round2(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function calcMasonryArea(entry: MasonryEntry | DemolitionEntry): number {
  if (entry.mode === 'direct') {
    return safeNum(entry.directArea);
  }
  return safeNum(entry.length) * safeNum(entry.height);
}

export function calcCustomItemQty(item: CustomItem): number {
  if (item.mode === 'direct') {
    return safeNum(item.directQty);
  }
  const c = safeNum(item.count) || 1;
  return safeNum(item.length) * safeNum(item.width) * c;
}

export function createId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyMasonry(): MasonryEntry {
  return {
    mode: 'dims',
    directArea: 0,
    length: 0,
    height: 0,
    targetFinish: 'plaster',
  };
}

export function createEmptyDemolition(): DemolitionEntry {
  return {
    mode: 'dims',
    directArea: 0,
    length: 0,
    height: 0,
  };
}

export interface ResolvedSubRoom {
  id: string;
  label: string;
  length: number;
  width: number;
  height: number;
  wallArea: number;
  floorArea: number;
  lengthSource: 'entered' | 'inherited' | 'default';
  widthSource: 'entered' | 'inherited' | 'default';
  heightSource: 'entered' | 'inherited' | 'default';
}

/**
 * Resolves effective dimensions for bathroom sub-rooms:
 * - Default sub-room height is 2.0m (editable per sub-room).
 * - If a sub-room's L or W is left empty (0):
 *     - If Sub-room 1 has L/W entered, subsequent blank sub-rooms automatically inherit Sub-room 1's dimensions.
 *     - Otherwise (if forgot to enter any dimensions), automatically assumes 1m x 1m.
 */
export function resolveEffectiveSubRooms(subRooms: SubRoom[]): ResolvedSubRoom[] {
  if (!subRooms || subRooms.length === 0) return [];
  const first = subRooms[0];
  const firstL = safeNum(first.length);
  const firstW = safeNum(first.width);
  const firstH = safeNum(first.height);

  return subRooms.map((sr, idx) => {
    const rawL = safeNum(sr.length);
    const rawW = safeNum(sr.width);
    const rawH = safeNum(sr.height);

    let effL: number;
    let lengthSource: 'entered' | 'inherited' | 'default';
    if (rawL > 0) {
      effL = rawL;
      lengthSource = 'entered';
    } else if (idx > 0 && firstL > 0) {
      effL = firstL;
      lengthSource = 'inherited';
    } else {
      effL = 1;
      lengthSource = 'default';
    }

    let effW: number;
    let widthSource: 'entered' | 'inherited' | 'default';
    if (rawW > 0) {
      effW = rawW;
      widthSource = 'entered';
    } else if (idx > 0 && firstW > 0) {
      effW = firstW;
      widthSource = 'inherited';
    } else {
      effW = 1;
      widthSource = 'default';
    }

    let effH: number;
    let heightSource: 'entered' | 'inherited' | 'default';
    if (rawH > 0) {
      effH = rawH;
      heightSource = 'entered';
    } else if (idx > 0 && firstH > 0) {
      effH = firstH;
      heightSource = 'inherited';
    } else {
      effH = 2;
      heightSource = 'default';
    }

    return {
      id: sr.id,
      label: sr.label || `فراغ فرعي ${idx + 1}`,
      length: effL,
      width: effW,
      height: effH,
      floorArea: effL * effW,
      wallArea: 2 * (effL + effW) * effH,
      lengthSource,
      widthSource,
      heightSource,
    };
  });
}

export function applySpaceTypePreset(space: Space, nextType: SpaceType): Space {
  const base: Space = { ...space, spaceType: nextType };
  if (nextType === 'office_dorm' || nextType === 'prefab_dorm') {
    return {
      ...base,
      floorGrinding: true,
      floorCeramic: false,
      wallPaint: true,
      wallCeramic: false,
      ceilingType: 'paint',
    };
  }
  if (isBathroomSpaceType(nextType)) {
    const subRooms: SubRoom[] =
      base.subRooms.length > 0
        ? base.subRooms
        : [{ id: createId('sub'), label: 'فراغ فرعي 1', length: 0, width: 0, height: 2 }];
    return {
      ...base,
      height: base.height || 3,
      subRooms,
      floorGrinding: false,
      floorCeramic: true,
      wallPaint: false,
      wallCeramic: true,
      ceilingType: 'tiles_60x60',
    };
  }
  if (nextType === 'buffet_kitchen') {
    return {
      ...base,
      floorGrinding: false,
      floorCeramic: true,
      wallPaint: false,
      wallCeramic: true,
      ceilingType: 'tiles_60x60',
    };
  }
  if (nextType === 'corridor') {
    return {
      ...base,
      floorGrinding: true,
      floorCeramic: false,
      wallPaint: true,
      wallCeramic: false,
      ceilingType: 'tiles_60x60',
    };
  }
  if (nextType === 'staircase') {
    return {
      ...base,
      floorGrinding: false,
      floorCeramic: false,
      wallPaint: true,
      wallCeramic: false,
      ceilingType: 'paint',
      stairStepsCount: base.stairStepsCount || 18,
      stairStepLength: base.stairStepLength || 1.2,
    };
  }
  return base;
}

export function createNewSpace(name = 'فراغ جديد', spaceType: SpaceType = 'office_dorm'): Space {
  const blank: Space = {
    id: createId('sp'),
    name,
    spaceType,
    multiplier: 1,
    note: '',
    length: 0,
    width: 0,
    height: 3,
    subRooms: [],
    stairStepsCount: 0,
    stairStepLength: 0,
    landingLength: 0,
    landingWidth: 0,
    floorGrinding: false,
    floorCeramic: false,
    wallPaint: false,
    wallCeramic: false,
    wallFullPlaster: false,
    ceilingType: 'none',
    sinkLength: 0,
    doors: [
      {
        id: createId('dr'),
        type: 'wood',
        width: 1,
        height: 2,
        count: 1,
        hasIronGrille: false,
      },
    ],
    windows: [],
    block20: createEmptyMasonry(),
    block15: createEmptyMasonry(),
    block10: createEmptyMasonry(),
    demolition: createEmptyDemolition(),
    extraPlaster: 0,
    customItems: [],
  };
  return applySpaceTypePreset(blank, spaceType);
}

export function calculateSpace(space: Space): SpaceCalculationResult {
  const mult = Math.max(1, Math.floor(safeNum(space.multiplier)) || 1);
  const boq = createEmptyBOQ();

  // 1. Floor & Gross Wall Area
  const mainL = safeNum(space.length);
  const mainW = safeNum(space.width);
  const mainH = safeNum(space.height);

  let singleFloorArea = mainL * mainW;
  let singleMainWallArea = 2 * (mainL + mainW) * mainH;
  let singleSubRoomsWallArea = 0;

  if (isBathroomSpaceType(space.spaceType)) {
    const resolvedSubs = resolveEffectiveSubRooms(space.subRooms);
    let subFloorSum = 0;
    for (const sub of resolvedSubs) {
      subFloorSum += sub.floorArea;
      singleSubRoomsWallArea += sub.wallArea;
    }
    // Main room floor covers the whole bathroom hall; fallback to sub-rooms sum only if main L/W left 0
    if (singleFloorArea <= 0 && subFloorSum > 0) {
      singleFloorArea = subFloorSum;
    }
  }

  const singleGrossWallArea = singleMainWallArea + singleSubRoomsWallArea;

  // 2. Openings (Doors + Windows) & Auto-Deduction
  let singleDoorsArea = 0;
  let singleWindowsArea = 0;

  for (const d of space.doors) {
    const w = safeNum(d.width);
    const h = safeNum(d.height);
    const n = safeNum(d.count);
    const area = w * h * n;
    singleDoorsArea += area;

    switch (d.type) {
      case 'wood':
        boq.doorsWood += area * mult;
        break;
      case 'aluminum':
        boq.doorsAluminum += area * mult;
        break;
      case 'iron_single':
        boq.doorsIronSingle += area * 40 * mult;
        break;
      case 'iron_double':
        boq.doorsIronDouble += area * 40 * mult;
        break;
      case 'maint_single':
        boq.doorsMaintSingle += n * mult;
        break;
      case 'maint_double':
        boq.doorsMaintDouble += n * mult;
        break;
      case 'maint_aluminum':
        boq.doorsMaintAluminum += n * mult;
        break;
    }

    // حمايات أبواب (Door iron security grille: W * H * N * 16 kg)
    if (d.hasIronGrille) {
      boq.ironGrilles += area * 16 * mult;
    }
  }

  for (const win of space.windows) {
    const w = safeNum(win.width);
    const h = safeNum(win.height);
    const n = safeNum(win.count);
    const area = w * h * n;
    singleWindowsArea += area;

    switch (win.type) {
      case 'aluminum':
        boq.windowsAluminum += area * 1.3 * mult;
        break;
      case 'iron':
        boq.windowsIron += area * 16 * mult;
        break;
      case 'maint':
        boq.windowsMaint += n * mult;
        break;
      case 'maint_iron':
        boq.windowsMaintIron += n * mult;
        break;
    }

    if (win.hasIronGrille) {
      boq.ironGrilles += area * 16 * mult;
    }
    if (win.hasMarbleSill) {
      boq.marbleSills += 2 * (w + h) * n * mult;
    }
  }

  const singleOpeningsArea = singleDoorsArea + singleWindowsArea;
  const singleNetWallArea = Math.max(0, singleGrossWallArea - singleOpeningsArea);

  // 3. Floor Finishes
  if (space.floorGrinding) {
    boq.floorGrinding += singleFloorArea * mult;
  }
  if (space.floorCeramic) {
    boq.floorCeramic += singleFloorArea * mult;
  }

  // 4. Ceilings
  switch (space.ceilingType) {
    case 'paint':
      boq.ceilingPaint += singleFloorArea * mult;
      break;
    case 'ceramic':
      boq.ceilingCeramic += singleFloorArea * mult;
      break;
    case 'tiles_60x60':
      boq.ceilingTiles60 += singleFloorArea * mult;
      break;
    case 'gypsum':
      boq.ceilingGypsum += singleFloorArea * mult;
      break;
    case 'gypsum_and_paint':
      boq.ceilingGypsum += singleFloorArea * mult;
      boq.ceilingPaint += singleFloorArea * mult;
      break;
  }

  // 5. Staircase Calculator
  if (space.spaceType === 'staircase') {
    const stepsCount = safeNum(space.stairStepsCount);
    const stepLen = safeNum(space.stairStepLength);
    // Formula: Steps Count * [ (L * 0.30) + (L * 0.15) ]
    const stepsArea = stepsCount * (stepLen * 0.3 + stepLen * 0.15);
    const landingArea = safeNum(space.landingLength) * safeNum(space.landingWidth);
    boq.stairSteps += stepsArea * mult;
    boq.stairLanding += landingArea * mult;
  }

  // 6. Sink
  boq.sink += safeNum(space.sinkLength) * mult;

  // 7. Masonry & Automatic 2x Plaster / Ceramic Link
  const b20 = calcMasonryArea(space.block20);
  const b15 = calcMasonryArea(space.block15);
  const b10 = calcMasonryArea(space.block10);
  const demo = calcMasonryArea(space.demolition);

  boq.block20 += b20 * mult;
  boq.block15 += b15 * mult;
  boq.block10 += b10 * mult;
  boq.demolition += demo * mult;

  let blockToPlaster = 0;
  let blockToCeramic = 0;

  if (space.block20.targetFinish === 'ceramic') blockToCeramic += b20;
  else blockToPlaster += b20;

  if (space.block15.targetFinish === 'ceramic') blockToCeramic += b15;
  else blockToPlaster += b15;

  if (space.block10.targetFinish === 'ceramic') blockToCeramic += b10;
  else blockToPlaster += b10;

  // 8. Walls & Plaster
  if (space.wallPaint) {
    boq.wallPaint += singleNetWallArea * mult;
  }
  const ceramicFromRoom = space.wallCeramic ? singleNetWallArea : 0;
  boq.wallCeramic += (ceramicFromRoom + blockToCeramic * 2) * mult;

  const plasterFromRoom = space.wallFullPlaster ? singleNetWallArea : 0;
  const plasterExtra = safeNum(space.extraPlaster);
  boq.plaster += (blockToPlaster * 2 + plasterFromRoom + plasterExtra) * mult;

  // 9. Custom Contingency Items
  for (const item of space.customItems) {
    const trimmed = item.name.trim();
    if (!trimmed) continue;
    const qty = calcCustomItemQty(item) * mult;
    if (qty > 0) {
      const k = customItemKey(trimmed, item.unit);
      boq.custom[k] = (boq.custom[k] || 0) + qty;
    }
  }

  return {
    singleFloorArea,
    singleMainWallArea,
    singleSubRoomsWallArea,
    singleGrossWallArea,
    singleOpeningsArea,
    singleDoorsArea,
    singleWindowsArea,
    singleNetWallArea,
    singleNewBlockArea: b20 + b15 + b10,
    multiplier: mult,
    boq,
  };
}

export function sumBOQs(list: BOQQuantities[]): BOQQuantities {
  const total = createEmptyBOQ();
  for (const q of list) {
    for (const col of STANDARD_BOQ_COLUMNS) {
      total[col.key] += q[col.key];
    }
    for (const [k, v] of Object.entries(q.custom)) {
      total.custom[k] = (total.custom[k] || 0) + v;
    }
  }
  return total;
}

export interface BlockGeneralWorksCalc {
  autoRoofArea: number;
  roofWaterproofing: number;
  roofTiles: number;
  tyroleanGross: number;
  exteriorOpeningsArea: number;
  tyroleanNet: number;
  boq: BOQQuantities;
}

export function calculateBlockGeneralWorks(block: Block): BlockGeneralWorksCalc {
  const gw = block.generalWorks;

  // Top floor auto roof area: last floor that contains spaces (or last floor)
  let topFloor = block.floors[block.floors.length - 1];
  for (let i = block.floors.length - 1; i >= 0; i--) {
    if (block.floors[i].spaces.length > 0) {
      topFloor = block.floors[i];
      break;
    }
  }

  let autoRoofArea = 0;
  if (topFloor) {
    for (const sp of topFloor.spaces) {
      const res = calculateSpace(sp);
      autoRoofArea += res.singleFloorArea * res.multiplier;
    }
  }

  // Sum exterior openings across all spaces in block (all windows + iron exterior doors)
  let exteriorOpeningsArea = 0;
  for (const floor of block.floors) {
    for (const sp of floor.spaces) {
      const mult = Math.max(1, Math.floor(safeNum(sp.multiplier)) || 1);
      for (const win of sp.windows) {
        exteriorOpeningsArea += safeNum(win.width) * safeNum(win.height) * safeNum(win.count) * mult;
      }
      for (const d of sp.doors) {
        if (d.type === 'iron_single' || d.type === 'iron_double') {
          exteriorOpeningsArea += safeNum(d.width) * safeNum(d.height) * safeNum(d.count) * mult;
        }
      }
    }
  }

  const roofWaterproofing =
    gw.roofWaterproofingMode === 'none'
      ? 0
      : gw.roofWaterproofingMode === 'auto'
      ? autoRoofArea
      : safeNum(gw.roofWaterproofingManual);
  const roofTiles = safeNum(gw.roofTilesArea);

  let tyroleanGross = 0;
  if (gw.tyroleanMode === 'facades') {
    for (const f of gw.facades) {
      tyroleanGross += safeNum(f.length) * safeNum(f.height);
    }
  } else {
    tyroleanGross = safeNum(gw.perimeterLength) * safeNum(gw.totalFloorsHeight);
  }

  const tyroleanNet = gw.deductExteriorOpenings
    ? Math.max(0, tyroleanGross - exteriorOpeningsArea)
    : tyroleanGross;

  const boq = createEmptyBOQ();
  boq.roofWaterproofing = roofWaterproofing;
  boq.roofTiles = roofTiles;
  boq.tyrolean = tyroleanNet;

  for (const item of gw.customItems) {
    const trimmed = item.name.trim();
    if (!trimmed) continue;
    const qty = calcCustomItemQty(item);
    if (qty > 0) {
      const k = customItemKey(trimmed, item.unit);
      boq.custom[k] = (boq.custom[k] || 0) + qty;
    }
  }

  return {
    autoRoofArea,
    roofWaterproofing,
    roofTiles,
    tyroleanGross,
    exteriorOpeningsArea,
    tyroleanNet,
    boq,
  };
}

export interface BlockSummary {
  totalSpacesCount: number;
  totalEffectiveRooms: number;
  totalFloorArea: number;
  generalWorks: BlockGeneralWorksCalc;
  boq: BOQQuantities;
}

export function calculateBlockSummary(block: Block): BlockSummary {
  const spaceBOQs: BOQQuantities[] = [];
  let totalSpacesCount = 0;
  let totalEffectiveRooms = 0;
  let totalFloorArea = 0;

  for (const floor of block.floors) {
    for (const sp of floor.spaces) {
      totalSpacesCount += 1;
      const calc = calculateSpace(sp);
      totalEffectiveRooms += calc.multiplier;
      totalFloorArea += calc.singleFloorArea * calc.multiplier;
      spaceBOQs.push(calc.boq);
    }
  }

  const generalWorks = calculateBlockGeneralWorks(block);
  const boq = sumBOQs([...spaceBOQs, generalWorks.boq]);

  return {
    totalSpacesCount,
    totalEffectiveRooms,
    totalFloorArea,
    generalWorks,
    boq,
  };
}

export function calculateProjectBOQ(project: Project): BOQQuantities {
  return sumBOQs(project.blocks.map((b) => calculateBlockSummary(b).boq));
}

export function collectProjectCustomColumns(project: Project): CustomColumnMeta[] {
  const map = new Map<string, CustomColumnMeta>();
  const register = (items: CustomItem[]) => {
    for (const item of items) {
      const trimmed = item.name.trim();
      if (!trimmed) continue;
      const key = customItemKey(trimmed, item.unit);
      if (!map.has(key)) {
        map.set(key, { key, name: trimmed, unit: item.unit });
      }
    }
  };

  for (const block of project.blocks) {
    register(block.generalWorks.customItems);
    for (const floor of block.floors) {
      for (const sp of floor.spaces) {
        register(sp.customItems);
      }
    }
  }

  return Array.from(map.values());
}

export function calculateBOQCost(
  boq: BOQQuantities,
  unitPrices: Record<string, number>,
  customCols: CustomColumnMeta[]
): number {
  let total = 0;
  for (const col of STANDARD_BOQ_COLUMNS) {
    const qty = boq[col.key];
    const price = safeNum(unitPrices[col.key]);
    total += qty * price;
  }
  for (const c of customCols) {
    const qty = boq.custom[c.key] || 0;
    const price = safeNum(unitPrices[c.key]);
    total += qty * price;
  }
  return total;
}
