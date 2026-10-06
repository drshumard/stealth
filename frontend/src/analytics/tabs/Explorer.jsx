import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FILTER_KEYS, FORMAT, PALETTE, fmtCompact, fmtNum, useA } from '../lib';
import { DataTable, Donut, Legend, Panel, Segmented, Select, StackedChart } from '../charts';

// Build-your-own report: pick what to count (people or page views), how to group it, which measures, and a chart.
// Every choice is in the URL, so a report can be saved as a view or shared as a link.
const BASES = [{ value: 'contacts', label: 'People (first seen in period)' }, { value: 'visits', label: 'Page views' }];
const DIMS = {
  contacts: [['source', 'Source'], ['medium', 'Medium'], ['campaign', 'Campaign'], ['content', 'Ad'], ['term', 'Ad set'], ['device', 'Device'],
    ['os', 'Operating system'], ['browser', 'Browser / app'], ['status', 'Lead status'], ['weekday', 'Weekday'], ['hour', 'Hour of day']],
  visits: [['page', 'Page'], ['host', 'Site'], ['title', 'Page title'], ['referrer', 'Referrer'], ['source', 'Source'], ['medium', 'Medium'],
    ['campaign', 'Campaign'], ['content', 'Ad'], ['term', 'Ad set'], ['weekday', 'Weekday'], ['hour', 'Hour of day']],
};
const MEASURES = {
  contacts: [['contacts', 'People', 'num'], ['identified', 'Identified', 'num'], ['identification_rate', 'ID rate', 'pct'],
    ['registered', 'Registered', 'num'], ['registration_rate', 'Reg. rate', 'pct'], ['abandoned', 'Abandoned', 'num'],
    ['abandon_rate', 'Abandon rate', 'pct'], ['anonymous', 'Anonymous', 'num'], ['buyers', 'Buyers', 'num'],
    ['purchase_rate', 'Purchase rate', 'pct'], ['revenue', 'Revenue', 'money'], ['revenue_per_contact', 'Revenue / person', 'money']],
  visits: [['views', 'Page views', 'num'], ['visitors', 'Visitors', 'num'], ['views_per_visitor', 'Views / visitor', 'num'],
    ['identified', 'Identified visitors', 'num'], ['identification_rate', 'ID rate', 'pct'], ['registered', 'Registered visitors', 'num'],
    ['registration_rate', 'Reg. rate (of visitors)', 'pct'], ['abandoned', 'Abandoned visitors', 'num'], ['abandon_rate', 'Abandon rate', 'pct'],
    ['buyers', 'Buyer visitors', 'num']],
};
const CHARTS = [{ value: 'bar', label: 'Bars' }, { value: 'pie', label: 'Donut' }, { value: 'trend', label: 'Over time' }, { value: 'table', label: 'Table' }];

