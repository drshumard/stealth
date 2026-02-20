import { useState, useEffect, useCallback } from 'react';
import { Globe, RefreshCw, User, Mail, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 5)  return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortUrl(url) {
  if (!url) return '—';
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/\/$/, '') || url;
  } catch { return url.slice(0, 60); }
}

function LogRow({ item }) {
  const isIdentified = !!(item.contact_name || item.contact_email || item.contact_phone);
  const label = item.contact_name || item.contact_email || item.contact_phone || 'Anonymous';

  return (
    <div
      data-testid="log-row"
      className="flex items-start gap-3 px-4 py-3 border-b"
      style={{ borderColor: 'var(--stroke)' }}
    >
      {/* Dot */}
      <div className="mt-1.5 shrink-0">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: isIdentified ? 'var(--mint-success)' : 'var(--stroke)' }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
          {/* Contact */}
          <div className="flex items-center gap-1">
            {isIdentified
              ? <Mail size={11} style={{ color: 'var(--mint-success)' }} />
              : <User size={11} style={{ color: 'var(--text-dim)' }} />
            }
            <span
              className="text-xs font-medium"
              style={{ color: isIdentified ? 'var(--text)' : 'var(--text-dim)', fontStyle: isIdentified ? 'normal' : 'italic' }}
            >
              {label}
            </span>
          </div>

          {/* URL */}
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>visited</span>
          <span
            className="text-xs font-mono truncate max-w-xs"
            style={{ color: 'var(--primary-cyan)', fontFamily: 'IBM Plex Mono, monospace' }}
            title={item.url}
          >
            {shortUrl(item.url)}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-2 mt-0.5">
          {item.page_title && (
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{item.page_title}</span>
          )}
          {item.utm_source && (
            <Badge
              variant="secondary"
              className="text-xs px-1.5 py-0 h-4"
              style={{
                backgroundColor: 'rgba(245,158,11,0.1)',
                color: 'var(--amber-warn)',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              {item.utm_source}
            </Badge>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <span
        className="text-xs shrink-0 tabular-nums"
        style={{ color: 'var(--text-dim)' }}
        title={item.timestamp}
      >
        {timeAgo(item.timestamp)}
      </span>
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/logs?limit=200`);
      if (!res.ok) throw new Error('Failed');
      setLogs(await res.json());
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Failed to load logs', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--stroke)' }}
      >
        <div>
          <h1
            className="text-sm font-semibold"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
          >
            Activity Logs
          </h1>
          {lastRefresh && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
              Updated {timeAgo(lastRefresh)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="text-xs font-mono px-2"
            style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--stroke)', color: 'var(--text-muted)' }}
          >
            {logs.length} events
          </Badge>
          <Button
            data-testid="logs-refresh-button"
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            className="h-7 w-7 p-0"
            style={{ backgroundColor: 'var(--bg-elev-2)', borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
          >
            <RefreshCw size={13} />
          </Button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" style={{ backgroundColor: 'var(--stroke)' }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-20" style={{ color: 'var(--text-dim)' }}>
            <Globe size={32} />
            <p className="text-sm">No activity yet.</p>
            <p className="text-xs max-w-xs text-center">
              Activity will appear here once the Shumard script is tracking page views.
            </p>
          </div>
        ) : (
          <div data-testid="logs-feed">
            {logs.map((item, i) => (
              <LogRow key={`${item.contact_id}-${item.timestamp}-${i}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
