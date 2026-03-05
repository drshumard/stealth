import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, Clock, RefreshCw, Zap, FlaskConical,
  Activity, Timer, ChevronDown, ChevronUp, Filter, X,
  Download, ArrowLeft, CalendarDays, RotateCcw, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useTimezone } from '@/components/TimezoneContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// ── date range helpers ────────────────────────────────────────────────────────
const DATE_OPTIONS = [
  { value: 'all',    label: 'All time' },
  { value: 'today',  label: 'Today' },
  { value: '7d',     label: 'Last 7 days' },
  { value: '30d',    label: 'Last 30 days' },
  { value: '90d',    label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range…' },
];

/**
 * Extract YYYY-MM-DD using LOCAL clock — NOT d.toISOString() which is UTC.
 * For UTC+ timezones, toISOString() would give the previous day.
 */
function localDateStr(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateRangeToParams(range, customRange, todayString) {
  if (range === 'all') return {};
  if (range === 'custom' && customRange?.from) {
    return {
      since: localDateStr(customRange.from),
      until: localDateStr(customRange.to || customRange.from),
    };
  }
  const today = todayString();   // YYYY-MM-DD in user's configured timezone
  if (range === 'today') return { since: today, until: today };
  const now  = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const from = new Date(now); from.setDate(from.getDate() - days);
  return { since: localDateStr(from), until: today };
}

function fmtRangeLabel(customRange) {
  if (!customRange?.from) return 'Custom range…';
  // Use the browser's local timezone for display — same as the calendar renders.
  // Using the app's timezone context here would show the wrong day for UTC+ users
  // because the calendar creates Date objects at midnight local browser time.
  const opts  = { month: 'short', day: 'numeric', year: 'numeric' };
  const from  = customRange.from.toLocaleDateString('en-US', opts);
  if (!customRange.to || customRange.from.toDateString() === customRange.to.toDateString())
    return from;
  const to = customRange.to.toLocaleDateString('en-US', opts);
  return `${from} – ${to}`;
}

function timeAgo(ts, formatDateTime) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 5)     return 'just now';
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return formatDateTime(ts);
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCsv(runs, automationName) {
  const headers = [
    'Date', 'Contact Email', 'Contact Name', 'Run Type',
    'HTTP Status', 'Success', 'Duration (ms)', 'Contact ID',
  ];
  const rows = runs.map(r => [
    new Date(r.triggered_at).toISOString(),
    r.contact_email  || '',
    r.contact_name   || '',
    r.run_type,
    r.http_status    ?? '',
    r.success ? 'Yes' : 'No',
    r.duration_ms    ?? '',
    r.contact_id     || '',
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${(automationName || 'automation').replace(/\s+/g, '-').toLowerCase()}-runs-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ success, httpStatus }) {
  if (httpStatus == null) return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
      <Timer size={11} /> No response
    </span>
  );
  const ok = success || (httpStatus >= 200 && httpStatus < 300);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{
        backgroundColor: ok ? '#ecfdf5' : '#fef2f2',
        color:           ok ? '#065f46' : '#991b1b',
        border:          `1px solid ${ok ? '#a7f3d0' : '#fecaca'}`,
      }}>
      {ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      HTTP {httpStatus}
    </span>
  );
}

function RunTypeBadge({ type }) {
  const isTest  = type === 'test';
  const isRetry = type === 'retry';
  const color   = isTest ? '#A31800' : isRetry ? '#d97706' : '#030352';
  const bg      = isTest ? 'rgba(163,24,0,0.08)' : isRetry ? 'rgba(217,119,6,0.08)' : 'rgba(3,3,82,0.08)';
  const border  = isTest ? 'rgba(163,24,0,0.18)' : isRetry ? 'rgba(217,119,6,0.20)' : 'rgba(3,3,82,0.15)';
  const icon    = isTest ? <FlaskConical size={10} /> : isRetry ? <RotateCcw size={10} /> : <Activity size={10} />;
  const label   = isTest ? 'Test' : isRetry ? 'Retry' : 'Live';
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: bg, color, border: `1px solid ${border}` }}>
      {icon}{label}
    </span>
  );
}

