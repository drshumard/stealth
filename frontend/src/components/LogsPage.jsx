import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, RefreshCw, User, Mail, Activity } from 'lucide-react';
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
    <div data-testid="log-row"
      className="flex items-start gap-4 px-7 py-5 border-b hover:bg-[#faf9f7] transition-colors"
      style={{ borderColor: 'rgba(3,3,82,0.07)', backgroundColor: isId ? 'rgba(3,3,82,0.018)' : 'transparent',
               borderLeft: isId ? '3px solid rgba(3,3,82,0.25)' : '3px solid transparent' }}>
      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
        style={{ backgroundColor: isId ? 'rgba(3,3,82,0.10)' : '#f0ede8', color: isId ? '#030352' : '#9898aa' }}>
        {isId ? (item.contact_name?.[0] || item.contact_email?.[0] || '?').toUpperCase() : <User size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold" style={{ color: isId ? 'var(--brand-navy)' : 'var(--text-dim)', fontStyle: isId ? 'normal' : 'italic' }}>
            {label}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-dim)' }}>visited</span>
          <span className="text-sm font-medium font-mono truncate max-w-xs"
            style={{ color: '#0369a1', fontFamily: 'IBM Plex Mono, monospace' }} title={item.url}>
            {shortUrl(item.url)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {item.page_title && <span className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>{item.page_title}</span>}
          {ss && item.utm_source && (
            <span className="inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-md border"
              style={{ backgroundColor: ss.bg, color: ss.text, borderColor: ss.border }}>{item.utm_source}</span>
          )}
        </div>
      </div>
      <span className="text-xs font-medium shrink-0 tabular-nums mt-1" style={{ color: 'var(--text-dim)' }} title={item.timestamp}>
        {timeAgo(item.timestamp)}
      </span>
    </div>
  );
}

export default function LogsPage() {
  const qc = useQueryClient();

  const { data: logs = [], isLoading: loading, dataUpdatedAt } = useQuery({
    queryKey: ['logs'],
    queryFn: () => fetch(`${BACKEND_URL}/api/logs?limit=200`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    refetchInterval: 10_000,
  });

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const identified  = logs.filter(l => l.contact_name || l.contact_email).length;

  return (
    <div className="p-8 md:p-10">
      <div className="rounded-2xl px-8 py-7 mb-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 50%, #f9f8f5 100%)', border: '1.5px solid #d2d8ef' }}>
        <Activity size={140} className="absolute -right-6 -bottom-6 opacity-[0.05] pointer-events-none" color="#030352" aria-hidden />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>Activity Logs</h1>
            {lastRefresh && <p className="text-base mt-1 font-semibold" style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>Updated {timeAgo(lastRefresh)}</p>}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--brand-red)', fontFamily: 'Space Grotesk, sans-serif' }}>{logs.length}</div>
              <div className="text-xs font-semibold" style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>total events</div>
            </div>
            <div className="w-px h-10 hidden sm:block" style={{ backgroundColor: 'rgba(3,3,82,0.15)' }} />
            <div className="text-right hidden sm:block">
              <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif' }}>{identified}</div>
              <div className="text-xs font-semibold" style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>identified</div>
            </div>
            <Button variant="ghost" size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ['logs'] })}
              className="h-9 w-9 p-0 rounded-lg" style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: '0 4px 20px rgba(3,3,82,0.06)' }}>
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" style={{ backgroundColor: '#f0ede8' }} />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4" style={{ color: 'var(--text-dim)' }}>
            <Globe size={36} /><p className="text-base font-medium">No activity yet.</p>
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
