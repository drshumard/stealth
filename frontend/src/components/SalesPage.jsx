import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, DollarSign, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { SaleDetailModal } from '@/components/SaleDetailModal';
import { DateStamp, IntegrationNote, Metric, PageIntro, Person, RecordTable, Status, SurfaceHead, count, money } from '@/workspace/ui';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const STATUS_TONE = {
  completed: 'green', paid: 'green', success: 'green',
  pending: 'amber', processing: 'amber',
  refunded: 'red', failed: 'red', cancelled: 'red',
};

// Sales — design: the prototype's Sales directory. Totals are every sale (/api/stats); the list is the newest 500.
// A matched sale opens its contact (Sales tab); an unmatched one opens the sale itself.
export default function SalesPage({ onSelectContact, stats = {} }) {
  const qc = useQueryClient();
  const [detailSale, setDetailSale] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');   // all | Matched | Unmatched
  const { data: sales = [], isLoading: loading, isFetching } = useQuery({
    queryKey: ['sales'],
    queryFn: () => fetch(`${BACKEND_URL}/api/sales`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    refetchInterval: 20_000,
  });

  const matched = sales.filter(s => s.contact_id).length;
  const rows = useMemo(() => sales.filter(s => {
    if (filter !== 'all' && (s.contact_id ? 'Matched' : 'Unmatched') !== filter) return false;
    if (!search) return true;
    return [s.contact_name, s.contact_email, s.email, s.product, s.source, s.status].join(' ').toLowerCase().includes(search.toLowerCase());
  }), [sales, search, filter]);

  const columns = [
    { label: 'Customer', key: 'person', className: 'sp-primary', render: s => <Person name={s.contact_name} email={s.contact_email || s.email} /> },
    { label: 'Product', key: 'product', render: s => s.product || '—' },
    { label: 'Amount', key: 'amount', render: s => <span className="sp-amount-cell"><strong className="sp-amount">{money(s.amount, s.currency)}</strong>{s.source && <small>{s.source}</small>}</span> },
    { label: 'Status', key: 'status', render: s => <Status tone={STATUS_TONE[s.status?.toLowerCase()] || 'quiet'}>{s.status || 'unknown'}</Status> },
    { label: 'Paid', key: 'date', render: s => <DateStamp value={s.created_at} /> },
    { label: 'Connection', key: 'connection', render: s => <Status tone={s.contact_id ? 'green' : 'amber'}>{s.contact_id ? 'Matched' : 'Unmatched'}</Status> },
  ];
  const revenue = stats.total_revenue;
  const orders = stats.total_sales;

  return <>
    <PageIntro eyebrow="Operations / Payments" title="Sales"
      description="Connect each payment to the person and campaign behind it."
      actions={<button type="button" className="sp-secondary-button" onClick={() => qc.invalidateQueries({ queryKey: ['sales'] })} disabled={isFetching}>
        <RefreshCw size={15} className={isFetching ? 'sp-spin' : undefined} /> Refresh
      </button>} />
    <div className="sp-metrics sp-metrics-three">
      <Metric icon={DollarSign} label="Revenue" value={revenue == null ? '—' : money(revenue)}
        detail={revenue && orders ? `Avg order ${money(revenue / orders)}` : 'All sales'} />
      <Metric icon={Users} label="Orders" value={count(orders)} detail="All sales" tone="aqua" />
      <Metric icon={ShieldCheck} label="Matched" value={sales.length ? `${Math.round((matched / sales.length) * 100)}%` : '—'}
        detail={`Connected to a lead · newest ${count(sales.length)}`} tone="green" />
    </div>
    <IntegrationNote title="Sales webhook" endpoint={`POST ${BACKEND_URL}/api/sales/webhook`}
      copy="Incoming sales are matched to contacts by email so the full journey stays together. Send any JSON payload: email, amount and product are picked out automatically." />
    <section className="sp-surface" aria-label="Sales list">
      <SurfaceHead eyebrow="Directory" title="All sales"><span className="sp-count">{count(rows.length)} shown</span></SurfaceHead>
      <div className="sp-toolbar">
        <label className="sp-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search sales</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records" /></label>
        <label className="sp-select-wrap"><span className="sr-only">Filter sales</span>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All connections</option><option value="Matched">Matched</option><option value="Unmatched">Unmatched</option>
          </select><ChevronDown size={15} aria-hidden="true" /></label>
        {(search || filter !== 'all') && <button type="button" className="sp-clear" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button>}
      </div>
      {loading ? <div className="sp-empty">Loading sales…</div> : (
        <RecordTable rows={rows} columns={columns} label="Sales"
          onOpen={s => (s.contact_id ? onSelectContact?.(s.contact_id) : setDetailSale(s))}
          emptyText={sales.length ? 'No sales match these filters.' : 'No sales yet. POST a sale payload to the webhook above.'}
          foot={<>
            <span>Newest {count(sales.length)}{orders != null && ` of ${count(orders)}`} sales · {count(matched)} matched to contacts</span>
            <span>Matched sales open the contact; unmatched ones open the sale</span>
          </>} />
      )}
    </section>
    <SaleDetailModal sale={detailSale} open={!!detailSale} onClose={() => setDetailSale(null)} />
  </>;
}
