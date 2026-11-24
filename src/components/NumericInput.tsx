import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface NumericInputProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  unit?: string;
  placeholder?: string;
  min?: number;
  step?: string;
  className?: string;
  accent?: 'emerald' | 'cyan';
  disabled?: boolean;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  label,
  value,
  onChange,
  unit,
  placeholder = '0',
  min = 0,
  className = '',
  accent = 'emerald',
  disabled = false,
}) => {
  const [text, setText] = useState<string>(value === 0 ? '' : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(value === 0 ? '' : String(value));
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/،/g, '.').replace(/,/g, '.');
    // Allow Arabic-Indic digits conversion
    const normalized = raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    if (normalized === '' || /^\d*\.?\d*$/.test(normalized)) {
      setText(normalized);
      const parsed = parseFloat(normalized);
      if (normalized === '' || isNaN(parsed)) {
        onChange(0);
      } else {
        onChange(Math.max(min, parsed));
      }
    }
  };

  const focusRing =
    accent === 'cyan'
      ? 'focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/20'
      : 'focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20';

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-slate-400 select-none truncate">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onFocus={(e) => {
            setFocused(true);
            e.target.select();
          }}
          onBlur={() => {
            setFocused(false);
            setText(value === 0 ? '' : String(value));
          }}
          onChange={handleChange}
          className={`font-num w-full min-h-[44px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3 ${
            unit ? 'pl-11' : 'pl-3'
          } text-base font-medium text-slate-100 placeholder:text-slate-600 transition-all outline-none disabled:opacity-50 ${focusRing}`}
        />
        {unit && (
          <span className="pointer-events-none absolute left-3 text-xs font-medium text-slate-400 select-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'تأكيد الحذف',
  cancelLabel = 'إلغاء',
  danger = true,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-[#111827] border border-slate-700/80 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                danger ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-300">{message}</p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-700 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold text-white transition-colors whitespace-nowrap ${
              danger
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
