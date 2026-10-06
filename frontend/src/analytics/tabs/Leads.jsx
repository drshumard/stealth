import { useState } from 'react';
import { Download, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useTimezone } from '@/components/TimezoneContext';
import { API, PALETTE, downloadCsv, fmtHours, fmtNum, fmtPct, getAnalytics, qs, useA } from '../lib';
import { BarList, DataTable, Funnel, Histogram, Legend, Panel, Select, StackedChart } from '../charts';
import { useSeries } from './Overview';

const DIMS = [
  { value: 'source', label: 'Source' }, { value: 'campaign', label: 'Campaign' }, { value: 'content', label: 'Ad' },
  { value: 'term', label: 'Ad set' }, { value: 'medium', label: 'Medium' }, { value: 'device', label: 'Device' },
  { value: 'browser', label: 'Browser / app' }, { value: 'os', label: 'Operating system' }, { value: 'weekday', label: 'Weekday first seen' },
  { value: 'hour', label: 'Hour first seen' },
];

export default function Leads({ state, update, onSelectContact }) {
  const funnel = useA('/funnel', state);
  const { ts, gran, series } = useSeries(state);
  const timing = useA('/timing', state);
  const dim = state.params.get('ad') || 'campaign';
  const byDim = useA('/breakdown', state, { dimension: dim, base: 'contacts', limit: 200, sort: 'identified' });
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const people = useA('/abandoned', state, { q, offset, limit: 25 });
  const a = people.data;
  const t = timing.data;

  const periodIdf = series.reduce((s, x) => s + x.identified, 0);
  const periodAband = series.reduce((s, x) => s + x.abandoned, 0);
  const withRate = series.map(x => ({ bucket: x.bucket, Registered: Math.max(0, x.identified - x.abandoned), Abandoned: x.abandoned }));
  const dimRows = (byDim.data?.rows || []).filter(r => r.identified >= 5);

  return <>
    <div className="an-stat-strip an-stat-strip-lg">
      <div><span>Identified in period</span><strong>{fmtNum(a?.identified ?? periodIdf)}</strong></div>
      <div data-tone="bad"><span>Abandoned</span><strong>{fmtNum(a?.abandoned ?? periodAband)}</strong></div>
      <div data-tone="bad"><span>Abandon rate</span><strong>{fmtPct(a?.abandon_rate)}</strong></div>
      <div><span>Median time to identify</span><strong>{fmtHours(t?.to_identify?.median_hours)}</strong></div>
      <div><span>Median time to register</span><strong>{fmtHours(t?.to_register?.median_hours)}</strong></div>
      <div><span>Median time to purchase</span><strong>{fmtHours(t?.to_purchase?.median_hours)}</strong></div>
    </div>
    <p className="an-note an-note-top">Abandoned = gave an email or phone but has no <code>stealth</code> or <code>registered</code> tag — they never completed registration.</p>

    <div className="an-grid an-grid-2">
      <Panel title="Funnel" eyebrow="People first seen in this period" query={funnel} empty={!funnel.data?.steps?.[0]?.count}>
        {funnel.data && <Funnel steps={funnel.data.steps} />}
      </Panel>
      <Panel title="Registered vs abandoned" eyebrow="Leads by the day they were identified" query={ts} empty={!series.length}
        footer={<Legend items={[{ label: 'Registered', color: PALETTE[1] }, { label: 'Abandoned', color: PALETTE[4] }]} />}>
        <StackedChart data={withRate} keys={['Registered', 'Abandoned']} gran={gran} kind="bar" colors={[PALETTE[1], PALETTE[4]]} />
      </Panel>
    </div>

    <Panel title="Where leads abandon" eyebrow="Abandon rate of the people first seen in this period (5+ identified)" query={byDim} empty={!dimRows.length}
      actions={<Select label="Group by" value={dim} onChange={v => update({ ad: v === 'campaign' ? null : v })} options={DIMS} />}>
      <DataTable rows={dimRows} rowKey={r => String(r.raw)} defaultSort={{ key: 'abandoned', dir: 'desc' }} maxRows={15}
        exportName={`abandonment-by-${dim}-${state.since}-${state.until}`}
        onRowClick={['weekday', 'hour', 'device', 'browser', 'os'].includes(dim) ? undefined : r => update({ [dim]: String(r.raw), tab: 'leads' })}
        columns={[
          { key: 'key', label: DIMS.find(d => d.value === dim)?.label, render: r => <strong className="an-key" title={r.key}>{r.key}</strong>, sortValue: r => String(r.key) },
          { key: 'contacts', label: 'People', fmt: 'num' },
          { key: 'identified', label: 'Identified', fmt: 'num' },
          { key: 'registered', label: 'Registered', fmt: 'num' },
          { key: 'abandoned', label: 'Abandoned', fmt: 'num' },
          { key: 'abandon_rate', label: 'Abandon rate', fmt: 'pct', render: r => <span className="an-rate" data-tone={r.abandon_rate > 0.3 ? 'bad' : r.abandon_rate > 0.15 ? 'mid' : 'good'}>{fmtPct(r.abandon_rate)}</span> },
          { key: 'buyers', label: 'Buyers', fmt: 'num' },
          { key: 'revenue', label: 'Revenue', fmt: 'money' },
        ]} />
    </Panel>

    <div className="an-grid an-grid-2">
      <Panel title="Last page before abandoning" eyebrow="The final page abandoned leads viewed" query={people} empty={!a?.last_pages?.length}>
        {a && <BarList rows={a.last_pages} label="page" value="count" tone="red" secondary={r => fmtPct(r.count / Math.max(1, a.abandoned), 0)}
          onClick={r => update({ tab: 'pages', pg: r.page })} />}
      </Panel>
      <Panel title="How engaged were they?" eyebrow="Page views per abandoned lead (all time)" query={people} empty={!a?.visits}>
        {a && <Histogram rows={a.visits} label="leads" color={PALETTE[4]} />}
      </Panel>
    </div>

    <div className="an-grid an-grid-2">
      <Panel title="Time to identify" eyebrow={`First visit → email/phone · ${fmtNum(t?.to_identify?.n)} people`} query={timing} empty={!t?.to_identify?.n}>
        {t && <Histogram rows={t.to_identify.histogram} label="people" />}
      </Panel>
      <Panel title="Time to register" eyebrow={`First visit → webinar registration · ${fmtNum(t?.to_register?.n)} people`} query={timing} empty={!t?.to_register?.n}>
        {t && <Histogram rows={t.to_register.histogram} label="people" color={PALETTE[1]} />}
      </Panel>
      <Panel title="Time to purchase" eyebrow={`First visit → first sale · ${fmtNum(t?.to_purchase?.n)} buyers`} query={timing} empty={!t?.to_purchase?.n}>
        {t && <Histogram rows={t.to_purchase.histogram} label="buyers" color={PALETTE[2]} />}
      </Panel>
      <Panel title="Visits before buying" eyebrow={`Page views up to the first sale · median ${fmtNum(t?.visits_before_purchase?.median)}`} query={timing} empty={!t?.visits_before_purchase?.n}>
        {t && <Histogram rows={t.visits_before_purchase.histogram} label="buyers" color={PALETTE[3]} />}
      </Panel>
    </div>

    <Panel title="Abandoned leads" eyebrow={`${fmtNum(a?.matching)} people · identified in this period, never registered`} query={people}
      actions={<>
        <label className="sp-search an-search"><Search size={15} /><input value={q} placeholder="Search name, email, phone"
          onChange={e => { setQ(e.target.value); setOffset(0); }} aria-label="Search abandoned leads" /></label>
        <ExportAbandoned state={state} q={q} total={a?.matching} />
      </>}
      footer={a && a.matching > 25 && (
        <span className="an-pager">
          <button type="button" className="sp-secondary-button an-small-button" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - 25))}>Previous</button>
          <small>{fmtNum(offset + 1)}–{fmtNum(Math.min(offset + 25, a.matching))} of {fmtNum(a.matching)}</small>
          <button type="button" className="sp-secondary-button an-small-button" disabled={offset + 25 >= a.matching} onClick={() => setOffset(o => o + 25)}>Next</button>
        </span>
      )}>
      {a && (a.people.length ? <AbandonedTable people={a.people} onSelectContact={onSelectContact} /> : <div className="an-state">No abandoned leads match.</div>)}
    </Panel>
  </>;
}

