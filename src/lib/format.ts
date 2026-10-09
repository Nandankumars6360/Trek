// Display helpers. Money is integer paise everywhere; times are IST.
const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,798 for whole rupees, ₹1,099.50 when there are paise. */
export function formatINR(paise: number | null | undefined) {
  const p = paise ?? 0;
  return (p % 100 === 0 ? inrWhole : inrPaise).format(p / 100);
}

export function rupeesToPaise(value: string | number) {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[,\s₹]/g, ''));
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

export function paiseToRupees(paise: number | null | undefined) {
  return paise == null ? '' : String(paise / 100);
}

export function formatDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!d) return '—';
  const date = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00+05:30`) : new Date(d);
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata', ...opts });
}

export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export function formatTime(t: string | null | undefined) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

export const difficultyLabel: Record<string, string> = { easy: 'Easy', moderate: 'Moderate', difficult: 'Difficult' };

export function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/** "+91 98765 43210" from "+919876543210" */
export function formatPhone(p: string | null | undefined) {
  if (!p) return '';
  const m = p.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : p;
}