function RunCard({ run, automationId, onRetried }) {
  const [open,     setOpen]     = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { formatDateTime, formatTime } = useTimezone();
  const ok = run.success || (run.http_status >= 200 && run.http_status < 300);

  const handleRetry = async (e) => {
    e.stopPropagation();
    setRetrying(true);
    try {
      const res  = await fetch(`${API}/automations/${automationId}/runs/${run.id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Retry succeeded → HTTP ${data.http_status} (${data.duration_ms}ms)`);
      } else {
        toast.error(`Retry failed: ${data.error || `HTTP ${data.http_status}`}`);
      }
      if (onRetried) onRetried();
    } catch (err) {
      toast.error(`Retry error: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };
  let prettyResponse = run.response_body;
  try { if (run.response_body) prettyResponse = JSON.stringify(JSON.parse(run.response_body), null, 2); }
  catch { /* keep */ }

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{
        borderColor:     ok ? (run.run_type === 'test' ? '#fecdc7' : run.run_type === 'retry' ? '#fde68a' : '#c0c9e8') : '#fecaca',
        backgroundColor: ok ? (run.run_type === 'test' ? 'rgba(163,24,0,0.02)' : run.run_type === 'retry' ? 'rgba(217,119,6,0.02)' : 'rgba(3,3,82,0.015)') : '#fff8f8',
      }}>
      {/* Row — div not button so the retry <button> isn't a nested interactive */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
      >
        <div className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: ok ? (run.run_type === 'test' ? '#A31800' : '#030352') : '#ef4444' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--brand-navy)' }}>
              {run.contact_name || run.contact_email || 'Anonymous / Test'}
            </span>
            {run.contact_email && run.contact_name && (
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{run.contact_email}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <RunTypeBadge type={run.run_type} />
            <StatusBadge success={run.success} httpStatus={run.http_status} />
            {run.duration_ms != null && (
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{run.duration_ms}ms</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Retry button — only on failed runs */}
          {!ok && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all duration-150"
              style={{
                backgroundColor: retrying ? '#fff7ed' : '#fff0e6',
                borderColor: '#fed7aa',
                color: retrying ? '#c2410c' : '#ea580c',
                opacity: retrying ? 0.8 : 1,
              }}
              title="Retry this run"
            >
              {retrying
                ? <Loader2 size={11} className="animate-spin" />
                : <RotateCcw size={11} />}
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          )}
          <div className="text-right">
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{timeAgo(run.triggered_at, formatDateTime)}</div>
            <div className="text-xs" style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono, monospace' }}>
              {formatTime(run.triggered_at)}
            </div>
          </div>
          {open
            ? <ChevronUp  size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            : <ChevronDown size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
        </div>
      </div>

      {open && (
        <div className="border-t px-5 pb-5 pt-4 space-y-4" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          {run.error && (
            <div className="rounded-xl p-3" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <p className="text-xs font-bold mb-1" style={{ color: '#991b1b' }}>Error</p>
              <p className="text-xs font-mono" style={{ color: '#991b1b', fontFamily: 'IBM Plex Mono, monospace' }}>{run.error}</p>
            </div>
          )}
          {!run.success && run.response_body && (() => {
            try {
              const p = JSON.parse(run.response_body);
              const hint = p.hint || p.message;
              if (!hint) return null;
              return (
                <div className="rounded-xl p-3 flex items-start gap-2"
                  style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}>
                  <span className="text-xs font-bold shrink-0" style={{ color: '#92400e' }}>Hint:</span>
                  <p className="text-xs" style={{ color: '#78350f' }}>{hint}</p>
                </div>
              );
            } catch { return null; }
          })()}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#030352', opacity: 0.65 }}>Payload Sent</p>
              <pre className="text-xs rounded-xl p-3 overflow-auto max-h-56"
                style={{ backgroundColor: '#f2f3f9', border: '1px solid #d2d8ef', fontFamily: 'IBM Plex Mono, monospace', color: '#030352', lineHeight: 1.6 }}>
                {JSON.stringify(run.payload, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: ok ? '#065f46' : '#991b1b', opacity: 0.75 }}>Response Body</p>
              {prettyResponse ? (
                <pre className="text-xs rounded-xl p-3 overflow-auto max-h-56"
                  style={{ backgroundColor: ok ? '#ecfdf5' : '#fef2f2', border: `1px solid ${ok ? '#a7f3d0' : '#fecaca'}`, fontFamily: 'IBM Plex Mono, monospace', color: ok ? '#065f46' : '#991b1b', lineHeight: 1.6 }}>
                  {prettyResponse}
                </pre>
              ) : ok ? (
                <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46' }}>
                  <p className="font-bold mb-1">Webhook acknowledged ✓</p>
                  <p style={{ opacity: 0.8 }}>No response body — normal for n8n and most webhook services.</p>
                </div>
              ) : (
                <div className="rounded-xl p-3 text-xs font-medium" style={{ backgroundColor: '#f8f7f4', border: '1px solid var(--stroke)', color: 'var(--text-dim)' }}>No response body</div>
              )}
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-4 pt-1">
            <div><span className="text-xs" style={{ color: 'var(--text-dim)' }}>Run ID </span>
              <code className="text-xs font-mono" style={{ color: 'var(--brand-navy)', fontFamily: 'IBM Plex Mono, monospace' }}>{run.id.substring(0, 12)}…</code>
            </div>
            {run.contact_id && (
              <div><span className="text-xs" style={{ color: 'var(--text-dim)' }}>Contact </span>
                <code className="text-xs font-mono" style={{ color: 'var(--brand-navy)', fontFamily: 'IBM Plex Mono, monospace' }}>{run.contact_id.substring(0, 12)}…</code>
              </div>
            )}
            <div><span className="text-xs" style={{ color: 'var(--text-dim)' }}>Duration </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {run.duration_ms != null ? `${run.duration_ms}ms` : '—'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── main export ───────────────────────────────────────────────────────────────
export function AutomationRuns({ open, automation, onClose }) {
  const qc = useQueryClient();
  const { timezone, formatDate, formatDateTime, todayString } = useTimezone();
  const [dateRange,   setDateRange]   = useState('all');
  const [typeFilter,  setTypeFilter]  = useState('all');
  const [customRange, setCustomRange] = useState(null);
  const [calOpen,     setCalOpen]     = useState(false);

  const handleDateRangeChange = (val) => {
    setDateRange(val);
    if (val !== 'custom') setCustomRange(null);
    if (val === 'custom') setCalOpen(true);
  };

  const dateParams  = dateRangeToParams(dateRange, customRange, todayString);
  const queryParams = new URLSearchParams({ limit: '2000' });
  if (dateParams.since) queryParams.set('since', dateParams.since);
  if (dateParams.until) queryParams.set('until', dateParams.until);
  // Always send timezone so the backend converts dates to exact UTC bounds
  if (dateParams.since || dateParams.until) queryParams.set('tz', timezone);
  if (typeFilter !== 'all') queryParams.set('run_type', typeFilter);

  const queryKey = ['automation-runs', automation?.id, dateRange, typeFilter,
                    customRange?.from?.toISOString(), customRange?.to?.toISOString()];

  const { data: runs = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetch(`${API}/automations/${automation.id}/runs?${queryParams}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    enabled: open && !!automation?.id,
    refetchOnMount: true,
  });

  const handleRefresh = () => qc.invalidateQueries({ queryKey });
  const activeFilters = (dateRange !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);


  const successCount = runs.filter(r => r.success).length;
  const failCount    = runs.filter(r => !r.success).length;
  const testCount    = runs.filter(r => r.run_type === 'test').length;
  const liveCount    = runs.filter(r => r.run_type === 'live').length;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />

          {/* Full-page panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-4 z-50 flex flex-col rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#f9f8f5', boxShadow: '0 24px 60px rgba(3,3,82,0.18)', border: '1px solid var(--stroke)' }}
          >
            {/* ── Header ── */}
            <div className="px-8 pt-6 pb-5 border-b shrink-0"
              style={{ background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 60%, #f9f8f5 100%)', borderColor: '#d2d8ef' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button onClick={onClose}
                    className="w-9 h-9 rounded-xl flex items-center justify-center mt-0.5 transition-colors hover:bg-white/40"
                    style={{ color: '#030352' }}>
                    <ArrowLeft size={18} />
                  </button>
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: 'rgba(3,3,82,0.12)' }}>
                    <Activity size={20} style={{ color: '#030352' }} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold"
                      style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>
                      Run History
                    </h2>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--brand-navy)', opacity: 0.55 }}>
                      {automation?.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => exportCsv(runs, automation?.name)}
                    disabled={runs.length === 0}
                    className="gap-2 h-9 px-4 text-sm font-semibold"
                    style={{ borderColor: 'var(--brand-navy)', color: 'var(--brand-navy)', backgroundColor: 'rgba(255,255,255,0.7)' }}
                  >
                    <Download size={14} />
                    Export CSV
                    {runs.length > 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full ml-0.5"
                        style={{ backgroundColor: 'rgba(3,3,82,0.10)', color: '#030352' }}>
                        {runs.length}
                      </span>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRefresh}
                    className="h-9 w-9 p-0 rounded-lg" style={{ color: 'var(--text-dim)' }}>
                    <RefreshCw size={14} />
                  </Button>
                  <button onClick={onClose}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-white/40"
                    style={{ color: 'var(--text-dim)' }}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Summary stats */}
              {!isLoading && runs.length > 0 && (
                <div className="flex items-center gap-3 mt-5 flex-wrap">
                  {[
                    { label: 'Total',   value: runs.length,  color: '#030352', bg: 'rgba(3,3,82,0.08)' },
                    { label: 'Live',    value: liveCount,    color: '#030352', bg: 'rgba(3,3,82,0.06)' },
                    { label: 'Test',    value: testCount,    color: '#A31800', bg: 'rgba(163,24,0,0.06)' },
                    { label: 'Success', value: successCount, color: '#065f46', bg: '#ecfdf5' },
                    { label: 'Failed',  value: failCount,    color: failCount > 0 ? '#991b1b' : 'var(--text-dim)', bg: failCount > 0 ? '#fef2f2' : '#f8f7f4' },
                  ].map(s => (
                    <div key={s.label} className="text-center px-4 py-2 rounded-xl" style={{ backgroundColor: s.bg }}>
                      <div className="text-lg font-bold tabular-nums" style={{ color: s.color, fontFamily: 'Space Grotesk, sans-serif' }}>{s.value}</div>
                      <div className="text-xs font-medium" style={{ color: s.color, opacity: 0.7 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Filter bar ── */}
            <div className="flex items-center gap-3 px-8 py-4 border-b shrink-0 flex-wrap"
              style={{ borderColor: 'var(--stroke)', backgroundColor: '#faf9f6' }}>
              <div className="flex items-center gap-1.5 shrink-0" style={{ color: 'var(--text-dim)' }}>
                <Filter size={13} />
                <span className="text-xs font-semibold">Filter</span>
                {activeFilters > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold rounded-full"
                    style={{ backgroundColor: 'rgba(3,3,82,0.12)', color: '#030352' }}>
                    {activeFilters}
                  </span>
                )}
              </div>

              {/* Date range select */}
              <Select value={dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger className="h-9 text-sm w-44" style={{ borderColor: 'var(--stroke)' }}>
                  <SelectValue>
                    {dateRange === 'custom'
                      ? fmtRangeLabel(customRange)
                      : DATE_OPTIONS.find(o => o.value === dateRange)?.label || 'All time'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DATE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Calendar popover for custom range */}
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="h-9 px-3 text-sm font-medium rounded-lg border flex items-center gap-1.5 transition-colors"
                    style={{ borderColor: dateRange === 'custom' && customRange ? 'var(--brand-navy)' : 'var(--stroke)',
                             color: dateRange === 'custom' && customRange ? 'var(--brand-navy)' : 'var(--text-dim)',
                             backgroundColor: '#ffffff' }}
                    onClick={() => { setDateRange('custom'); setCalOpen(true); }}
                  >
                    <CalendarDays size={14} />
                    {dateRange === 'custom' && customRange
                      ? fmtRangeLabel(customRange)
                      : 'Pick dates'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start"
                  style={{ backgroundColor: '#ffffff', border: '1.5px solid var(--stroke)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
                  <Calendar
                    mode="range"
                    selected={customRange}
                    onSelect={range => {
                      setCustomRange(range);
                      if (range?.from) {
                        setDateRange('custom');
                        if (range.to) setCalOpen(false);
                      }
                    }}
                    numberOfMonths={2}
                    initialFocus
                  />
                  <div className="px-4 pb-3 flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                      {customRange?.from
                        ? `${customRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${customRange.to ? ' → ' + customRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ' → pick end'}`
                        : 'Select start date'}
                    </span>
                    {customRange && (
                      <button className="text-xs font-semibold" style={{ color: 'var(--brand-red)' }}
                        onClick={() => { setCustomRange(null); setDateRange('all'); setCalOpen(false); }}>
                        Clear
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Run type */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 text-sm w-32" style={{ borderColor: 'var(--stroke)' }}>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all"  className="text-sm">All types</SelectItem>
                  <SelectItem value="live" className="text-sm">Live only</SelectItem>
                  <SelectItem value="test" className="text-sm">Test only</SelectItem>
                </SelectContent>
              </Select>

              {activeFilters > 0 && (
                <button
                  onClick={() => { setDateRange('all'); setTypeFilter('all'); setCustomRange(null); }}
                  className="flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-lg border transition-colors"
                  style={{ color: 'var(--text-muted)', borderColor: 'var(--stroke)' }}>
                  <X size={12} /> Clear
                </button>
              )}

              <div className="ml-auto flex items-center gap-3">
                {/* Timezone indicator */}
                <span className="text-xs font-medium hidden sm:flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
                  <Clock size={11} />
                  {timezone.split('/').pop().replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--brand-navy)' }}>
                  {runs.length} run{runs.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* ── Runs list ── */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {isLoading ? (
                <div className="space-y-3 max-w-4xl mx-auto">
                  {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20 rounded-2xl" style={{ backgroundColor: '#f0ede8' }} />)}
                </div>
              ) : runs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #e8ebf5, #f2f3f9)' }}>
                    <Zap size={28} style={{ color: '#030352' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold mb-1"
                      style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif' }}>
                      No runs {activeFilters > 0 ? 'match your filters' : 'yet'}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {activeFilters > 0
                        ? 'Try a wider date range or clear the filters.'
                        : 'Run history will appear here once this automation fires.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-w-4xl mx-auto">
                  {runs.map(run => (
                    <RunCard
                      key={run.id}
                      run={run}
                      automationId={automation?.id}
                      onRetried={handleRefresh}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
