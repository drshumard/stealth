import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, RefreshCw, Search } from 'lucide-react';
import { DateStamp, IntegrationNote, PageIntro, Person, RecordTable, Status, SurfaceHead, count } from '@/workspace/ui';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Registrations (/stealth) — design: the prototype's Registrations directory. StealthWebinar registrations, newest
// first (the API returns the newest 1,000); a linked row opens its contact.
export default function StealthPage({ onSelectContact, totalRegistrations }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');   // all | Linked | Unlinked
  const { data: regs = [], isLoading, isFetching } = useQuery({
    queryKey: ['stealth'],
    queryFn: () => fetch(`${BACKEND_URL}/api/stealth`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    refetchInterval: 15_000,
  });

  const rows = useMemo(() => regs.filter(r => {
    if (filter !== 'all' && (r.contact_id ? 'Linked' : 'Unlinked') !== filter) return false;
    if (!search) return true;
    return [r.name, r.email, r.phone, ...(r.tags || [])].join(' ').toLowerCase().includes(search.toLowerCase());
  }), [regs, search, filter]);
  const withFb = regs.filter(r => r.has_fbclid).length;
  const withPhone = regs.filter(r => r.phone).length;

  const columns = [
    { label: 'Registrant', key: 'person', className: 'sp-primary', render: r => <Person name={r.name} email={r.email} /> },
    { label: 'Phone', key: 'phone', render: r => r.phone || '—' },
    { label: 'Registered', key: 'date', render: r => <DateStamp value={r.registered_at} /> },
    { label: 'Facebook click', key: 'facebook', render: r => <Status tone={r.has_fbclid ? 'blue' : 'quiet'}>{r.has_fbclid ? 'Tracked' : 'No click'}</Status> },
    { label: 'Tags', key: 'tags', render: r => (r.tags?.length ? <span className="sp-tags">{r.tags.map(t => <Status key={t} tone="blue">{t}</Status>)}</span> : '—') },
    { label: 'Connection', key: 'status', render: r => <Status tone={r.contact_id ? 'green' : 'amber'}>{r.contact_id ? 'Linked' : 'Unlinked'}</Status> },
  ];

  return <>
    <PageIntro eyebrow="Acquisition / StealthWebinar" title="Registrations"
      description="See who registered, how they found you, and whether their record is connected to a lead."
      actions={<button type="button" className="sp-secondary-button" onClick={() => qc.invalidateQueries({ queryKey: ['stealth'] })} disabled={isFetching}>
        <RefreshCw size={15} className={isFetching ? 'sp-spin' : undefined} /> Refresh
      </button>} />
    <IntegrationNote title="StealthWebinar webhook" endpoint={`POST ${BACKEND_URL}/api/stealth/webhook`}
      copy="New registrations are linked to matching contacts and can trigger follow-up automations. Accepts any JSON with email, phone and name." />
    <section className="sp-surface" aria-label="Registrations list">
      <SurfaceHead eyebrow="Directory" title="All registrants"><span className="sp-count">{count(rows.length)} shown</span></SurfaceHead>
      <div className="sp-toolbar">
        <label className="sp-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search registrations</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records" /></label>
        <label className="sp-select-wrap"><span className="sr-only">Filter registrations</span>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All connections</option><option value="Linked">Linked</option><option value="Unlinked">Unlinked</option>
          </select><ChevronDown size={15} aria-hidden="true" /></label>
        {(search || filter !== 'all') && <button type="button" className="sp-clear" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button>}
      </div>
      {isLoading ? <div className="sp-empty">Loading registrations…</div> : (
        <RecordTable rows={rows} columns={columns} label="Registrations"
          onOpen={r => r.contact_id && onSelectContact?.(r.contact_id)}
          emptyText={regs.length ? 'No registrations match these filters.' : 'No registrations yet. Configure StealthWebinar to POST registrations to the webhook above.'}
          foot={<>
            <span>Newest {count(regs.length)}{totalRegistrations != null && ` of ${count(totalRegistrations)}`} registrations · {count(withFb)} from Facebook · {count(withPhone)} with phone</span>
            <span>Unlinked registrations have no contact to open yet</span>
          </>} />
      )}
    </section>
  </>;
}
