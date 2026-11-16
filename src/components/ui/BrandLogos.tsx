import React from 'react';

export const RecebeFacilLogo: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="#0F766E" />
        <path
          d="M9 17.5L13.5 22L23 11.5"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 11.5H16"
          stroke="#99F6E4"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <div className="text-base font-bold tracking-tight text-slate-900 font-display whitespace-nowrap">
            RecebeFácil
          </div>
          <div className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
            Venda. Receba. Acompanhe.
          </div>
        </div>
      )}
    </div>
  );
};

export const AsaasLogo: React.FC<{ className?: string }> = ({ className = 'h-7' }) => {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="28" height="28" rx="7" fill="#0030B9" />
        <path
          d="M14 6.5L20.5 20.5H17.3L15.9 17.2H12.1L10.7 20.5H7.5L14 6.5ZM14 11.4L12.9 14.4H15.1L14 11.4Z"
          fill="#FFFFFF"
        />
      </svg>
      <span className="text-base font-bold tracking-tight text-slate-900 font-display">Asaas</span>
    </div>
  );
};
