import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useRecebeFacil } from '../../context/RecebeFacilContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useRecebeFacil();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg bg-white transition-all ${
            toast.type === 'error'
              ? 'border-rose-200 text-rose-900'
              : toast.type === 'info'
              ? 'border-sky-200 text-slate-800'
              : 'border-emerald-200 text-slate-900'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          ) : toast.type === 'info' ? (
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <span className="text-xs font-medium flex-1 leading-relaxed">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
            aria-label="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
