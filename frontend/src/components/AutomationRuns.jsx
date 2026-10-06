import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, XCircle, Clock, RefreshCw, Zap, FlaskConical,
  Activity, Timer, ChevronDown, ChevronUp, X,
  Download, CalendarDays, RotateCcw, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer } from '@/workspace/ui';
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
    'Date', 'Action Name', 'Webhook URL',
    'Contact Email', 'Contact Name', 'Contact Phone', 'Run Type',
    'HTTP Status', 'Success', 'Duration (ms)', 'Contact ID', 'Payload',
  ];
  const rows = runs.map(r => [
    new Date(r.triggered_at).toISOString(),
    r.action_name    || '',
    r.webhook_url    || '',
    r.contact_email  || '',
    r.contact_name   || '',
    r.payload?.phone || '',
    r.run_type,
    r.http_status    ?? '',
    r.success ? 'Yes' : 'No',
    r.duration_ms    ?? '',
    r.contact_id     || '',
    r.payload ? JSON.stringify(r.payload) : '',
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
  if (httpStatus == null) return <span className="sp-status" data-tone="quiet"><Timer size={11} /> No response</span>;
  const ok = success || (httpStatus >= 200 && httpStatus < 300);
  return <span className="sp-status" data-tone={ok ? 'green' : 'red'}>{ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />} HTTP {httpStatus}</span>;
}

function RunTypeBadge({ type }) {
  const isTest  = type === 'test';
  const isRetry = type === 'retry';
  const icon    = isTest ? <FlaskConical size={10} /> : isRetry ? <RotateCcw size={10} /> : <Activity size={10} />;
  const label   = isTest ? 'Test' : isRetry ? 'Retry' : 'Live';
  return <span className="sp-status" data-tone={isTest ? 'red' : isRetry ? 'amber' : 'blue'}>{icon}{label}</span>;
}

function RunCard({ run, automationId, onRetried }) {
  const [open,     setOpen]     = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { formatDateTime, formatTime } = useTimezone();
  const ok = run.success || (run.http_status >= 200 && run.http_status < 300);

  // Derive a short, readable destination label for the collapsed row.
  // Priority: explicit action name → webhook URL hostname → nothing.
  const webhookLabel = (() => {
    if (run.action_name) return run.action_name;
    if (run.webhook_url) {
      try {
        const host = new URL(run.webhook_url).hostname.replace(/^www\./, '');
        // Keep just the first meaningful segment, e.g. "hooks.zapier.com" → "zapier.com"
        const parts = host.split('.');
        return parts.length > 2 ? parts.slice(-2).join('.') : host;
      } catch { return null; }
    }
    return null;
  })();

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
    <div className="sp-run" data-failed={!ok || undefined}>
      {/* Row — div not button so the retry <button> isn't a nested interactive */}
      <div className="sp-run-row" role="button" tabIndex={0} aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}>
        <span className="sp-timeline-dot" data-tone={ok ? 'sale' : 'error'} />
        <div className="sp-run-main">
          <div className="sp-run-who"><strong>{run.contact_name || run.contact_email || 'Anonymous / Test'}</strong>
            {run.contact_email && run.contact_name && <small>{run.contact_email}</small>}</div>
          <div className="sp-run-tags">
            <RunTypeBadge type={run.run_type} />
            <StatusBadge success={run.success} httpStatus={run.http_status} />
            {/* Webhook destination — always shown so multi-step runs are never ambiguous */}
            {webhookLabel && <span className="sp-run-dest" title={run.webhook_url}>→ {webhookLabel}</span>}
            {run.duration_ms != null && <span className="sp-run-ms">{run.duration_ms}ms</span>}
          </div>
        </div>
        <div className="sp-run-end">
          {/* Retry button — only on failed runs */}
          {!ok && (
            <button type="button" className="sp-secondary-button sp-retry" onClick={handleRetry} disabled={retrying} title="Retry this run">
              {retrying ? <Loader2 size={13} className="sp-spin" /> : <RotateCcw size={13} />}{retrying ? 'Retrying…' : 'Retry'}
            </button>
          )}
          <span className="sp-run-when"><strong>{timeAgo(run.triggered_at, formatDateTime)}</strong><small>{formatTime(run.triggered_at)}</small></span>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {open && (
        <div className="sp-run-detail">
          {run.error && <div className="sp-run-error"><span className="sp-eyebrow">Error</span><p>{run.error}</p></div>}
          {!run.success && run.response_body && (() => {
            try {
              const p = JSON.parse(run.response_body);
              const hint = p.hint || p.message;
              if (!hint) return null;
              return <div className="sp-drawer-note"><span><strong>Hint:</strong> {hint}</span></div>;
            } catch { return null; }
          })()}
          <div className="sp-run-columns">
            <div>
              <span className="sp-eyebrow">Payload Sent</span>
              <pre className="sp-raw">{JSON.stringify(run.payload, null, 2)}</pre>
            </div>
            <div>
              <span className="sp-eyebrow">Response Body</span>
              {prettyResponse ? (
                <pre className="sp-raw" data-tone={ok ? 'green' : 'red'}>{prettyResponse}</pre>
              ) : ok ? (
                <div className="sp-raw sp-raw-note" data-tone="green"><strong>Webhook acknowledged ✓</strong><small>No response body — normal for n8n and most webhook services.</small></div>
              ) : (
                <div className="sp-raw sp-raw-note">No response body</div>
              )}
            </div>
          </div>
          <div className="sp-run-ids">
            <span>Run ID <code>{run.id.substring(0, 12)}…</code></span>
            {run.contact_id && <span>Contact <code>{run.contact_id.substring(0, 12)}…</code></span>}
            <span>Duration <strong>{run.duration_ms != null ? `${run.duration_ms}ms` : '—'}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── main export ───────────────────────────────────────────────────────────────
// Run history — the prototype's drawer, widened for payloads.
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

  const summary = [
    { label: 'Total',   value: runs.length },
    { label: 'Live',    value: liveCount },
    { label: 'Test',    value: testCount },
    { label: 'Success', value: successCount, tone: 'green' },
    { label: 'Failed',  value: failCount, tone: failCount > 0 ? 'red' : undefined },
  ];

  return (
    <Drawer open={open} onClose={onClose} wide eyebrow="Workflow / run history" label="Run history"
      actions={<>
        <button type="button" className="sp-secondary-button" onClick={() => exportCsv(runs, automation?.name)} disabled={runs.length === 0}>
          <Download size={14} /> Export CSV{runs.length > 0 && <span className="sp-button-count">{runs.length}</span>}
        </button>
        <button type="button" className="sp-icon-button" onClick={handleRefresh} aria-label="Refresh runs"><RefreshCw size={15} /></button>
      </>}>
      <div className="sp-drawer-body">
        <span className="sp-drawer-avatar"><Activity size={22} /></span>
        <h2>Run History</h2>
        <p>{automation?.name}</p>

        {/* Summary stats */}
        {!isLoading && runs.length > 0 && (
          <div className="sp-run-summary">
            {summary.map(s => <div key={s.label} data-tone={s.tone}><strong>{s.value}</strong><span>{s.label}</span></div>)}
          </div>
        )}

        {/* Filter bar */}
        <div className="sp-run-filters">
          <label className="sp-select-wrap"><span className="sr-only">Date range</span>
            <select value={dateRange} onChange={e => handleDateRangeChange(e.target.value)}>
              {DATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value === 'custom' && dateRange === 'custom' ? fmtRangeLabel(customRange) : o.label}</option>)}
            </select><ChevronDown size={15} aria-hidden="true" /></label>
          {/* Calendar popover for custom range */}
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="sp-secondary-button" data-active={(dateRange === 'custom' && !!customRange) || undefined}
                onClick={() => { setDateRange('custom'); setCalOpen(true); }}>
                <CalendarDays size={15} /> {dateRange === 'custom' && customRange ? fmtRangeLabel(customRange) : 'Pick dates'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="sp-popover w-auto p-0" align="start">
              <Calendar mode="range" selected={customRange} numberOfMonths={2} initialFocus
                onSelect={range => {
                  setCustomRange(range);
                  if (range?.from) {
                    setDateRange('custom');
                    if (range.to) setCalOpen(false);
                  }
                }} />
              <div className="sp-popover-foot">
                <span>{customRange?.from
                  ? `${customRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${customRange.to ? ' → ' + customRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}`
                  : 'Select start date'}</span>
                {customRange && <button type="button" className="sp-clear" onClick={() => { setCustomRange(null); setDateRange('all'); setCalOpen(false); }}>Clear</button>}
              </div>
            </PopoverContent>
          </Popover>
          <label className="sp-select-wrap"><span className="sr-only">Run type</span>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All types</option><option value="live">Live only</option><option value="test">Test only</option>
            </select><ChevronDown size={15} aria-hidden="true" /></label>
          {activeFilters > 0 && (
            <button type="button" className="sp-clear" onClick={() => { setDateRange('all'); setTypeFilter('all'); setCustomRange(null); }}>
              <X size={13} /> Clear
            </button>
          )}
          <span className="sp-toolbar-end">
            <span className="sp-run-tz"><Clock size={12} /> {timezone.split('/').pop().replace(/_/g, ' ')}</span>
            <span className="sp-count">{runs.length} run{runs.length !== 1 ? 's' : ''}</span>
          </span>
        </div>

        {/* Runs list */}
        {isLoading ? (
          <div className="sp-drawer-loading">{[1, 2, 3, 4, 5, 6].map(i => <span key={i} className="sp-skeleton" />)}</div>
        ) : runs.length === 0 ? (
          <div className="sp-drawer-empty"><Zap size={28} />
            <p>No runs {activeFilters > 0 ? 'match your filters' : 'yet'}</p>
            <small>{activeFilters > 0 ? 'Try a wider date range or clear the filters.' : 'Run history will appear here once this automation fires.'}</small>
          </div>
        ) : (
          <div className="sp-runs">
            {runs.map(run => <RunCard key={run.id} run={run} automationId={automation?.id} onRetried={handleRefresh} />)}
          </div>
        )}
      </div>
    </Drawer>
  );
}
