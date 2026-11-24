export type SpaceType =
  | 'office_dorm'
  | 'bathrooms'
  | 'buffet_kitchen'
  | 'corridor'
  | 'staircase'
  | 'custom';

export type CeilingType =
  | 'none'
  | 'paint'
  | 'ceramic'
  | 'tiles_60x60'
  | 'gypsum'
  | 'gypsum_and_paint';

export type DoorType =
  | 'wood'
  | 'aluminum'
  | 'iron_single'
  | 'iron_double'
  | 'maint_single'
  | 'maint_double';

export type WindowType = 'aluminum' | 'iron' | 'maint';

export type CustomItemUnit = 'م²' | 'م.ط' | 'كغ' | 'عدد' | 'مقطوعية';

export interface SubRoom {
  id: string;
  label: string;
  length: number;
  width: number;
  height: number;
}

export interface DoorEntry {
  id: string;
  type: DoorType;
  width: number;
  height: number;
  count: number;
}

export interface WindowEntry {
  id: string;
  type: WindowType;
  width: number;
  height: number;
  count: number;
  hasIronGrille: boolean;
  hasMarbleSill: boolean;
}

export interface MasonryEntry {
  mode: 'direct' | 'dims';
  directArea: number;
  length: number;
  height: number;
  targetFinish: 'plaster' | 'ceramic';
}

export interface DemolitionEntry {
  mode: 'direct' | 'dims';
  directArea: number;
  length: number;
  height: number;
}

export interface CustomItem {
  id: string;
  name: string;
  unit: CustomItemUnit;
  mode: 'direct' | 'dims';
  directQty: number;
  length: number;
  width: number;
  count: number;
}

export interface Space {
  id: string;
  name: string;
  spaceType: SpaceType;
  multiplier: number;
  note: string;
  length: number;
  width: number;
  height: number;
  subRooms: SubRoom[];
  stairStepsCount: number;
  stairStepLength: number;
  landingLength: number;
  landingWidth: number;
  floorGrinding: boolean;
  floorCeramic: boolean;
  wallPaint: boolean;
  wallCeramic: boolean;
  wallFullPlaster: boolean;
  ceilingType: CeilingType;
  sinkLength: number;
  doors: DoorEntry[];
  windows: WindowEntry[];
  block20: MasonryEntry;
  block15: MasonryEntry;
  block10: MasonryEntry;
  demolition: DemolitionEntry;
  extraPlaster: number;
  customItems: CustomItem[];
}

export interface Floor {
  id: string;
  name: string;
  spaces: Space[];
}

export interface ExteriorFacade {
  id: string;
  label: string;
  length: number;
  height: number;
}

export interface BlockGeneralWorks {
  roofWaterproofingMode: 'auto' | 'manual';
  roofWaterproofingManual: number;
  roofTilesArea: number;
  tyroleanMode: 'facades' | 'perimeter';
  facades: ExteriorFacade[];
  perimeterLength: number;
  totalFloorsHeight: number;
  deductExteriorOpenings: boolean;
  customItems: CustomItem[];
}

export interface Block {
  id: string;
  name: string;
  isClosed: boolean;
  generalNotes: string;
  floors: Floor[];
  generalWorks: BlockGeneralWorks;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  date: string;
  generalNotes: string;
  blocks: Block[];
  unitPrices: Record<string, number>;
  currency: string;
  status?: 'active' | 'archived';
  archivedAt?: string;
  updatedAt: string;
}

export interface TrashItem {
  id: string;
  deletedAt: string;
  kind: 'block' | 'space';
  projectId: string;
  blockId?: string;
  blockName: string;
  floorId?: string;
  floorName?: string;
  data: Block | Space;
}

export interface AppWorkspaceState {
  version: number;
  projects: Project[];
  activeProjectId: string;
  trash: TrashItem[];
}

export interface BOQQuantities {
  floorGrinding: number;
  floorCeramic: number;
  wallPaint: number;
  wallCeramic: number;
  ceilingPaint: number;
  ceilingCeramic: number;
  ceilingTiles60: number;
  ceilingGypsum: number;
  stairSteps: number;
  stairLanding: number;
  sink: number;
  doorsWood: number;
  doorsAluminum: number;
  doorsIronSingle: number;
  doorsIronDouble: number;
  doorsMaintSingle: number;
  doorsMaintDouble: number;
  windowsAluminum: number;
  windowsIron: number;
  windowsMaint: number;
  ironGrilles: number;
  marbleSills: number;
  block20: number;
  block15: number;
  block10: number;
  plaster: number;
  demolition: number;
  roofWaterproofing: number;
  roofTiles: number;
  tyrolean: number;
  custom: Record<string, number>;
}

export interface SpaceCalculationResult {
  singleFloorArea: number;
  singleGrossWallArea: number;
  singleOpeningsArea: number;
  singleDoorsArea: number;
  singleWindowsArea: number;
  singleNetWallArea: number;
  singleNewBlockArea: number;
  multiplier: number;
  boq: BOQQuantities;
}

export interface CustomColumnMeta {
  key: string; // custom::name::unit
  name: string;
  unit: CustomItemUnit;
}

export interface BOQColumnDef {
  key: keyof Omit<BOQQuantities, 'custom'>;
  label: string;
  unit: string;
  category: string;
}
