import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTimezone } from '@/components/TimezoneContext';

// Analytics state lives in the URL (?tab=&range=&since=&until=&gran=&compare=&source=…), so any view is a link.

export const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api/analytics`;

// Sales arrived in Stealth much later than visits and leads, so sales / revenue figures would skew every comparison.
// Hidden everywhere in Analytics (and on the home Overview) until this is switched back on. The data keeps flowing.
export const SHOW_SALES = false;
export const SALES_KEYS = ['sales', 'revenue', 'buyers', 'purchase_rate', 'revenue_per_contact'];
// Drop sales columns / measures / steps from a list while sales are hidden.
export const withoutSales = (list, key = x => x.key) => (SHOW_SALES ? list : list.filter(x => !SALES_KEYS.includes(key(x))));
export const FIRST_DAY = '2026-02-21';   // first tracked visit

export const FILTER_KEYS = ['source', 'medium', 'campaign', 'content', 'term', 'page', 'host'];
export const FILTER_LABELS = { source: 'Source', medium: 'Medium', campaign: 'Campaign', content: 'Ad', term: 'Ad set', page: 'Page', host: 'Site' };

export const PRESETS = [
  { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' }, { id: '90d', label: 'Last 90 days' }, { id: 'mtd', label: 'This month' },
  { id: 'lastmonth', label: 'Last month' }, { id: 'ytd', label: 'Year to date' }, { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom range' },
];

export const todayIn = tz => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
export function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000) + 1;

export function presetRange(id, today) {
  const [y, m] = today.split('-').map(Number);
  const first = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  switch (id) {
    case 'today': return { since: today, until: today };
    case 'yesterday': return { since: addDays(today, -1), until: addDays(today, -1) };
    case '7d': return { since: addDays(today, -6), until: today };
    case '90d': return { since: addDays(today, -89), until: today };
    case 'mtd': return { since: first(y, m), until: today };
    case 'lastmonth': {
      const start = m === 1 ? first(y - 1, 12) : first(y, m - 1);
      return { since: start, until: addDays(first(y, m), -1) };
    }
    case 'ytd': return { since: `${y}-01-01` < FIRST_DAY ? FIRST_DAY : `${y}-01-01`, until: today };
    case 'all': return { since: FIRST_DAY, until: today };
    default: return { since: addDays(today, -29), until: today };
  }
}

export function useAnalyticsState() {
  const [sp, setSp] = useSearchParams();
  const { timezone } = useTimezone();
  const today = todayIn(timezone);
  const preset = sp.get('range') || '30d';
  const range = preset === 'custom'
    ? { since: sp.get('since') || addDays(today, -29), until: sp.get('until') || today }
    : presetRange(preset, today);
  const filters = Object.fromEntries(FILTER_KEYS.map(k => [k, sp.get(k) || '']).filter(([, v]) => v));
  const days = daysBetween(range.since, range.until);
  const prev = { until: addDays(range.since, -1), since: addDays(range.since, -days) };
  const state = {
    tab: sp.get('tab') || 'overview', preset, ...range, days, prev, tz: timezone, today,
    gran: sp.get('gran') || '', compare: sp.get('compare') === '1', filters, params: sp,   // compare is off unless turned on
  };
  const update = patch => setSp(current => {
    const next = new URLSearchParams(current);
    Object.entries(patch).forEach(([k, v]) => (v == null || v === '' ? next.delete(k) : next.set(k, v)));
    return next;
  }, { replace: true });
  return [state, update];
}

export function qs(state, extra = {}, range = state) {
  const q = new URLSearchParams({ since: range.since, until: range.until, tz: state.tz });
  Object.entries({ ...state.filters, ...extra }).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, v); });
  return q.toString();
}

export const getJson = url => fetch(url).then(async r => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `Request failed (${r.status})`);
  return r.json();
});

// Heavy views answer 202 {pending: true} while the server finishes them (requests are cut at 60s): keep asking.
export async function getAnalytics(url, signal) {
  for (let i = 0; i < 80; i += 1) {
    const data = await getJson(url);
    if (!data?.pending) return data;
    await new Promise((res, rej) => {
      const t = setTimeout(res, 3000);
      signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')); });
    });
  }
  throw new Error('This view is taking too long — try a shorter period.');
}

// One analytics endpoint for the current state. `range` swaps in another period (the comparison).
export function useA(path, state, extra = {}, { range, ...opts } = {}) {
  const q = qs(state, extra, range || state);
  return useQuery({
    queryKey: ['analytics', path, q], queryFn: ({ signal }) => getAnalytics(`${API}${path}?${q}`, signal),
    // The server answers from its cache at once (and refreshes in the background), so re-ask every 2 minutes to pick
    // up refreshed numbers; keep results for 30 minutes so switching tabs is instant.
    placeholderData: keepPreviousData, staleTime: 60_000, gcTime: 30 * 60_000, refetchInterval: 120_000,
    refetchOnWindowFocus: false, ...opts,
  });
}

// ── formatting ──
export const fmtNum = n => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));
export const fmtCompact = n => (n == null ? '—' : Math.abs(n) >= 10000
  ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : fmtNum(n));
export const fmtPct = (r, d = 1) => (r == null ? '—' : `${(r * 100).toFixed(r !== 0 && Math.abs(r) < 0.01 ? 2 : d)}%`);
export const fmtMoney = n => (n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n));
export function fmtDuration(s) {
  if (s == null) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
}
export function fmtHours(h) {
  if (h == null) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} h`;
  return `${(h / 24).toFixed(1)} days`;
}
export const FORMAT = { num: fmtNum, compact: fmtCompact, pct: fmtPct, money: fmtMoney, dur: fmtDuration };

