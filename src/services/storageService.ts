import { AppWorkspaceState, Block, Project } from '../types/boq';
import { createEmptyDemolition, createEmptyMasonry, createId, createNewSpace } from '../utils/calculations';

const STORAGE_KEY = 'boq_site_surveyor_workspace_v1';

/**
 * Modular Storage Adapter Interface.
 * Ready to plug in a FirebaseFirestoreAdapter later without modifying UI components.
 */
export interface StorageAdapter {
  loadWorkspace(): AppWorkspaceState | null;
  saveWorkspace(state: AppWorkspaceState): void;
  clearWorkspace(): void;
}

class LocalStorageAdapter implements StorageAdapter {
  loadWorkspace(): AppWorkspaceState | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AppWorkspaceState;
      if (!parsed || !Array.isArray(parsed.projects) || parsed.projects.length === 0) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  saveWorkspace(state: AppWorkspaceState): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to persist BOQ workspace to localStorage:', err);
    }
  }

  clearWorkspace(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }
}

export function createNewBlock(name = 'بناء جديد'): Block {
  const now = new Date().toISOString();
  return {
    id: createId('blk'),
    name,
    isClosed: false,
    generalNotes: '',
    floors: [
      {
        id: createId('flr'),
        name: 'طابق أرضي',
        spaces: [],
      },
    ],
    generalWorks: {
      roofWaterproofingMode: 'auto',
      roofWaterproofingManual: 0,
      roofTilesArea: 0,
      tyroleanMode: 'facades',
      facades: [],
      perimeterLength: 0,
      totalFloorsHeight: 0,
      deductExteriorOpenings: true,
      customItems: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankProject(name = ''): Project {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: createId('prj'),
    name,
    location: '',
    date: today,
    generalNotes: '',
    blocks: [createNewBlock('البناء 1')],
    unitPrices: {},
    currency: 'USD',
    status: 'active',
    updatedAt: new Date().toISOString(),
  };
}

function createStarterWorkspace(): AppWorkspaceState {
  const today = new Date().toISOString().slice(0, 10);
  const officeSpace = createNewSpace('مكتب الإدارة 101', 'office_dorm');
  officeSpace.length = 5.5;
  officeSpace.width = 4.2;
  officeSpace.height = 3.2;
  officeSpace.multiplier = 2;
  officeSpace.note = 'غرفتان متماثلتان في الجناح الشرقي';
  officeSpace.doors = [
    { id: createId('dr'), type: 'wood', width: 1.0, height: 2.1, count: 1 },
  ];
  officeSpace.windows = [
    {
      id: createId('wn'),
      type: 'aluminum',
      width: 1.6,
      height: 1.4,
      count: 2,
      hasIronGrille: true,
      hasMarbleSill: true,
    },
  ];
  officeSpace.extraPlaster = 4.5;

  const bathSpace = createNewSpace('مجموعة حمامات الطابق الأرضي', 'bathrooms');
  bathSpace.subRooms = [
    { id: createId('sub'), label: 'فراغ 1 (مغاسل)', length: 3.0, width: 2.0, height: 3.0 },
    { id: createId('sub'), label: 'فراغ 2 (خلاء 1)', length: 1.6, width: 1.2, height: 3.0 },
    { id: createId('sub'), label: 'فراغ 3 (خلاء 2)', length: 1.6, width: 1.2, height: 3.0 },
  ];
  bathSpace.doors = [
    { id: createId('dr'), type: 'aluminum', width: 0.8, height: 2.0, count: 3 },
  ];
  bathSpace.windows = [
    {
      id: createId('wn'),
      type: 'aluminum',
      width: 0.6,
      height: 0.6,
      count: 2,
      hasIronGrille: true,
      hasMarbleSill: false,
    },
  ];
  bathSpace.block10 = {
    ...createEmptyMasonry(),
    mode: 'dims',
    length: 3.2,
    height: 3.0,
    targetFinish: 'ceramic',
  };
  bathSpace.demolition = {
    ...createEmptyDemolition(),
    mode: 'direct',
    directArea: 4.0,
  };

  const block1 = createNewBlock('كتلة المكاتب والمهاجع');
  block1.generalNotes = 'يحتاج السطح لتنظيف قبل تنفيذ العزل، والواجهة الشرقية بحاجة لصيانة الرشة.';
  block1.floors = [
    {
      id: createId('flr'),
      name: 'طابق أرضي',
      spaces: [officeSpace, bathSpace],
    },
  ];
  block1.generalWorks.facades = [
    { id: createId('fac'), label: 'الواجهة الأمامية', length: 18, height: 3.6 },
    { id: createId('fac'), label: 'الواجهة الجانبية', length: 12, height: 3.6 },
  ];

  const starterProject: Project = {
    id: createId('prj'),
    name: 'مشروع تأهيل المباني الإدارية',
    location: 'الموقع الرئيسي — القطاع الشمالي',
    date: today,
    generalNotes: 'الرفع الميداني الأولي لتحديد كميات أعمال التأهيل المعماري والإنشائي.',
    blocks: [block1],
    unitPrices: {},
    currency: 'USD',
    status: 'active',
    updatedAt: new Date().toISOString(),
  };

  return {
    version: 1,
    projects: [starterProject],
    activeProjectId: starterProject.id,
    trash: [],
  };
}

class StorageService {
  private adapter: StorageAdapter;

  constructor(adapter: StorageAdapter = new LocalStorageAdapter()) {
    this.adapter = adapter;
  }

  /**
   * Swap storage backend (e.g., to Firebase Firestore adapter) at runtime.
   */
  setAdapter(adapter: StorageAdapter): void {
    this.adapter = adapter;
  }

  load(): AppWorkspaceState {
    const existing = this.adapter.loadWorkspace();
    if (existing) return existing;
    const starter = createStarterWorkspace();
    this.adapter.saveWorkspace(starter);
    return starter;
  }

  save(state: AppWorkspaceState): void {
    this.adapter.saveWorkspace(state);
  }

  exportJSONBackup(state: AppWorkspaceState): void {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `BOQ_Backup_${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  parseJSONBackup(rawText: string): AppWorkspaceState {
    const parsed = JSON.parse(rawText) as Partial<AppWorkspaceState>;
    if (!parsed || !Array.isArray(parsed.projects) || parsed.projects.length === 0) {
      throw new Error('ملف النسخة الاحتياطية غير صالح أو لا يحتوي على مشاريع.');
    }
    const validActiveId = parsed.projects.some((p) => p.id === parsed.activeProjectId)
      ? (parsed.activeProjectId as string)
      : parsed.projects[0].id;

    return {
      version: parsed.version || 1,
      projects: parsed.projects,
      activeProjectId: validActiveId,
      trash: Array.isArray(parsed.trash) ? parsed.trash : [],
    };
  }
}

export const storageService = new StorageService();
