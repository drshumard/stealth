import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTimezone } from '@/components/TimezoneContext';
import { ChevronDown, RefreshCw, Search } from 'lucide-react';
import { DateStamp, PageIntro, Person, RecordTable, Status, SurfaceHead, count } from '@/workspace/ui';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function timeAgo(ts, timezone = 'UTC') {
  if (!ts) return '';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 5)  return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', month: 'short', day: 'numeric' }).format(new Date(ts));
}

function shortUrl(url) {
  if (!url) return '—';
  try {
    const u = new URL(url);
    const p = (u.hostname + u.pathname).replace(/\/$/, '');
    return p.length > 56 ? p.slice(0, 53) + '…' : p;
  } catch { return url.slice(0, 56); }
}

// Activity (/logs) — design: the prototype's Activity directory: the newest 200 page visits, live (10s refresh).
// A row opens the visitor's contact.
export default function LogsPage({ onSelectContact }) {
  const { timezone } = useTimezone();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');   // all | identified | anonymous
  const { data: logs = [], isLoading: loading, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['logs'],
    queryFn: () => fetch(`${BACKEND_URL}/api/logs?limit=200`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    refetchInterval: 10_000,
  });

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const isId = l => !!(l.contact_name || l.contact_email);
  const identified = logs.filter(isId).length;
  const rows = useMemo(() => logs.filter(l => {
    if (filter !== 'all' && (filter === 'identified') !== isId(l)) return false;
    if (!search) return true;
    return [l.contact_name, l.contact_email, l.url, l.page_title, l.utm_source].join(' ').toLowerCase().includes(search.toLowerCase());
  }), [logs, search, filter]);

  const columns = [
    { label: 'Event', key: 'event', className: 'sp-primary', render: l => <><strong>{l.page_title || 'Page visit'}</strong><span title={l.url}>{shortUrl(l.url)}</span></> },
    { label: 'Who', key: 'who', render: l => <Person name={l.contact_name} email={l.contact_email} /> },
    { label: 'Source', key: 'source', render: l => (l.utm_source ? <Status tone="blue">{l.utm_source}</Status> : '—') },
    { label: 'When', key: 'when', render: l => <span className="sp-when"><DateStamp value={l.timestamp} /><small>{timeAgo(l.timestamp, timezone)}</small></span> },
  ];

  return <>
    <PageIntro eyebrow="Insights / Event stream" title="Activity" description="The important signals in one readable timeline."
      actions={<button type="button" className="sp-secondary-button" onClick={() => qc.invalidateQueries({ queryKey: ['logs'] })} disabled={isFetching}>
        <RefreshCw size={15} className={isFetching ? 'sp-spin' : undefined} /> Refresh
      </button>} />
    <section className="sp-surface" aria-label="Activity list">
      <SurfaceHead eyebrow="Live feed" title="Recent page visits">
        <span className="sp-count">{lastRefresh ? `Updated ${timeAgo(lastRefresh, timezone)}` : 'Loading'}</span>
      </SurfaceHead>
      <div className="sp-toolbar">
        <label className="sp-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search activity</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records" /></label>
        <label className="sp-select-wrap"><span className="sr-only">Filter events</span>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All events</option><option value="identified">Identified visitors</option><option value="anonymous">Anonymous visitors</option>
          </select><ChevronDown size={15} aria-hidden="true" /></label>
        {(search || filter !== 'all') && <button type="button" className="sp-clear" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button>}
      </div>
      {loading ? <div className="sp-empty">Loading activity…</div> : (
        <div data-testid="logs-feed">
          <RecordTable rows={rows} columns={columns} label="Activity" rowKey={l => `${l.contact_id}-${l.timestamp}-${l.url}`}
            onOpen={l => l.contact_id && onSelectContact?.(l.contact_id)}
            emptyText={logs.length ? 'No events match these filters.' : 'No activity yet.'}
            foot={<>
              <span>Newest {count(logs.length)} page visits · {count(identified)} by identified visitors</span>
              <span>Refreshes every 10 seconds</span>
            </>} />
        </div>
      )}
    </section>
  </>;
}
