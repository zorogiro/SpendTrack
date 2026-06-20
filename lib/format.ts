import i18next from 'i18next';

// NOTE: Intl month-name data can be incomplete on some Android (Hermes/ICU)
// builds — test date rendering on a real Android device, not just iOS sim.

const INTL_LOCALE: Record<string, string> = {
  en: 'en-GB',         // day-first: "12 Jun" — matches FR/AR ordering
  fr: 'fr-FR',         // "12 juin"
  ar: 'ar-u-nu-latn',  // Arabic grouping rules, Latin digits (standard in Tunisia)
};

function intlLocale(): string {
  return INTL_LOCALE[i18next.language] ?? 'en-GB';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  // pad() used for both components so the result is YYYY-MM-DD, matching todayISO()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtTND(n: number): string {
  return new Intl.NumberFormat(intlLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDateLabel(iso: string): string {
  if (iso === todayISO())     return i18next.t('common.today');
  if (iso === yesterdayISO()) return i18next.t('common.yesterday');
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d),  // local midnight — avoids UTC-shift off-by-one
  );
}
