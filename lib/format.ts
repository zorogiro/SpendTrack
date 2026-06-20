const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtTND(n: number): string {
  const [int, dec] = n.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${dec}`;
}

export function formatDateLabel(iso: string): string {
  if (iso === todayISO()) return 'Today';
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]}`;
}
