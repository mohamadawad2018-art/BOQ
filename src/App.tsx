import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Calculator,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FolderPlus,
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
import { OfflineBanner, PWAInstallButton } from './components/PWAInstallButton';
import { TrashDrawer } from './components/TrashDrawer';
import { exportProjectToExcel } from './services/excelExportService';
import { createBlankProject, createNewBlock, storageService } from './services/storageService';
import { AppWorkspaceState, Block, Floor, Project, Space, TrashItem } from './types/boq';
import { createId } from './utils/calculations';

type ActiveTab = 'survey' | 'summary' | 'pricing';

interface ToastMessage {
  id: string;
  text: string;
  undoTrashItem?: TrashItem;
}

export default function App() {
  const [workspace, setWorkspace] = useState<AppWorkspaceState>(() => storageService.load());
  const [activeTab, setActiveTab] = useState<ActiveTab>('survey');
  const [trashOpen, setTrashOpen] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(true);
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

  // Create a fresh project
  const handleCreateProject = () => {
    const newProj = createBlankProject(`مشروع جديد ${workspace.projects.length + 1}`);
    setWorkspace((prev) => ({
      ...prev,
      projects: [newProj, ...prev.projects],
      activeProjectId: newProj.id,
    }));
    setActiveTab('survey');
    showToast('تم إنشاء مشروع جديد بنجاح');
  };

  const handleRequestDeleteProject = () => {
    if (workspace.projects.length <= 1) return;
    setConfirmState({
      open: true,
      title: `حذف المشروع "${activeProject.name}"؟`,
      message:
        'سيتم حذف هذا المشروع نهائياً من الجهاز. يُنصح بتحميل نسخة احتياطية JSON قبل الحذف إذا كنت ستحتاجه لاحقاً.',
      confirmLabel: 'حذف المشروع',
      onConfirm: () => {
        setWorkspace((prev) => {
          const remaining = prev.projects.filter((p) => p.id !== activeProject.id);
          return {
            ...prev,
            projects: remaining,
            activeProjectId: remaining[0].id,
          };
        });
        setConfirmState(null);
        showToast('تم حذف المشروع');
      },
    });
  };

  // Block operations
  const handleUpdateBlock = (updatedBlock: Block) => {
    updateActiveProject((proj) => ({
      ...proj,
      blocks: proj.blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)),
    }));
  };

  const handleAddBlock = () => {
    const nextNum = activeProject.blocks.length + 1;
    const fresh = createNewBlock(`الكتلة / البناء ${nextNum}`);
    updateActiveProject((proj) => ({
      ...proj,
      blocks: [...proj.blocks, fresh],
    }));
    showToast(`تم فتح ${fresh.name}`);
  };

  // Finish & Switch workflow: closes current block and opens a fresh new block immediately
  const handleFinishAndAddNewBlock = (blockId: string) => {
    const nextNum = activeProject.blocks.length + 1;
    const fresh = createNewBlock(`الكتلة / البناء ${nextNum}`);
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

  // Restore from Trash (handles both blocks and spaces cleanly even if parent was closed/deleted)
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

        // Restoring a Space
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

  // JSON Backup Export & Import
  const handleExportJSON = () => {
    storageService.exportJSONBackup(workspace);
    showToast('تم تحميل النسخة الاحتياطية (JSON)');
  };

  const handleImportJSONFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = storageService.parseJSONBackup(String(reader.result || ''));
        setWorkspace(imported);
        showToast('تم استيراد النسخة الاحتياطية بنجاح');
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'تعذر قراءة ملف النسخة الاحتياطية'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportExcel = () => {
    exportProjectToExcel(activeProject);
    showToast('تم تصدير ملف Excel RTL بمعادلات SUM بنجاح');
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

          {/* Zone 2: Clean single-line navigation links */}
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
              onClick={() => setTrashOpen(true)}
              className="py-1 text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 border-b-2 border-transparent"
            >
              سلة المحذوفات{workspace.trash.length > 0 ? ` (${workspace.trash.length})` : ''}
            </button>
          </nav>

          {/* Zone 3: Single primary action CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-[0_0_20px_-6px_rgba(16,185,129,0.7)] transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>تصدير ملف Excel</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-5 space-y-6">
        {/* Workspace Utility Toolbar (Projects, JSON Backup/Import, PWA Install) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeProject.id}
              onChange={(e) =>
                setWorkspace((prev) => ({ ...prev, activeProjectId: e.target.value }))
              }
              aria-label="اختيار المشروع"
              className="min-h-[40px] max-w-[240px] sm:max-w-xs truncate rounded-xl bg-[#111827] border border-slate-800 px-3 text-xs font-semibold text-slate-100 focus:border-emerald-400/70 outline-none"
            >
              {workspace.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || 'مشروع بدون اسم'}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCreateProject}
              className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-[#111827] border border-slate-800 px-3 text-xs font-semibold text-slate-200 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors whitespace-nowrap"
            >
              <FolderPlus className="h-4 w-4 text-emerald-400" />
              <span>مشروع جديد</span>
            </button>

            {workspace.projects.length > 1 && (
              <button
                type="button"
                onClick={handleRequestDeleteProject}
                title="حذف المشروع الحالي"
                className="flex h-[40px] w-[40px] items-center justify-center rounded-xl bg-[#111827] border border-slate-800 text-slate-400 hover:border-rose-500/40 hover:text-rose-400 transition-colors"
                aria-label="حذف المشروع الحالي"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PWAInstallButton />

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

        {/* Project / Site Level Info & Site-Wide Notes */}
        <section className="rounded-2xl bg-[#111827] border border-slate-800/90 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">اسم المشروع</label>
              <input
                type="text"
                value={activeProject.name}
                onChange={(e) =>
                  updateActiveProject((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="مثال: تأهيل مباني المجمع الهندسي"
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
                ملاحظات عامة للموقع ككل
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

        {/* Active View */}
        {activeTab === 'survey' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-slate-100">
                  الكتل والأبنية ({activeProject.blocks.length})
                </h1>
                <p className="text-xs text-slate-400">
                  يُحفظ كل تعديل تلقائياً على جهازك للعمل الميداني دون الحاجة للإنترنت
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddBlock}
                className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
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
          <BOQSummaryView project={activeProject} onExportExcel={handleExportExcel} />
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
            onExportExcel={handleExportExcel}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Compact thumb-zone navigation) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800/90 bg-[#0b0f19]/95 backdrop-blur-md pb-safe">
        <div className="grid grid-cols-4 h-14 items-center">
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
            onClick={() => setTrashOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 h-full text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Trash2 className="h-5 w-5" />
            <span className="text-[10px] font-semibold">
              المحذوفات{workspace.trash.length > 0 ? ` (${workspace.trash.length})` : ''}
            </span>
          </button>
        </div>
      </nav>

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
        <div className="fixed bottom-18 md:bottom-5 right-4 z-50 flex items-center gap-3 rounded-xl bg-[#111827] border border-emerald-500/40 px-4 py-3 text-xs font-medium text-slate-100 shadow-2xl">
          <span>{toast.text}</span>
          {toast.undoTrashItem && (
            <button
              type="button"
              onClick={() => handleRestoreTrashItem(toast.undoTrashItem!)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition-colors whitespace-nowrap"
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
