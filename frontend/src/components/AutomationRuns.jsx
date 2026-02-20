import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown, ChevronRight, Zap, FlaskConical, Activity, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 5)    return 'just now';
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ success, httpStatus }) {
  if (httpStatus === null || httpStatus === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
        style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
        <Timer size={11} /> No response
      </span>
    );
  }
  const ok = success || (httpStatus >= 200 && httpStatus < 300);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full`}
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
  const isTest = type === 'test';
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: isTest ? 'rgba(163,24,0,0.08)' : 'rgba(3,3,82,0.08)',
        color:           isTest ? '#A31800' : '#030352',
        border:          `1px solid ${isTest ? 'rgba(163,24,0,0.18)' : 'rgba(3,3,82,0.15)'}`,
      }}>
      {isTest ? <FlaskConical size={10} /> : <Activity size={10} />}
      {isTest ? 'Test' : 'Live'}
    </span>
  );
}

function RunCard({ run }) {
  const [open, setOpen] = useState(false);
  const ok = run.success || (run.http_status >= 200 && run.http_status < 300);

  // Try to pretty-print response body as JSON
  let prettyResponse = run.response_body;
  try {
    if (run.response_body) {
      prettyResponse = JSON.stringify(JSON.parse(run.response_body), null, 2);
    }
  } catch { /* keep as-is */ }

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all duration-150"
      style={{
        borderColor:     ok ? (run.run_type === 'test' ? '#fecdc7' : '#c0c9e8') : '#fecaca',
        backgroundColor: ok ? (run.run_type === 'test' ? 'rgba(163,24,0,0.02)' : 'rgba(3,3,82,0.015)') : '#fff8f8',
      }}
    >
      {/* Row header — always visible */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
        onClick={() => setOpen(v => !v)}
      >
        {/* Left accent dot */}
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: ok ? (run.run_type === 'test' ? '#A31800' : '#030352') : '#ef4444' }}
        />

        {/* Contact */}
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
            {run.duration_ms !== null && (
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {run.duration_ms}ms
              </span>
            )}
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-right shrink-0">
          <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {timeAgo(run.triggered_at)}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono, monospace' }}>
            {new Date(run.triggered_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>

        <ChevronDown size={14} style={{ color: 'var(--text-dim)', transform: open ? 'rotate(180deg)' : '', transition: 'transform 200ms', flexShrink: 0 }} />
      </button>

      {/* Expanded detail */}
      {open && (
        <div
          className="border-t px-5 pb-5 pt-4 space-y-4"
          style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
          {/* Error message */}
          {run.error && (
            <div className="rounded-xl p-3" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <p className="text-xs font-bold mb-1" style={{ color: '#991b1b' }}>Error</p>
              <p className="text-xs font-mono" style={{ color: '#991b1b', fontFamily: 'IBM Plex Mono, monospace' }}>{run.error}</p>
            </div>
          )}

          {/* Extracted hint from structured error responses (n8n, etc.) */}
          {!run.success && run.response_body && (() => {
            try {
              const parsed = JSON.parse(run.response_body);
              const hint = parsed.hint || parsed.message;
              if (!hint) return null;
              return (
                <div className="rounded-xl p-3 flex items-start gap-2" style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}>
                  <span className="text-xs font-bold shrink-0" style={{ color: '#92400e' }}>Hint:</span>
                  <p className="text-xs" style={{ color: '#78350f' }}>{hint}</p>
                </div>
              );
            } catch { return null; }
          })()}

          {/* Two-column: payload + response */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Payload sent */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#030352', opacity: 0.65 }}>
                Payload Sent
              </p>
              <pre
                className="text-xs rounded-xl p-3 overflow-auto max-h-56"
                style={{
                  backgroundColor: '#f2f3f9',
                  border: '1px solid #d2d8ef',
                  fontFamily: 'IBM Plex Mono, monospace',
                  color: '#030352',
                  lineHeight: 1.6,
                }}
              >
                {JSON.stringify(run.payload, null, 2)}
              </pre>
            </div>

            {/* Response body */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: ok ? '#065f46' : '#991b1b', opacity: 0.75 }}>
                Response Body
              </p>
              {prettyResponse ? (
                <pre
                  className="text-xs rounded-xl p-3 overflow-auto max-h-56"
                  style={{
                    backgroundColor: ok ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${ok ? '#a7f3d0' : '#fecaca'}`,
                    fontFamily: 'IBM Plex Mono, monospace',
                    color: ok ? '#065f46' : '#991b1b',
                    lineHeight: 1.6,
                  }}
                >
                  {prettyResponse}
                </pre>
              ) : ok ? (
                <div
                  className="rounded-xl p-3 text-xs"
                  style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46' }}
                >
                  <p className="font-bold mb-1">Webhook acknowledged \u2714</p>
                  <p style={{ opacity: 0.8 }}>No response body returned. This is normal -- n8n and many webhook services return empty bodies on success. The request was received.</p>
                </div>
              ) : (
                <div
                  className="rounded-xl p-3 text-xs font-medium"
                  style={{ backgroundColor: '#f8f7f4', border: '1px solid var(--stroke)', color: 'var(--text-dim)' }}
                >
                  No response body
                </div>
              )}
            </div>
          </div>

          {/* Run metadata */}
          <div className="flex items-center flex-wrap gap-4 pt-1">
            <div>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Run ID </span>
              <code className="text-xs font-mono" style={{ color: 'var(--brand-navy)', fontFamily: 'IBM Plex Mono, monospace' }}>
                {run.id.substring(0, 12)}…
              </code>
            </div>
            {run.contact_id && (
              <div>
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Contact </span>
                <code className="text-xs font-mono" style={{ color: 'var(--brand-navy)', fontFamily: 'IBM Plex Mono, monospace' }}>
                  {run.contact_id.substring(0, 12)}…
                </code>
              </div>
            )}
            <div>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Duration </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {run.duration_ms !== null ? `${run.duration_ms}ms` : '—'}
              </span>
            </div>
            <div>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Endpoint </span>
              <span className="text-xs font-mono truncate max-w-[200px] inline-block" style={{ color: 'var(--brand-navy)', fontFamily: 'IBM Plex Mono, monospace' }} title={run.webhook_url}>
                {run.webhook_url.replace('https://', '').substring(0, 40)}{run.webhook_url.length > 40 ? '…' : ''}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AutomationRuns({ open, automation, onClose }) {
  const [runs,    setRuns]    = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    if (!automation?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`${API}/automations/${automation.id}/runs?limit=50`);
      if (!res.ok) throw new Error();
      setRuns(await res.json());
    } catch { setRuns([]); }
    finally { setLoading(false); }
  }, [automation?.id]);

  useEffect(() => { if (open) fetchRuns(); }, [open, fetchRuns]);

  const successCount = runs.filter(r => r.success).length;
  const failCount    = runs.filter(r => !r.success).length;
  const testCount    = runs.filter(r => r.run_type === 'test').length;
  const liveCount    = runs.filter(r => r.run_type === 'live').length;

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:w-[660px] lg:w-[720px] p-0 flex flex-col"
        style={{ backgroundColor: '#f9f8f5', borderColor: 'var(--stroke)', maxWidth: '720px' }}
      >
        {/* Header */}
        <div
          className="px-7 pt-6 pb-5 border-b shrink-0"
          style={{
            background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 60%, #f9f8f5 100%)',
            borderColor: '#d2d8ef',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mt-0.5" style={{ backgroundColor: 'rgba(3,3,82,0.12)' }}>
                <Activity size={20} style={{ color: '#030352' }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>
                  Run History
                </h2>
                <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--brand-navy)', opacity: 0.55 }}>
                  {automation?.name}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchRuns} className="h-9 w-9 p-0 rounded-lg mt-1" style={{ color: 'var(--text-dim)' }}>
              <RefreshCw size={14} />
            </Button>
          </div>

          {/* Summary stats */}
          {!loading && runs.length > 0 && (
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              {[
                { label: 'Total', value: runs.length, color: '#030352', bg: 'rgba(3,3,82,0.08)' },
                { label: 'Live', value: liveCount, color: '#030352', bg: 'rgba(3,3,82,0.06)' },
                { label: 'Test', value: testCount, color: '#A31800', bg: 'rgba(163,24,0,0.06)' },
                { label: 'Success', value: successCount, color: '#065f46', bg: '#ecfdf5' },
                { label: 'Failed', value: failCount, color: failCount > 0 ? '#991b1b' : 'var(--text-dim)', bg: failCount > 0 ? '#fef2f2' : '#f8f7f4' },
              ].map(s => (
                <div key={s.label} className="text-center px-4 py-2 rounded-xl" style={{ backgroundColor: s.bg }}>
                  <div className="text-lg font-bold tabular-nums" style={{ color: s.color, fontFamily: 'Space Grotesk, sans-serif' }}>{s.value}</div>
                  <div className="text-xs font-medium" style={{ color: s.color, opacity: 0.7 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Runs list */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" style={{ backgroundColor: '#f0ede8' }} />)}
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e8ebf5, #f2f3f9)' }}>
                <Zap size={28} style={{ color: '#030352' }} />
              </div>
              <div className="text-center">
                <p className="text-base font-bold mb-1" style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif' }}>No runs yet</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Run history will appear here once this automation fires<br />
                  or you click the Test button in the builder.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map(run => <RunCard key={run.id} run={run} />)}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
