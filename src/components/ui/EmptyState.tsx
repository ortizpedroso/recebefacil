import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl py-12 px-6 text-center flex flex-col items-center justify-center">
      <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