export default function Explorer({ state, update }) {
  const base = state.params.get('xb') || 'contacts';
  const dims = DIMS[base];
  const dim = dims.some(([d]) => d === state.params.get('xd')) ? state.params.get('xd') : dims[0][0];
  const measures = MEASURES[base];
  const picked = (state.params.get('xm') || '').split(',').filter(m => measures.some(([k]) => k === m));
  const metrics = picked.length ? picked : base === 'contacts' ? ['contacts', 'registration_rate', 'revenue'] : ['visitors', 'identification_rate'];
  const chart = state.params.get('xc') || 'bar';
  const top = Number(state.params.get('xn') || 15);
  const minSize = Number(state.params.get('xmin') || 0);
  const primary = metrics[0];
  const sizeKey = base === 'contacts' ? 'contacts' : 'visitors';

  const q = useA('/breakdown', state, { dimension: dim, base, limit: 500, sort: primary, min_size: minSize });
  const trendMetric = base === 'visits' ? (['views', 'visitors'].includes(primary) ? (primary === 'views' ? 'visits' : 'visitors') : 'visitors')
    : (['contacts', 'identified', 'registered', 'abandoned'].includes(primary) ? primary : 'contacts');
  const trend = useA('/breakdown/trend', state, { dimension: dim, base, metric: trendMetric, top: Math.min(top, 8), granularity: state.gran },
    { enabled: chart === 'trend' });

  const rows = useMemo(() => {
    const all = q.data?.rows || [];
    if (['weekday', 'hour'].includes(dim)) return all;
    return [...all].sort((a, b) => (b[primary] ?? -1) - (a[primary] ?? -1));
  }, [q.data, primary, dim]);
  const shown = rows.slice(0, top);
  const fmtOf = k => FORMAT[measures.find(([m]) => m === k)?.[2]] || fmtNum;
  const labelOf = k => measures.find(([m]) => m === k)?.[1];
  const toggle = m => {
    const next = metrics.includes(m) ? metrics.filter(x => x !== m) : [...metrics, m];
    update({ xm: next.length ? next.join(',') : null });
  };

  return <>
    <section className="sp-surface an-builder">
      <div className="an-builder-row">
        <label><span>Count</span><Select label="Count" value={base} onChange={v => update({ xb: v === 'contacts' ? null : v, xd: null, xm: null })} options={BASES} /></label>
        <label><span>Group by</span><Select label="Group by" value={dim} onChange={v => update({ xd: v })} options={dims.map(([v, l]) => ({ value: v, label: l }))} /></label>
        <label><span>Show</span><Select label="Rows" value={String(top)} onChange={v => update({ xn: v === '15' ? null : v })}
          options={[5, 10, 15, 25, 50, 100].map(n => ({ value: String(n), label: `Top ${n}` }))} /></label>
        <label><span>Ignore groups under</span><Select label="Minimum size" value={String(minSize)} onChange={v => update({ xmin: v === '0' ? null : v })}
          options={[0, 10, 50, 100, 500, 1000].map(n => ({ value: String(n), label: n ? `${n} ${base === 'contacts' ? 'people' : 'visitors'}` : 'No minimum' }))} /></label>
        <label><span>Chart</span><Segmented label="Chart" value={chart} onChange={v => update({ xc: v === 'bar' ? null : v })} options={CHARTS} /></label>
      </div>
      <div className="an-builder-measures">
        <span>Measures</span>
        {measures.map(([k, l]) => <button key={k} type="button" aria-pressed={metrics.includes(k)} onClick={() => toggle(k)}>{l}</button>)}
        <small>The first one drives the chart and sort.</small>
      </div>
    </section>

    <Panel help="report-builder" title={`${labelOf(primary)} by ${dims.find(([d]) => d === dim)?.[1].toLowerCase()}`}
      eyebrow={`${base === 'contacts' ? 'People first seen in the period' : 'Page views in the period'} · ${fmtNum(q.data?.total_rows)} groups`}
      query={chart === 'trend' ? trend : q} empty={chart === 'trend' ? !trend.data?.series?.length : !shown.length}
      footer={chart === 'trend' && trend.data && <Legend items={trend.data.keys.map((k, i) => ({ label: k, color: PALETTE[i] }))} />}>
      {chart === 'bar' && (
        <ResponsiveContainer width="100%" height={Math.max(220, shown.length * 26 + 40)}>
          <BarChart data={shown.map(r => ({ ...r, label: String(r.key) }))} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="#edf1f6" horizontal={false} />
            <XAxis type="number" tickFormatter={v => (fmtOf(primary) === FORMAT.pct ? FORMAT.pct(v, 0) : fmtCompact(v))} stroke="#c9d3e1" tick={{ fill: '#8a98aa', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={210} tick={{ fill: '#44546c', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => (v.length > 32 ? `${v.slice(0, 31)}…` : v)} />
            <Tooltip formatter={v => fmtOf(primary)(v)} cursor={{ fill: 'rgba(49,95,209,.05)' }} />
            <Bar dataKey={primary} name={labelOf(primary)} fill={PALETTE[0]} radius={[0, 3, 3, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {chart === 'pie' && <Donut rows={shown.map(r => ({ ...r, key: String(r.key) }))} valueKey={fmtOf(primary) === FORMAT.pct ? sizeKey : primary} labelKey="key"
        fmt={fmtOf(fmtOf(primary) === FORMAT.pct ? sizeKey : primary)} height={240} centerLabel={labelOf(fmtOf(primary) === FORMAT.pct ? sizeKey : primary)} />}
      {chart === 'trend' && trend.data && <StackedChart data={trend.data.series} keys={trend.data.keys} gran={trend.data.granularity} height={300} />}
      {chart !== 'table' && <div className="an-spacer" />}
      <DataTable rows={rows} rowKey={r => String(r.raw)} maxRows={top} defaultSort={{ key: primary, dir: 'desc' }}
        exportName={`report-${base}-${dim}-${state.since}-${state.until}`}
        onRowClick={FILTER_KEYS.includes(dim) ? r => update({ [dim]: String(r.raw) }) : undefined}
        columns={[{ key: 'key', label: dims.find(([d]) => d === dim)?.[1], render: r => <strong className="an-key" title={r.key}>{r.key}</strong>, sortValue: r => String(r.key) },
          ...metrics.map(k => ({ key: k, label: labelOf(k), fmt: measures.find(([m]) => m === k)[2] }))]} />
      {chart === 'trend' && !['contacts', 'identified', 'registered', 'abandoned', 'visitors', 'views'].includes(primary) &&
        <p className="an-note">Over time shows {base === 'contacts' ? 'people' : 'visitors'} per group (rates and revenue can’t be stacked).</p>}
    </Panel>
  </>;
}
