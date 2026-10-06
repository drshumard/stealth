import { useTimezone } from '@/components/TimezoneContext';
import { Status } from '@/workspace/ui';
import { PALETTE, fmtNum, fmtPct, useA } from '../lib';
import { DataTable, Heatmap, Histogram, Legend, Panel, Segmented, Select, StackedChart } from '../charts';
import { useSeries } from './Overview';

const SEG_ROWS = [
  ['visitors', 'Visitors', fmtNum], ['visits', 'Page views', fmtNum], ['visits_per_visitor', 'Views per visitor', v => fmtNum(v)],
  ['identification_rate', 'Identified', fmtPct], ['registration_rate', 'Registered', fmtPct], ['purchase_rate', 'Bought', v => fmtPct(v, 2)],
];

export default function Visitors({ state, update, onSelectContact }) {
  const v = useA('/visitors', state);
  const { ts, gran, series } = useSeries(state);
  const share = state.params.get('vs') === 'share';
  const heatMetric = state.params.get('hm') || 'visits';
  const heat = useA('/heatmap', state, { metric: heatMetric });
  const { formatDateTime } = useTimezone();
  const d = v.data;

  return <>
    <div className="an-grid an-grid-2">
      <Panel help="new-vs-returning" title="New vs returning" eyebrow="How each group behaves in this period" query={v} empty={!d?.new?.visitors && !d?.returning?.visitors}>
        {d && (
          <table className="an-compare">
            <thead><tr><th /><th><i style={{ background: PALETTE[0] }} />New</th><th><i style={{ background: PALETTE[2] }} />Returning</th><th>Returning vs new</th></tr></thead>
            <tbody>{SEG_ROWS.map(([k, label, f]) => {
              const a = d.new[k], b = d.returning[k];
              const lift = a && b != null && !['visitors', 'visits'].includes(k) ? b / a : null;
              return <tr key={k}><th>{label}</th><td>{f(a)}</td><td>{f(b)}</td>
                <td>{lift == null ? '—' : <span className="an-lift" data-tone={lift >= 1 ? 'good' : 'bad'}>{lift >= 1 ? `${lift.toFixed(1)}× higher` : `${(1 / lift).toFixed(1)}× lower`}</span>}</td></tr>;
            })}</tbody>
          </table>
        )}
        {d && <p className="an-note">New = first seen in this period. Returning = first seen before it and back again. Rates are the share of each group who are identified, registered or bought (ever).</p>}
      </Panel>
      <Panel help="returning-visitors" title="Returning visitors over time" eyebrow={share ? 'Share of visitors' : 'Visitors'} query={ts} empty={!series.length}
        actions={<Segmented label="Scale" value={share ? 'share' : 'count'} onChange={x => update({ vs: x === 'share' ? 'share' : null })}
          options={[{ value: 'count', label: 'Count' }, { value: 'share', label: 'Share' }]} />}
        footer={<Legend items={[{ label: 'New', color: PALETTE[0] }, { label: 'Returning', color: PALETTE[2] }]} />}>
        <StackedChart data={series.map(x => ({ bucket: x.bucket, New: x.new_visitors, Returning: x.returning_visitors }))}
          keys={['New', 'Returning']} gran={gran} percent={share} colors={[PALETTE[0], PALETTE[2]]} />
      </Panel>
    </div>

    <div className="an-grid an-grid-3">
      <Panel help="frequency" title="Visits per visitor" eyebrow="Page views each person made in the period" query={v} empty={!d}>
        {d && <Histogram rows={d.frequency} label="visitors" />}
      </Panel>
      <Panel help="frequency" title="Days active" eyebrow="Different days each person visited" query={v} empty={!d}>
        {d && <Histogram rows={d.days_active} label="visitors" color={PALETTE[1]} />}
      </Panel>
      <Panel help="frequency" title="Sessions per visitor" eyebrow="Separate browsing sessions" query={v} empty={!d}>
        {d && <Histogram rows={d.sessions} label="visitors" color={PALETTE[3]} />}
      </Panel>
    </div>
    <div className="an-grid an-grid-2">
      <Panel help="time-to-return" title="Time to come back" eyebrow="Gap between a visitor's first and second visit (reloads under 30 min ignored)" query={v} empty={!d?.return_gap?.some(x => x.count)}>
        {d && <Histogram rows={d.return_gap} label="visitors" color={PALETTE[2]} />}
      </Panel>
      <Panel help="relationship-age" title="Relationship age of returning visitors" eyebrow="From first ever visit to latest visit" query={v} empty={!d?.loyalty_age?.some(x => x.count)}>
        {d && <Histogram rows={d.loyalty_age} label="visitors" color={PALETTE[4]} />}
      </Panel>
    </div>

    <Panel help="heatmap" title="When people visit" eyebrow="Weekday × hour" query={heat}
      actions={<Select label="Heatmap metric" value={heatMetric} onChange={x => update({ hm: x === 'visits' ? null : x })}
        options={[{ value: 'visits', label: 'Page views' }, { value: 'identified', label: 'Identifications' },
          { value: 'registrations', label: 'Registrations' }, { value: 'sales', label: 'Sales' }]} />}>
      {heat.data && <Heatmap days={heat.data.days} grid={heat.data.grid} label={heatMetric === 'visits' ? 'page views' : heatMetric} />}
    </Panel>

    <Panel help="identified" title="Most engaged known people" eyebrow="Identified visitors with the most page views in this period" query={v} empty={!d?.top?.length}>
      {d && <DataTable rows={d.top} rowKey={r => r.contact_id} onRowClick={r => onSelectContact?.(r.contact_id)}
        defaultSort={{ key: 'visits', dir: 'desc' }}
        columns={[
          { key: 'name', label: 'Person', render: r => <span className="an-page-cell"><strong>{r.name || r.email}</strong>{r.name && <small>{r.email}</small>}</span>, sortValue: r => r.name || r.email || '' },
          { key: 'source', label: 'Source', render: r => r.source || '—' },
          { key: 'status', label: 'Status', render: r => <Status tone={r.buyer ? 'green' : r.registered ? 'blue' : 'amber'}>{r.buyer ? 'Buyer' : r.registered ? 'Registered' : 'Abandoned'}</Status>,
            sortValue: r => (r.buyer ? 2 : r.registered ? 1 : 0) },
          { key: 'visits', label: 'Views', fmt: 'num' }, { key: 'days', label: 'Days', fmt: 'num' },
          { key: 'last', label: 'Last seen', render: r => formatDateTime(r.last), align: 'right' },
        ]} />}
    </Panel>
  </>;
}
