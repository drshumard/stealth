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
    return p.length > 56 ? p.slice(0, 53) + '…' : p;
  } catch { return url.slice(0, 56); }
}

const SRC = {
  facebook:  { bg: '#fff0e6', text: '#c2410c', border: '#fed7aa' },
  google:    { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  instagram: { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
};
function srcStyle(src) {
  if (!src) return null;
  return SRC[src.toLowerCase()] || { bg: '#f0f9f4', text: '#166534', border: '#bbf7d0' };
}

function LogRow({ item }) {
  const isId = !!(item.contact_name || item.contact_email);
  const label = item.contact_name || item.contact_email || 'Anonymous';
  const ss = srcStyle(item.utm_source);

  return (
    <div
      data-testid="log-row"
      className="flex items-start gap-4 px-7 py-5 border-b hover:bg-[#faf9f7] transition-colors"
      style={{ borderColor: 'var(--stroke)' }}
    >
      <div className="mt-2 shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: isId ? '#059669' : '#d1cfc8' }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
          {isId
            ? <Mail size={12} style={{ color: '#059669' }} />
            : <User size={12} style={{ color: 'var(--text-dim)' }} />}
          <span className="text-sm font-semibold" style={{ color: isId ? 'var(--text)' : 'var(--text-dim)', fontStyle: isId ? 'normal' : 'italic' }}>
            {label}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-dim)' }}>visited</span>
          <span
            className="text-sm font-medium font-mono truncate max-w-xs"
            style={{ color: 'var(--brand-navy)', fontFamily: 'IBM Plex Mono, monospace' }}
            title={item.url}
          >
            {shortUrl(item.url)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {item.page_title && <span className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>{item.page_title}</span>}
          {ss && item.utm_source && (
            <span className="inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-md border" style={{ backgroundColor: ss.bg, color: ss.text, borderColor: ss.border }}>
              {item.utm_source}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs font-medium shrink-0 tabular-nums mt-0.5" style={{ color: 'var(--text-dim)' }} title={item.timestamp}>
        {timeAgo(item.timestamp)}
      </span>
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoad]  = useState(true);
  const [last, setLast]     = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/logs?limit=200`);
      if (!res.ok) throw new Error();
      setLogs(await res.json());
      setLast(new Date());
    } catch {}
    finally { setLoad(false); }
  }, []);

  useEffect(() => { fetchLogs(); const t = setInterval(fetchLogs, 10000); return () => clearInterval(t); }, [fetchLogs]);

  return (
    <div className="p-8 md:p-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>Activity Logs</h1>
          {last && <p className="text-base mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>Updated {timeAgo(last)}</p>}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--brand-red)' }}>{logs.length} events</span>
          <Button variant="ghost" size="sm" onClick={fetchLogs} className="h-9 w-9 p-0 rounded-lg" style={{ color: 'var(--text-dim)' }}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-soft)' }}>
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" style={{ backgroundColor: '#f0ede8' }} />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4" style={{ color: 'var(--text-dim)' }}>
            <Globe size={36} />
            <p className="text-base font-medium">No activity yet.</p>
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