// Every KPI the dashboard knows. good: which direction is an improvement.
export const METRICS = {
  visits: { label: 'Page views', fmt: 'num', good: 'up' },
  visitors: { label: 'Visitors', fmt: 'num', good: 'up' },
  sessions: { label: 'Sessions', fmt: 'num', good: 'up' },
  new_visitors: { label: 'New visitors', fmt: 'num', good: 'up' },
  returning_visitors: { label: 'Returning visitors', fmt: 'num', good: 'up' },
  new_contacts: { label: 'New contacts', fmt: 'num', good: 'up' },
  identified: { label: 'Identified leads', fmt: 'num', good: 'up' },
  abandoned: { label: 'Abandoned leads', fmt: 'num', good: 'down' },
  registrations: { label: 'Registrations', fmt: 'num', good: 'up' },
  sales: { label: 'Sales', fmt: 'num', good: 'up' },
  revenue: { label: 'Revenue', fmt: 'money', good: 'up' },
  buyers: { label: 'Buyers', fmt: 'num', good: 'up' },
  bounce_rate: { label: 'Bounce rate', fmt: 'pct', good: 'down' },
  pages_per_session: { label: 'Pages / session', fmt: 'num', good: 'up' },
  avg_session_seconds: { label: 'Median session', fmt: 'dur', good: 'up' },
  identification_rate: { label: 'Identification rate', fmt: 'pct', good: 'up' },
  registration_rate: { label: 'Registration rate', fmt: 'pct', good: 'up' },
  purchase_rate: { label: 'Purchase rate', fmt: 'pct', good: 'up' },
};
export const fmtMetric = (key, v) => (FORMAT[METRICS[key]?.fmt] || fmtNum)(v);

export function delta(cur, prev) {
  if (cur == null || prev == null) return null;
  if (prev === 0) return cur === 0 ? 0 : null;
  return (cur - prev) / Math.abs(prev);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function bucketLabel(key, gran, long = false) {
  if (!key) return '';
  const [d, t] = key.split('T');
  const [y, m, day] = d.split('-').map(Number);
  if (gran === 'hour') return long ? `${MONTHS[m - 1]} ${day}, ${t}` : t;
  if (gran === 'month') return `${MONTHS[m - 1]} ${y}`;
  if (gran === 'week') return `${long ? 'Week of ' : ''}${MONTHS[m - 1]} ${day}`;
  return long ? `${MONTHS[m - 1]} ${day}, ${y}` : `${MONTHS[m - 1]} ${day}`;
}

export const PALETTE = ['#315fd1', '#1f9e89', '#e2a33a', '#7c5cd6', '#d4566a', '#4fa3e0', '#8a98aa', '#b7791f', '#2f855a', '#c05621'];

export function downloadCsv(filename, columns, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [columns.map(c => esc(c.label)).join(','), ...rows.map(r => columns.map(c => esc(c.csv ? c.csv(r) : r[c.key])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
