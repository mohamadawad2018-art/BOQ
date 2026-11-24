import React, { useMemo, useState } from 'react';
import {
  Archive,
  Copy,
  Edit3,
  FileSpreadsheet,
  FolderOpen,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { Project } from '../types/boq';
import {
  calculateBlockSummary,
  calculateBOQCost,
  calculateProjectBOQ,
  collectProjectCustomColumns,
  formatNum,
} from '../utils/calculations';

interface ProjectsRegistryViewProps {
  projects: Project[];
  activeProjectId: string;
  onOpenProject: (projectId: string) => void;
  onExportProjectExcel: (project: Project) => void;
  onCloneProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onOpenResetModal: () => void;
}

type StatusFilter = 'all' | 'active' | 'archived';

export const ProjectsRegistryView: React.FC<ProjectsRegistryViewProps> = ({
  projects,
  activeProjectId,
  onOpenProject,
  onExportProjectExcel,
  onCloneProject,
  onDeleteProject,
  onOpenResetModal,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const enriched = useMemo(() => {
    return projects.map((project) => {
      const blockSummaries = project.blocks.map((b) => calculateBlockSummary(b));
      const totalSpaces = blockSummaries.reduce((acc, s) => acc + s.totalSpacesCount, 0);
      const totalRooms = blockSummaries.reduce((acc, s) => acc + s.totalEffectiveRooms, 0);
      const totalArea = blockSummaries.reduce((acc, s) => acc + s.totalFloorArea, 0);
      const customCols = collectProjectCustomColumns(project);
      const boq = calculateProjectBOQ(project);
      const totalCost = calculateBOQCost(boq, project.unitPrices, customCols);
      const isCurrent = project.id === activeProjectId;
      const isArchived = project.status === 'archived' && !isCurrent;

      return {
        project,
        totalBlocks: project.blocks.length,
        totalSpaces,
        totalRooms,
        totalArea,
        totalCost,
        isCurrent,
        isArchived,
      };
    });
  }, [projects, activeProjectId]);

  const filtered = useMemo(() => {
    return enriched.filter((entry) => {
      if (filter === 'active' && entry.isArchived) return false;
      if (filter === 'archived' && !entry.isArchived) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          (entry.project.name || '').toLowerCase().includes(q) ||
          (entry.project.location || '').toLowerCase().includes(q) ||
          (entry.project.date || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [enriched, filter, search]);

  const archivedCount = enriched.filter((e) => e.isArchived).length;

  return (
    <div className="space-y-5">
      {/* Registry Header */}
      <div className="rounded-2xl bg-[#111827] border border-cyan-500/30 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/35 text-cyan-300">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                سجل المشاريع المحفوظة ({projects.length})
              </h2>
              <p className="text-xs text-slate-400">
                كل مشروع تنهيه وتصفّره يُحفظ هنا تلقائياً على جهازك — يمكنك الرجوع إليه وتعديله أو تصديره لـ Excel في أي وقت
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenResetModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm font-bold text-white transition-colors whitespace-nowrap"
          >
            <RotateCcw className="h-4 w-4" />
            <span>حفظ الحالي وتصفير لمشروع جديد</span>
          </button>
        </div>

        {/* Search + Filter Controls */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم المشروع أو الموقع أو التاريخ..."
              className="w-full min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 pr-10 pl-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/70 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0b0f19] border border-slate-800">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              الكل ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('active')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                filter === 'active'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              قيد العمل ({projects.length - archivedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('archived')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                filter === 'archived'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              المحفوظة ({archivedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Projects List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#111827] border border-dashed border-slate-800 py-12 px-6 text-center">
          <FolderOpen className="mx-auto h-9 w-9 text-slate-600" />
          <p className="mt-3 text-sm font-semibold text-slate-300">
            لا توجد مشاريع مطابقة لخيارات البحث الحالية
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(
            ({
              project,
              totalBlocks,
              totalSpaces,
              totalRooms,
              totalArea,
              totalCost,
              isCurrent,
              isArchived,
            }) => {
              const updatedText = new Date(project.updatedAt).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });

              return (
                <article
                  key={project.id}
                  className={`rounded-2xl bg-[#111827] border p-5 flex flex-col justify-between gap-4 transition-colors ${
                    isCurrent
                      ? 'border-emerald-500/50 shadow-[0_0_24px_-12px_rgba(16,185,129,0.45)]'
                      : 'border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-100">
                        {project.name || 'مشروع بدون اسم'}
                      </h3>
                      <span
                        className={`text-xs font-semibold ${
                          isCurrent
                            ? 'text-emerald-400'
                            : isArchived
                            ? 'text-cyan-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {isCurrent
                          ? 'مفتوح حالياً'
                          : isArchived
                          ? 'محفوظ في السجل'
                          : 'مسودة قيد العمل'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
                      <span>{project.location || 'بدون موقع محدد'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-num">{project.date || updatedText}</span>
                      <span aria-hidden="true">·</span>
                      <span>آخر تحديث: {updatedText}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 border-t border-slate-800/70 text-xs text-slate-300">
                      <span>
                        <strong className="font-num text-slate-100">{totalBlocks}</strong> أبنية
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        <strong className="font-num text-slate-100">{totalSpaces}</strong> فراغ (
                        {totalRooms} فعلي)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        المساحة:{' '}
                        <strong className="font-num text-emerald-400">
                          {formatNum(totalArea)}
                        </strong>{' '}
                        م²
                      </span>
                      {totalCost > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            التكلفة:{' '}
                            <strong className="font-num text-cyan-300">
                              {formatNum(totalCost)}
                            </strong>{' '}
                            {project.currency || 'USD'}
                          </span>
                        </>
                      )}
                    </div>

                    {project.generalNotes.trim() && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {project.generalNotes}
                      </p>
                    )}
                  </div>

                  {/* Mobile-Friendly Action Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => onOpenProject(project.id)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                        isCurrent
                          ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>{isCurrent ? 'متابعة التعديل' : 'فتح وتعديل المشروع'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onExportProjectExcel(project)}
                      title="تصدير ملف Excel لهذا المشروع"
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-slate-800 bg-[#0b0f19] text-xs font-semibold text-cyan-300 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-colors whitespace-nowrap"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onCloneProject(project)}
                      title="نسخ كمشروع جديد"
                      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#0b0f19] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
                      aria-label="نسخ كمشروع جديد"
                    >
                      <Copy className="h-4 w-4" />
                    </button>

                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteProject(project)}
                        title="حذف المشروع من السجل"
                        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                        aria-label="حذف المشروع"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </article>
              );
            }
          )}
        </div>
      )}
    </div>
  );
};
