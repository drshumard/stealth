import { FILTER_KEYS, PALETTE, fmtMoney, fmtNum, fmtPct, useA } from '../lib';
import { Bubble, DataTable, Legend, Panel, Segmented, Select, StackedChart } from '../charts';

export const CONTACT_DIMS = [
  { value: 'source', label: 'Source' }, { value: 'medium', label: 'Medium' }, { value: 'campaign', label: 'Campaign' },
  { value: 'content', label: 'Ad (utm_content)' }, { value: 'term', label: 'Ad set (utm_term)' }, { value: 'device', label: 'Device' },
  { value: 'os', label: 'Operating system' }, { value: 'browser', label: 'Browser / app' }, { value: 'status', label: 'Lead status' },
  { value: 'weekday', label: 'Weekday first seen' }, { value: 'hour', label: 'Hour first seen' },
];
const RATE = [{ value: 'registration_rate', label: 'Registration rate' }, { value: 'identification_rate', label: 'Identification rate' },
  { value: 'abandon_rate', label: 'Abandon rate' }, { value: 'purchase_rate', label: 'Purchase rate' }];
const TREND_METRIC = [{ value: 'contacts', label: 'New people' }, { value: 'identified', label: 'Identified' },
  { value: 'registered', label: 'Registered' }, { value: 'abandoned', label: 'Abandoned' }];

export default function Attribution({ state, update }) {
  const dim = state.params.get('d') || 'campaign';
  const rateKey = state.params.get('r') || 'registration_rate';
  const size = state.params.get('z') || 'revenue';
  const trendMetric = state.params.get('tm') || 'identified';
  const share = state.params.get('ts') === 'share';
  const q = useA('/breakdown', state, { dimension: dim, base: 'contacts', limit: 300 });
  const trend = useA('/breakdown/trend', state, { dimension: dim, base: 'contacts', metric: trendMetric, top: 6, granularity: state.gran });
  const rows = q.data?.rows || [];
  const label = CONTACT_DIMS.find(x => x.value === dim)?.label;
  const drillable = FILTER_KEYS.includes(dim);
  const drill = r => drillable && update({ [dim]: String(r.raw), tab: 'overview' });
  const minSize = Math.max(20, Math.round((q.data?.totals?.contacts || 0) / 2000));
  const maxContacts = Math.max(1, ...rows.map(r => r.contacts));

  return <>
    <div className="an-toolbar">
      <Select label="Dimension" value={dim} onChange={v => update({ d: v === 'campaign' ? null : v })} options={CONTACT_DIMS} />
      <span className="an-note">People first seen in the period, grouped by {label?.toLowerCase()}, and what they went on to do.{drillable && ' Click a row to filter the dashboard to it.'}</span>
    </div>

    <div className="an-grid an-grid-2">
      <Panel title="Volume vs conversion" eyebrow={`Bubble size: ${size === 'revenue' ? 'revenue' : 'buyers'} · groups with ${minSize}+ people`} query={q}
        empty={!rows.filter(r => r.contacts >= minSize).length}
        actions={<>
          <Select label="Rate" value={rateKey} onChange={v => update({ r: v === 'registration_rate' ? null : v })} options={RATE} />
          <Segmented label="Bubble size" value={size} onChange={v => update({ z: v === 'revenue' ? null : v })}
            options={[{ value: 'revenue', label: 'Revenue' }, { value: 'buyers', label: 'Buyers' }]} />
        </>}>
        <Bubble rows={rows.filter(r => r.contacts >= minSize)} x="contacts" y={rateKey} z={size} xLabel="People" yLabel={RATE.find(r => r.value === rateKey)?.label}
          zLabel={size === 'revenue' ? 'Revenue' : 'Buyers'} zFmt={size === 'revenue' ? fmtMoney : fmtNum} onClick={drill} />
      </Panel>
      <Panel title={`${label} over time`} eyebrow={`Top 6 by ${TREND_METRIC.find(m => m.value === trendMetric)?.label.toLowerCase()}`} query={trend} empty={!trend.data?.series?.length}
        actions={<>
          <Select label="Metric" value={trendMetric} onChange={v => update({ tm: v === 'identified' ? null : v })} options={TREND_METRIC} />
          <Segmented label="Scale" value={share ? 'share' : 'count'} onChange={v => update({ ts: v === 'share' ? 'share' : null })}
            options={[{ value: 'count', label: 'Count' }, { value: 'share', label: 'Share' }]} />
        </>}
        footer={trend.data && <Legend items={trend.data.keys.map((k, i) => ({ label: k, color: PALETTE[i] }))} />}>
        {trend.data && <StackedChart data={trend.data.series} keys={trend.data.keys} gran={trend.data.granularity} percent={share} />}
      </Panel>
    </div>

    <Panel title={`By ${label?.toLowerCase()}`} eyebrow={`${fmtNum(q.data?.total_rows)} groups`} query={q} empty={!rows.length}>
      <DataTable rows={rows} rowKey={r => String(r.raw)} defaultSort={{ key: 'contacts', dir: 'desc' }} maxRows={30}
        onRowClick={drillable ? drill : undefined} exportName={`attribution-${dim}-${state.since}-${state.until}`}
        columns={[
          { key: 'key', label, render: r => <strong className="an-key" title={r.key}>{r.key}</strong>, sortValue: r => String(r.key) },
          { key: 'contacts', label: 'People', fmt: 'num', bar: maxContacts },
          { key: 'identified', label: 'Identified', fmt: 'num' },
          { key: 'identification_rate', label: 'ID rate', fmt: 'pct' },
          { key: 'registered', label: 'Registered', fmt: 'num' },
          { key: 'registration_rate', label: 'Reg. rate', fmt: 'pct', hint: 'Registered ÷ identified' },
          { key: 'abandoned', label: 'Abandoned', fmt: 'num' },
          { key: 'abandon_rate', label: 'Abandon rate', fmt: 'pct' },
          { key: 'buyers', label: 'Buyers', fmt: 'num' },
          { key: 'revenue', label: 'Revenue', fmt: 'money' },
          { key: 'revenue_per_contact', label: 'Rev. / person', fmt: 'money', render: r => (r.revenue_per_contact ? `$${r.revenue_per_contact.toFixed(2)}` : '—') },
        ]} />
      {q.data?.totals && <p className="an-note">Totals: {fmtNum(q.data.totals.contacts)} people · {fmtNum(q.data.totals.identified)} identified ({fmtPct(q.data.totals.identified / q.data.totals.contacts)}) · {fmtNum(q.data.totals.registered)} registered · {fmtNum(q.data.totals.buyers)} buyers · {fmtMoney(q.data.totals.revenue)}</p>}
    </Panel>
  </>;
}
