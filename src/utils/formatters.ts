export const HOJE_DEMO = '2026-11-16';

export function formatBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

export function formatDateBR(isoDate?: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('T')[0].split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateTimeBR(isoDateTime?: string | null): string {
  if (!isoDateTime) return 'Nunca sincronizado';
  try {
    const d = new Date(isoDateTime);
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return isoDateTime;
  }
}

export function diffDaysFromToday(isoDate: string): number {
  const target = new Date(isoDate.split('T')[0] + 'T00:00:00');
  const today = new Date(HOJE_DEMO + 'T00:00:00');
  const diffMs = today.getTime() - target.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function addPeriodToDate(
  startIso: string,
  periodicidade: 'semanal' | 'quinzenal' | 'mensal' | 'trimestral' | 'semestral' | 'anual',
  steps: number
): string {
  const [y, m, d] = startIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  if (periodicidade === 'semanal') {
    date.setDate(date.getDate() + 7 * steps);
  } else if (periodicidade === 'quinzenal') {
    date.setDate(date.getDate() + 15 * steps);
  } else if (periodicidade === 'mensal') {
    date.setMonth(date.getMonth() + 1 * steps);
  } else if (periodicidade === 'trimestral') {
    date.setMonth(date.getMonth() + 3 * steps);
  } else if (periodicidade === 'semestral') {
    date.setMonth(date.getMonth() + 6 * steps);
  } else if (periodicidade === 'anual') {
    date.setFullYear(date.getFullYear() + 1 * steps);
  }

  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildWhatsAppLink(telefone: string, mensagem: string): string {
  const clean = telefone.replace(/\D/g, '');
  const fullNumber = clean.startsWith('55') ? clean : `55${clean}`;
  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(mensagem)}`;
}

export function downloadCsvDemonstrativo(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
