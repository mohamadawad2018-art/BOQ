import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  Building2,
  Calculator,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import { BlockCard } from './components/BlockCard';
import { BOQSummaryView } from './components/BOQSummaryView';
import { ConfirmModal } from './components/NumericInput';
import { PricingView } from './components/PricingView';
import { ProjectsRegistryView } from './components/ProjectsRegistryView';
import { OfflineBanner, PWAInstallButton } from './components/PWAInstallButton';
import { ResetProjectModal } from './components/ResetProjectModal';
import { TrashDrawer } from './components/TrashDrawer';
import { exportProjectToExcel } from './services/excelExportService';
import { createBlankProject, createNewBlock, storageService } from './services/storageService';
import { AppWorkspaceState, Block, Floor, Project, Space, TrashItem } from './types/boq';
import { createId } from './utils/calculations';

type ActiveTab = 'survey' | 'summary' | 'pricing' | 'registry';

interface ToastMessage {
  id: string;
  text: string;
  undoTrashItem?: TrashItem;
}

export default function App() {
  const [workspace, setWorkspace] = useState<AppWorkspaceState>(() => storageService.load());
  const [activeTab, setActiveTab] = useState<ActiveTab>('survey');
  const [trashOpen, setTrashOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Instant 100% offline auto-save on every state change
  useEffect(() => {
    storageService.save(workspace);
  }, [workspace]);

  const showToast = (text: string, undoTrashItem?: TrashItem) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: createId('tst'), text, undoTrashItem });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  const activeProject: Project =
    workspace.projects.find((p) => p.id === workspace.activeProjectId) || workspace.projects[0];

  const updateActiveProject = (updater: (project: Project) => Project) => {
    setWorkspace((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === activeProject.id
          ? { ...updater(p), updatedAt: new Date().toISOString() }
          : p
      ),
    }));
  };

  // =========================================================================
  // RESET & PROJECTS REGISTRY WORKFLOW
  // =========================================================================
  const handleArchiveAndStartNew = (nextProjectName: string) => {
    const now = new Date().toISOString();
    const freshProject = createBlankProject(nextProjectName);

    setWorkspace((prev) => {
      const updatedProjects = prev.projects.map((p) => {
        if (p.id !== activeProject.id) return p;
        return {
          ...p,
          name: p.name.trim() || `مشروع محفوظ (${p.date || now.slice(0, 10)})`,
          status: 'archived' as const,
          archivedAt: now,
          updatedAt: now,
        };
      });
      return {
        ...prev,
        projects: [freshProject, ...updatedProjects],
        activeProjectId: freshProject.id,
      };
    });

    setResetModalOpen(false);
    setActiveTab('survey');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('تم حفظ المشروع في «سجل المشاريع» وتصفير الملف لمشروع جديد');
  };

  const handleResetCurrentOnly = () => {
    const blank = createBlankProject('');
    setWorkspace((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === activeProject.id ? { ...blank, id: p.id } : p
      ),
    }));
    setResetModalOpen(false);
    setActiveTab('survey');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('تم تصفير الملف الحالي بالكامل');
  };

  const handleOpenProjectFromRegistry = (projectId: string) => {
    setWorkspace((prev) => ({
      ...prev,
      activeProjectId: projectId,
    }));
    setActiveTab('survey');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const target = workspace.projects.find((p) => p.id === projectId);
    showToast(`تم فتح المشروع "${target?.name || 'بدون اسم'}" للتعديل`);
  };

  const handleCloneProjectFromRegistry = (source: Project) => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const cloned: Project = {
      ...JSON.parse(JSON.stringify(source)),
      id: createId('prj'),
      name: `${source.name || 'مشروع'} (نسخة)`,
      date: today,
      status: 'active',
      archivedAt: undefined,
      updatedAt: now,
      blocks: source.blocks.map((b) => ({
        ...JSON.parse(JSON.stringify(b)),
        id: createId('blk'),
        isClosed: false,
        floors: b.floors.map((f) => ({
          ...JSON.parse(JSON.stringify(f)),
          id: createId('flr'),
          spaces: f.spaces.map((s) => ({
            ...JSON.parse(JSON.stringify(s)),
            id: createId('sp'),
          })),
        })),
      })),
    };

    setWorkspace((prev) => ({
      ...prev,
      projects: [cloned, ...prev.projects],
      activeProjectId: cloned.id,
    }));
    setActiveTab('survey');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`تم نسخ المشروع كـ "${cloned.name}"`);
  };

  const handleRequestDeleteProject = (targetProject: Project) => {
    if (workspace.projects.length <= 1) return;
    setConfirmState({
      open: true,
      title: `حذف المشروع "${targetProject.name || 'بدون اسم'}" من السجل؟`,
      message:
        'سيتم حذف هذا المشروع نهائياً من الجهاز. يُنصح بتحميل نسخة احتياطية JSON قبل الحذف إذا كنت ستحتاجه لاحقاً.',
      confirmLabel: 'حذف المشروع نهائياً',
      onConfirm: () => {
        setWorkspace((prev) => {
          const remaining = prev.projects.filter((p) => p.id !== targetProject.id);
          const nextActive =
            prev.activeProjectId === targetProject.id ? remaining[0].id : prev.activeProjectId;
          return {
            ...prev,
            projects: remaining,
            activeProjectId: nextActive,
          };
        });
        setConfirmState(null);
        showToast('تم حذف المشروع من السجل');
      },
    });
  };

  // =========================================================================
  // BLOCK & FLOOR OPERATIONS
  // =========================================================================
  const handleUpdateBlock = (updatedBlock: Block) => {
    updateActiveProject((proj) => ({
      ...proj,
      blocks: proj.blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)),
    }));
  };

  const handleAddBlock = () => {
    const nextNum = activeProject.blocks.length + 1;
    const fresh = createNewBlock(`البناء ${nextNum}`);
    updateActiveProject((proj) => ({
      ...proj,
      blocks: [...proj.blocks, fresh],
    }));
    showToast(`تم فتح ${fresh.name}`);
  };

  const handleFinishAndAddNewBlock = (blockId: string) => {
    const nextNum = activeProject.blocks.length + 1;
    const fresh = createNewBlock(`البناء ${nextNum}`);
    updateActiveProject((proj) => ({
      ...proj,
      blocks: [
        ...proj.blocks.map((b) => (b.id === blockId ? { ...b, isClosed: true } : b)),
        fresh,
      ],
    }));
    showToast('تم إغلاق البناء وفتح بناء جديد للمسح');
  };

  const handleCloseBlockOnly = (blockId: string) => {
    updateActiveProject((proj) => ({
      ...proj,
      blocks: proj.blocks.map((b) => (b.id === blockId ? { ...b, isClosed: true } : b)),
    }));
    showToast('تم إغلاق وطي البناء — اضغط عليه في أي وقت للتعديل');
  };

  const handleReopenBlock = (blockId: string) => {
    updateActiveProject((proj) => ({
      ...proj,
      blocks: proj.blocks.map((b) => (b.id === blockId ? { ...b, isClosed: false } : b)),
    }));
  };

  const handleDuplicateBlock = (source: Block) => {
    const now = new Date().toISOString();
    const cloned: Block = {
      ...JSON.parse(JSON.stringify(source)),
      id: createId('blk'),
      name: `${source.name} (نسخة)`,
      isClosed: false,
      createdAt: now,
      updatedAt: now,
      floors: source.floors.map((f) => ({
        ...JSON.parse(JSON.stringify(f)),
        id: createId('flr'),
        spaces: f.spaces.map((s) => ({
          ...JSON.parse(JSON.stringify(s)),
          id: createId('sp'),
        })),
      })),
    };
    updateActiveProject((proj) => {
      const idx = proj.blocks.findIndex((b) => b.id === source.id);
      const next = [...proj.blocks];
      next.splice(idx + 1, 0, cloned);
      return { ...proj, blocks: next };
    });
    showToast(`تم تكرار البناء "${source.name}"`);
  };

  const handleDeleteFloorToTrash = (block: Block, floor: Floor) => {
    const performDelete = () => {
      const now = new Date().toISOString();
      const newTrashItems: TrashItem[] = floor.spaces.map((sp) => ({
        id: createId('tr'),
        deletedAt: now,
        kind: 'space',
        projectId: activeProject.id,
        blockId: block.id,
        blockName: block.name,
        floorId: floor.id,
        floorName: floor.name,
        data: sp,
      }));

      setWorkspace((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => {
          if (p.id !== activeProject.id) return p;
          return {
            ...p,
            blocks: p.blocks.map((b) =>
              b.id === block.id
                ? {
                    ...b,
                    floors: b.floors.filter((f) => f.id !== floor.id),
                    updatedAt: now,
                  }
                : b
            ),
            updatedAt: now,
          };
        }),
        trash: [...newTrashItems, ...prev.trash],
      }));
      setConfirmState(null);
      showToast(
        floor.spaces.length > 0
          ? `تم حذف "${floor.name}" ونقل ${floor.spaces.length} فراغ إلى سلة المحذوفات`
          : `تم حذف "${floor.name}"`
      );
    };

    if (floor.spaces.length > 0) {
      setConfirmState({
        open: true,
        title: `حذف "${floor.name}"؟`,
        message: `يحتوي هذا الطابق على ${floor.spaces.length} فراغ. سيتم نقل جميع فراغاته إلى سلة المحذوفات لإمكانية استعادتها لاحقاً.`,
        confirmLabel: 'حذف الطابق ونقل الفراغات للسلة',
        onConfirm: performDelete,
      });
    } else {
      performDelete();
    }
  };

  const handleRequestDeleteBlock = (block: Block) => {
    setConfirmState({
      open: true,
      title: `حذف البناء "${block.name}"؟`,
      message:
        'سيتم نقل البناء بكامل طوابقه وفراغاته إلى سلة المحذوفات، ويمكنك استعادته في أي وقت.',
      confirmLabel: 'نقل إلى سلة المحذوفات',
      onConfirm: () => {
        const trashItem: TrashItem = {
          id: createId('tr'),
          deletedAt: new Date().toISOString(),
          kind: 'block',
          projectId: activeProject.id,
          blockId: block.id,
          blockName: block.name,
          data: block,
        };
        setWorkspace((prev) => ({
          ...prev,
          projects: prev.projects.map((p) =>
            p.id === activeProject.id
              ? {
                  ...p,
                  blocks: p.blocks.filter((b) => b.id !== block.id),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
          trash: [trashItem, ...prev.trash],
        }));
        setConfirmState(null);
        showToast(`تم نقل "${block.name}" إلى سلة المحذوفات`, trashItem);
      },
    });
  };

  const handleDeleteSpaceToTrash = (
    block: Block,
    floorId: string,
    floorName: string,
    space: Space
  ) => {
    const trashItem: TrashItem = {
      id: createId('tr'),
      deletedAt: new Date().toISOString(),
      kind: 'space',
      projectId: activeProject.id,
      blockId: block.id,
      blockName: block.name,
      floorId,
      floorName,
      data: space,
    };

    setWorkspace((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => {
        if (p.id !== activeProject.id) return p;
        return {
          ...p,
          blocks: p.blocks.map((b) => {
            if (b.id !== block.id) return b;
            return {
              ...b,
              floors: b.floors.map((f) =>
                f.id === floorId
                  ? { ...f, spaces: f.spaces.filter((s) => s.id !== space.id) }
                  : f
              ),
            };
          }),
          updatedAt: new Date().toISOString(),
        };
      }),
      trash: [trashItem, ...prev.trash],
    }));

    showToast(`تم حذف الفراغ "${space.name}"`, trashItem);
  };

  // =========================================================================
  // TRASH RESTORE & BACKUPS
  // =========================================================================
  const handleRestoreTrashItem = (item: TrashItem) => {
    setWorkspace((prev) => {
      const targetProjExists = prev.projects.some((p) => p.id === item.projectId);
      const targetProjId = targetProjExists ? item.projectId : prev.activeProjectId;

      const nextProjects = prev.projects.map((p) => {
        if (p.id !== targetProjId) return p;

        if (item.kind === 'block') {
          const restoredBlock = item.data as Block;
          return {
            ...p,
            blocks: [...p.blocks, restoredBlock],
            updatedAt: new Date().toISOString(),
          };
        }

        const restoredSpace = item.data as Space;
        const targetBlockExists = p.blocks.some((b) => b.id === item.blockId);

        if (!targetBlockExists) {
          const fallbackBlock = createNewBlock(item.blockName || 'بناء مستعاد');
          fallbackBlock.floors[0].name = item.floorName || 'طابق أرضي';
          fallbackBlock.floors[0].spaces = [restoredSpace];
          return {
            ...p,
            blocks: [...p.blocks, fallbackBlock],
            updatedAt: new Date().toISOString(),
          };
        }

        return {
          ...p,
          blocks: p.blocks.map((b) => {
            if (b.id !== item.blockId) return b;
            const targetFloorExists = b.floors.some((f) => f.id === item.floorId);
            if (!targetFloorExists) {
              return {
                ...b,
                isClosed: false,
                floors: [
                  ...b.floors,
                  {
                    id: item.floorId || createId('flr'),
                    name: item.floorName || 'طابق مستعاد',
                    spaces: [restoredSpace],
                  },
                ],
              };
            }
            return {
              ...b,
              isClosed: false,
              floors: b.floors.map((f) =>
                f.id === item.floorId ? { ...f, spaces: [...f.spaces, restoredSpace] } : f
              ),
            };
          }),
          updatedAt: new Date().toISOString(),
        };
      });

      return {
        ...prev,
        projects: nextProjects,
        trash: prev.trash.filter((t) => t.id !== item.id),
      };
    });

    setToast(null);
    showToast('تمت الاستعادة بنجاح');
  };

  const handlePermanentDeleteTrash = (trashId: string) => {
    setWorkspace((prev) => ({
      ...prev,
      trash: prev.trash.filter((t) => t.id !== trashId),
    }));
  };

  const handleEmptyTrash = () => {
    setConfirmState({
      open: true,
      title: 'تفريغ سلة المحذوفات نهائياً؟',
      message: 'لن تتمكن من استعادة العناصر المحذوفة بعد تفريغ السلة.',
      confirmLabel: 'تفريغ السلة',
      onConfirm: () => {
        setWorkspace((prev) => ({ ...prev, trash: [] }));
        setConfirmState(null);
        showToast('تم تفريغ سلة المحذوفات');
      },
    });
  };

  const handleExportJSON = () => {
    storageService.exportJSONBackup(workspace);
    showToast('تم تحميل النسخة الاحتياطية الكاملة (JSON) شاملة سجل المشاريع');
  };

  const handleImportJSONFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = storageService.parseJSONBackup(String(reader.result || ''));
        setWorkspace(imported);
        showToast('تم استيراد النسخة الاحتياطية وسجل المشاريع بنجاح');
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'تعذر قراءة ملف النسخة الاحتياطية'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportProjectExcel = (projectToExport: Project) => {
    exportProjectToExcel(projectToExport);
    showToast(`تم تصدير ملف Excel للمشروع "${projectToExport.name || 'BOQ'}"`);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 pb-24 md:pb-12">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0b0f19]/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6">
          {/* Zone 1: Single-element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('survey')}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
          >
            حصر الكميات
          </button>

          {/* Zone 2: 5 concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('survey')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'survey'
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              المسح الميداني
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'summary'
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              ملخص الكميات
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pricing')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'pricing'
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              الأسعار الإفرادية
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('registry')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'registry'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              سجل المشاريع ({workspace.projects.length})
            </button>
            <button
              type="button"
              onClick={() => setTrashOpen(true)}
              className="py-1 text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 border-b-2 border-transparent"
            >
              المحذوفات{workspace.trash.length > 0 ? ` (${workspace.trash.length})` : ''}
            </button>
          </nav>

          {/* Zone 3: Single primary action CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handleExportProjectExcel(activeProject)}
              className="inline-flex items-center gap-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-[0_0_20px_-6px_rgba(16,185,129,0.7)] transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>تصدير ملف Excel</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-3.5 sm:px-6 pt-4 sm:pt-5 space-y-5">
        {/* Mobile & Desktop Quick Control Bar (Projects Registry, Reset/New, Backups, Install) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setResetModalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-emerald-500/45 bg-emerald-500/12 px-3.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              <span>تصفير / مشروع جديد</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('registry')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'registry'
                  ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-300'
                  : 'border-slate-800 bg-[#111827] text-slate-200 hover:border-cyan-500/40 hover:text-cyan-300'
              }`}
            >
              <Archive className="h-4 w-4 text-cyan-400" />
              <span>سجل المشاريع ({workspace.projects.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <PWAInstallButton />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportJSON}
                className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-[#111827] border border-slate-800 px-3 text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>نسخة JSON</span>
              </button>

              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-[#111827] border border-slate-800 px-3 text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors whitespace-nowrap"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>استيراد JSON</span>
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportJSONFile}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Project / Site Level Info (shown in Survey, Summary, Pricing; hidden in Registry for full screen focus) */}
        {activeTab !== 'registry' && (
          <section className="rounded-2xl bg-[#111827] border border-slate-800/90 p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-5 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">اسم المشروع</label>
                <input
                  type="text"
                  value={activeProject.name}
                  onChange={(e) =>
                    updateActiveProject((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="أدخل اسم المشروع الجديد..."
                  className="w-full min-h-[44px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 text-sm font-semibold text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>

              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">عنوان الموقع</label>
                <input
                  type="text"
                  value={activeProject.location}
                  onChange={(e) =>
                    updateActiveProject((p) => ({ ...p, location: e.target.value }))
                  }
                  placeholder="المدينة / المنطقة / القطاع"
                  className="w-full min-h-[44px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>

              <div className="md:col-span-3 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">التاريخ</label>
                <input
                  type="date"
                  value={activeProject.date}
                  onChange={(e) =>
                    updateActiveProject((p) => ({ ...p, date: e.target.value }))
                  }
                  className="font-num w-full min-h-[44px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 text-sm text-slate-100 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
            </div>

            {/* Expandable Site-Wide General Notes */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setNotesExpanded((v) => !v)}
                className="flex w-full items-center justify-between gap-2 py-1 text-right"
              >
                <span className="text-xs font-semibold text-cyan-400">
                  ملاحظات عامة للموقع ككل{' '}
                  {activeProject.generalNotes.trim() ? '· (مسجّلة)' : ''}
                </span>
                <span className="text-slate-400">
                  {notesExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </span>
              </button>
              {notesExpanded && (
                <textarea
                  rows={2}
                  value={activeProject.generalNotes}
                  onChange={(e) =>
                    updateActiveProject((p) => ({ ...p, generalNotes: e.target.value }))
                  }
                  placeholder="ظروف الوصول للموقع، حالة البنية التحتية، أو أي توصيات هندسية عامة للمشروع..."
                  className="mt-2 w-full rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/20 outline-none resize-y"
                />
              )}
            </div>
          </section>
        )}

        {/* Active View */}
        {activeTab === 'survey' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-slate-100">
                  الكتل والأبنية ({activeProject.blocks.length})
                </h1>
                <p className="text-xs text-slate-400">
                  الحفظ تلقائي على الجهاز — جميع تعديلاتك محفوظة ويمكن الرجوع لأي مشروع من «سجل المشاريع»
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddBlock}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة بناء / كتلة</span>
              </button>
            </div>

            {activeProject.blocks.length === 0 ? (
              <div className="rounded-2xl bg-[#111827] border border-dashed border-slate-800 py-14 px-6 text-center">
                <Building2 className="mx-auto h-10 w-10 text-slate-600" />
                <p className="mt-3 text-base font-semibold text-slate-200">
                  لا توجد كتل أو أبنية في هذا المشروع
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  ابدأ بإضافة أول بناء لرفع الطوابق والفراغات وحساب الكميات تلقائياً
                </p>
                <button
                  type="button"
                  onClick={handleAddBlock}
                  className="mt-5 inline-flex items-center gap-2 min-h-[46px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>فتح أول بناء</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeProject.blocks.map((block, idx) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    blockIndex={idx}
                    onChange={handleUpdateBlock}
                    onFinishAndAddNew={() => handleFinishAndAddNewBlock(block.id)}
                    onCloseOnly={() => handleCloseBlockOnly(block.id)}
                    onReopen={() => handleReopenBlock(block.id)}
                    onDuplicateBlock={() => handleDuplicateBlock(block)}
                    onRequestDeleteBlock={() => handleRequestDeleteBlock(block)}
                    onDeleteFloorToTrash={(floor) => handleDeleteFloorToTrash(block, floor)}
                    onDeleteSpaceToTrash={(floorId, floorName, space) =>
                      handleDeleteSpaceToTrash(block, floorId, floorName, space)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <BOQSummaryView
            project={activeProject}
            onExportExcel={() => handleExportProjectExcel(activeProject)}
          />
        )}

        {activeTab === 'pricing' && (
          <PricingView
            project={activeProject}
            onUpdateUnitPrice={(key, price) =>
              updateActiveProject((p) => ({
                ...p,
                unitPrices: { ...p.unitPrices, [key]: price },
              }))
            }
            onUpdateCurrency={(currency) =>
              updateActiveProject((p) => ({ ...p, currency }))
            }
            onExportExcel={() => handleExportProjectExcel(activeProject)}
          />
        )}

        {activeTab === 'registry' && (
          <ProjectsRegistryView
            projects={workspace.projects}
            activeProjectId={activeProject.id}
            onOpenProject={handleOpenProjectFromRegistry}
            onExportProjectExcel={handleExportProjectExcel}
            onCloneProject={handleCloneProjectFromRegistry}
            onDeleteProject={handleRequestDeleteProject}
            onOpenResetModal={() => setResetModalOpen(true)}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (5 thumb-zone destinations, compact height) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800/90 bg-[#0b0f19]/95 backdrop-blur-md pb-safe">
        <div className="grid grid-cols-5 h-14 items-center">
          <button
            type="button"
            onClick={() => setActiveTab('survey')}
            className={`flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
              activeTab === 'survey' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <ClipboardList className="h-5 w-5" />
            <span className="text-[10px] font-semibold">المسح</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
              activeTab === 'summary' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <Table2 className="h-5 w-5" />
            <span className="text-[10px] font-semibold">الكميات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
              activeTab === 'pricing' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <Calculator className="h-5 w-5" />
            <span className="text-[10px] font-semibold">الأسعار</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('registry')}
            className={`flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
              activeTab === 'registry' ? 'text-cyan-400' : 'text-slate-400'
            }`}
          >
            <Archive className="h-5 w-5" />
            <span className="text-[10px] font-semibold">
              السجل ({workspace.projects.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTrashOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 h-full text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Trash2 className="h-5 w-5" />
            <span className="text-[10px] font-semibold">
              السلة{workspace.trash.length > 0 ? ` (${workspace.trash.length})` : ''}
            </span>
          </button>
        </div>
      </nav>

      {/* Safe Archive & Reset Modal */}
      <ResetProjectModal
        open={resetModalOpen}
        currentProject={activeProject}
        onClose={() => setResetModalOpen(false)}
        onArchiveAndStartNew={handleArchiveAndStartNew}
        onResetCurrentOnly={handleResetCurrentOnly}
      />

      {/* Trash / Undo Drawer */}
      <TrashDrawer
        open={trashOpen}
        items={workspace.trash}
        onClose={() => setTrashOpen(false)}
        onRestore={handleRestoreTrashItem}
        onPermanentDelete={handlePermanentDeleteTrash}
        onEmptyTrash={handleEmptyTrash}
      />

      {/* Confirm Dialog */}
      <ConfirmModal
        open={!!confirmState?.open}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />

      {/* Action Feedback Toast with Instant Undo */}
      {toast && (
        <div className="fixed bottom-16 md:bottom-5 right-4 left-4 sm:left-auto z-50 flex items-center justify-between gap-3 rounded-xl bg-[#111827] border border-emerald-500/40 px-4 py-3 text-xs font-medium text-slate-100 shadow-2xl">
          <span>{toast.text}</span>
          {toast.undoTrashItem && (
            <button
              type="button"
              onClick={() => handleRestoreTrashItem(toast.undoTrashItem!)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>تراجع</span>
            </button>
          )}
        </div>
      )}

      {/* Non-intrusive Offline Indicator */}
      <OfflineBanner />
    </div>
  );
}