function AbandonedTable({ people, onSelectContact }) {
  const { formatDateTime } = useTimezone();
  return (
    <DataTable rows={people} rowKey={r => r.contact_id} onRowClick={r => onSelectContact?.(r.contact_id)} defaultSort={{ key: 'updated_at', dir: 'desc' }}
      columns={[
        { key: 'name', label: 'Person', render: r => <span className="an-page-cell"><strong>{r.name || r.email || r.phone}</strong><small>{r.name ? r.email || r.phone : r.phone}</small></span>, sortValue: r => r.name || r.email || '' },
        { key: 'source', label: 'Source', render: r => r.source || '—' },
        { key: 'campaign', label: 'Campaign', render: r => <span className="an-key" title={r.campaign}>{r.campaign || '—'}</span> },
        { key: 'visits', label: 'Views', fmt: 'num' },
        { key: 'first_identified_at', label: 'Identified', render: r => formatDateTime(r.first_identified_at || r.created_at), sortValue: r => r.first_identified_at || r.created_at, align: 'right' },
        { key: 'updated_at', label: 'Last activity', render: r => formatDateTime(r.updated_at), align: 'right' },
      ]} />
  );
}

function ExportAbandoned({ state, q, total }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const data = await getAnalytics(`${API}/abandoned?${qs(state, { q, limit: 5000 })}`);
      downloadCsv(`abandoned-leads-${state.since}-${state.until}.csv`, [
        { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
        { key: 'source', label: 'Source' }, { key: 'campaign', label: 'Campaign' }, { key: 'ad', label: 'Ad' },
        { key: 'visits', label: 'Page views' }, { key: 'first_identified_at', label: 'Identified at' },
        { key: 'created_at', label: 'First seen' }, { key: 'updated_at', label: 'Last activity' },
        { key: 'tags', label: 'Tags', csv: r => (r.tags || []).join(' ') }, { key: 'contact_id', label: 'Contact ID' },
      ], data.people);
      if (data.matching > 5000) toast.message(`Exported the 5,000 most recent of ${fmtNum(data.matching)}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="sp-secondary-button an-small-button" onClick={run} disabled={busy || !total}>
      {busy ? <Loader2 size={13} className="sp-spin" /> : <Download size={13} />} Export
    </button>
  );
}
