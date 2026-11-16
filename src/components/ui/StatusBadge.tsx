import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  PauseCircle,
  RotateCcw,
  FileEdit,
} from 'lucide-react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
  withIcon?: boolean;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, variant, withIcon = true }) => {
  const Icon =
    variant === 'success'
      ? CheckCircle2
      : variant === 'warning'
      ? Clock
      : variant === 'danger'
      ? AlertCircle
      : variant === 'info'
      ? RotateCcw
      : PauseCircle;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap ${VARIANT_CLASSES[variant]}`}
    >
      {withIcon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{label}</span>
    </span>
  );
};

export function getClienteSituacaoBadge(situacao: 'em_dia' | 'com_pendencias' | 'inadimplente') {
  if (situacao === 'em_dia') return <StatusBadge label="Em dia" variant="success" />;
  if (situacao === 'com_pendencias') return <StatusBadge label="Com pendências" variant="warning" />;
  return <StatusBadge label="Inadimplente" variant="danger" />;
}

export function getVendaSituacaoBadge(
  situacao: 'rascunho' | 'aguardando_pagamento' | 'parcialmente_paga' | 'paga' | 'cancelada'
) {
  switch (situacao) {
    case 'paga':
      return <StatusBadge label="Paga" variant="success" />;
    case 'parcialmente_paga':
      return <StatusBadge label="Parcialmente paga" variant="info" />;
    case 'aguardando_pagamento':
      return <StatusBadge label="Aguardando pagamento" variant="warning" />;
    case 'rascunho':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border bg-slate-100 text-slate-600 border-slate-200 whitespace-nowrap">
          <FileEdit className="w-3 h-3 shrink-0" />
          <span>Rascunho</span>
        </span>
      );
    case 'cancelada':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border bg-slate-100 text-slate-500 border-slate-200 whitespace-nowrap">
          <XCircle className="w-3 h-3 shrink-0" />
          <span>Cancelada</span>
        </span>
      );
  }
}

export function getParcelaStatusBadge(
  status: 'pendente' | 'paga' | 'parcialmente_paga' | 'vencida' | 'cancelada'
) {
  switch (status) {
    case 'paga':
      return <StatusBadge label="Paga" variant="success" />;
    case 'parcialmente_paga':
      return <StatusBadge label="Parcialmente paga" variant="info" />;
    case 'pendente':
      return <StatusBadge label="Pendente" variant="warning" />;
    case 'vencida':
      return <StatusBadge label="Vencida" variant="danger" />;
    case 'cancelada':
      return <StatusBadge label="Cancelada" variant="neutral" />;
  }
}

export function getCobrancaStatusBadge(
  status: 'pendente' | 'paga' | 'vencida' | 'cancelada' | 'estornada'
) {
  switch (status) {
    case 'paga':
      return <StatusBadge label="Paga" variant="success" />;
    case 'pendente':
      return <StatusBadge label="Pendente" variant="warning" />;
    case 'vencida':
      return <StatusBadge label="Vencida" variant="danger" />;
    case 'estornada':
      return <StatusBadge label="Estornada" variant="info" />;
    case 'cancelada':
      return <StatusBadge label="Cancelada" variant="neutral" />;
  }
}

export function getContratoSituacaoBadge(
  situacao: 'ativo' | 'concluido' | 'suspenso' | 'cancelado'
) {
  switch (situacao) {
    case 'ativo':
      return <StatusBadge label="Ativo" variant="success" />;
    case 'concluido':
      return <StatusBadge label="Concluído" variant="info" />;
    case 'suspenso':
      return <StatusBadge label="Suspenso" variant="warning" />;
    case 'cancelado':
      return <StatusBadge label="Cancelado" variant="neutral" />;
  }
}

export function getRecorrenciaStatusBadge(status: 'ativa' | 'suspensa' | 'cancelada') {
  switch (status) {
    case 'ativa':
      return <StatusBadge label="Ativa" variant="success" />;
    case 'suspensa':
      return <StatusBadge label="Suspensa" variant="warning" />;
    case 'cancelada':
      return <StatusBadge label="Cancelada" variant="neutral" />;
  }
}
