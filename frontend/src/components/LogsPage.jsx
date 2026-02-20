import { useState, useEffect, useCallback } from 'react';
import { Globe, RefreshCw, User, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 5)  return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortUrl(url) {
  if (!url) return '—';
  try {
    const u = new URL(url);
    const p = (u.hostname + u.pathname).replace(/\/$/, '');
    return p.length > 50 ? p.slice(0, 47) + '…' : p;
  } catch { return url.slice(0, 50); }
}

const SOURCE_PALETTE = {
  facebook:  { bg: '#fff0e6', text: '#c2410c', border: '#fed7aa' },
  google:    { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  instagram: { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
};
function srcStyle(src) {
  if (!src) return null;
  return SOURCE_PALETTE[src.toLowerCase()] || { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' };
}

function LogRow({ item }) {
  const isId = !!(item.contact_name || item.contact_email);
  const label = item.contact_name || item.contact_email || 'Anonymous';
  const ss = srcStyle(item.utm_source);

  return (
    <div
      data-testid="log-row"
      className="flex items-start gap-3 px-5 py-3 border-b transition-colors"
      style={{ borderColor: 'var(--stroke)' }}
    >
      <div className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isId ? '#10b981' : '#d1d5db' }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
          {isId
            ? <Mail size={11} style={{ color: '#10b981' }} />
            : <User size={11} style={{ color: 'var(--text-dim)' }} />}
          <span className="text-sm font-medium" style={{ color: isId ? 'var(--text)' : 'var(--text-dim)', fontStyle: isId ? 'normal' : 'italic' }}>
            {label}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>visited</span>
          <span className="text-xs font-mono truncate max-w-[280px]" style={{ color: '#0891b2', fontFamily: 'IBM Plex Mono, monospace' }} title={item.url}>
            {shortUrl(item.url)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {item.page_title && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{item.page_title}</span>}
          {ss && item.utm_source && (
            <span className="inline-flex text-xs px-2 py-0 rounded-full font-medium border" style={{ backgroundColor: ss.bg, color: ss.text, borderColor: ss.border }}>
              {item.utm_source}
            </span>
          )}
        </div>
      </div>

      <span className="text-xs shrink-0 tabular-nums" style={{ color: 'var(--text-dim)' }} title={item.timestamp}>
        {timeAgo(item.timestamp)}
      </span>
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [last, setLast]   = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/logs?limit=200`);
      if (!res.ok) throw new Error();
      setLogs(await res.json());
      setLast(new Date());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); const t = setInterval(fetchLogs, 10000); return () => clearInterval(t); }, [fetchLogs]);

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}>Activity Logs</h1>
          {last && <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>Updated {timeAgo(last)}</p>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge className="text-xs font-mono px-2 h-7" style={{ backgroundColor: '#fff7ed', color: 'var(--primary-orange)', border: '1px solid #fed7aa' }}>
            {logs.length} events
          </Badge>
          <Button variant="ghost" size="sm" onClick={fetchLogs} className="h-8 w-8 p-0" style={{ color: 'var(--text-dim)' }}>
            <RefreshCw size={13} />
          </Button>
        </div>
      </div>

      {/* Feed card */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-soft)' }}>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" style={{ backgroundColor: '#f0ede8' }} />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-dim)' }}>
            <Globe size={32} />
            <p className="text-sm">No activity yet.</p>
          </div>
        ) : (
          <div data-testid="logs-feed">
            {logs.map((item, i) => <LogRow key={`${item.contact_id}-${i}`} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}
