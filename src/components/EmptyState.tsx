import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="bg-white dark:bg-slate-900 workspace-card dark:border dark:border-slate-800 rounded-xl p-10 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-xl bg-[#f2f3ff] dark:bg-slate-800 text-[#630ed4] dark:text-violet-400 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-display text-base font-semibold text-[#131b2e] dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-[#4a4455] dark:text-slate-400 max-w-md leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
