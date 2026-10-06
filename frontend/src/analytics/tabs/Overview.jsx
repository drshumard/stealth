import { useMemo } from 'react';
import { METRICS, PALETTE, fmtNum, fmtPct, useA } from '../lib';
import { BarList, Donut, Funnel, Heatmap, Kpi, Legend, Panel, Segmented, Select, StackedChart, TrendChart } from '../charts';

const KPIS = ['visitors', 'new_visitors', 'returning_visitors', 'visits', 'identified', 'abandoned', 'registrations', 'sales',
  'revenue', 'identification_rate', 'registration_rate', 'bounce_rate', 'pages_per_session', 'avg_session_seconds'];

// Rates per bucket, so they can be charted like counts.
export function enrich(series = []) {
  return series.map(d => ({
    ...d,
    identification_rate: d.visitors ? d.identified / d.visitors : null,
    registration_rate: d.identified ? (d.identified - d.abandoned) / d.identified : null,
    purchase_rate: d.registrations ? d.sales / d.registrations : null,
  }));
}

export function useSeries(state, extra = {}) {
  const ts = useA('/timeseries', state, { granularity: state.gran, ...extra });
  const gran = ts.data?.granularity;
  const prev = useA('/timeseries', state, { granularity: gran, ...extra }, { range: state.prev, enabled: state.compare && !!gran });
  return { ts, prev, gran, series: useMemo(() => enrich(ts.data?.series), [ts.data]), prevSeries: useMemo(() => enrich(prev.data?.series), [prev.data]) };
}

export default function Overview({ state, update, drill }) {
  const ov = useA('/overview', state);
  const { ts, gran, series, prevSeries } = useSeries(state);
  const funnel = useA('/funnel', state);
  const heatMetric = state.params.get('hm') || 'visits';
  const heat = useA('/heatmap', state, { metric: heatMetric });
  const sources = useA('/breakdown', state, { dimension: 'source', base: 'contacts', limit: 12 });
  const devices = useA('/breakdown', state, { dimension: 'device', base: 'contacts' });
  const pages = useA('/breakdown', state, { dimension: 'page', base: 'visits', limit: 8, sort: 'visitors' });

  const selected = (state.params.get('m') || 'visitors,identified').split(',').filter(m => METRICS[m]).slice(0, 3);
  const kind = state.params.get('ck') || 'area';
  const toggle = m => {
    const next = selected.includes(m) ? selected.filter(x => x !== m) : [...selected, m].slice(-3);
    update({ m: next.length ? next.join(',') : null });
  };
  const cur = ov.data?.current || {};
  const prv = ov.data?.previous || {};
  const sparkMetric = m => (series[0] && m in series[0] ? m : null);

  return <>
    <div className="an-kpis">
      {KPIS.map(m => (
        <Kpi key={m} metric={m} cur={cur[m]} prev={prv[m]} compare={state.compare && !!ov.data} active={selected.includes(m)}
          onClick={() => toggle(m)} series={sparkMetric(m) ? series : null} />
      ))}
    </div>

    <Panel title="Trend" eyebrow={`${METRICS[selected[0]]?.label || ''}${selected.length > 1 ? ` + ${selected.length - 1} more` : ''} · by ${gran || '…'}`}
      query={ts} empty={!series.length}
      actions={<Segmented label="Chart type" value={kind} onChange={v => update({ ck: v === 'area' ? null : v })}
        options={[{ value: 'area', label: 'Area' }, { value: 'line', label: 'Line' }, { value: 'bar', label: 'Bars' }]} />}
      footer={<><Legend items={[...selected.map((m, i) => ({ label: METRICS[m].label, color: PALETTE[i] })),
        ...(state.compare ? [{ label: 'Previous period', color: '#8a98aa', dashed: true, faded: true }] : [])]} />
        <small>Click any card above to chart it (up to three).</small></>}>
      <TrendChart data={series} prev={state.compare ? prevSeries : null} metrics={selected.length ? selected : ['visitors']} kind={kind} gran={gran} />
    </Panel>

    <div className="an-grid an-grid-2">
      <Panel title="New vs returning visitors" eyebrow="Who came" query={ts} empty={!series.length}
        footer={<Legend items={[{ label: 'New (first seen that period)', color: PALETTE[0] }, { label: 'Returning', color: PALETTE[2] }]} />}>
        <StackedChart data={series.map(d => ({ bucket: d.bucket, New: d.new_visitors, Returning: d.returning_visitors }))}
          keys={['New', 'Returning']} gran={gran} kind="bar" colors={[PALETTE[0], PALETTE[2]]} />
      </Panel>
      <Panel title="Journey" eyebrow="People first seen in this period" query={funnel} empty={!funnel.data?.steps?.[0]?.count}
        footer={funnel.data && <small>{fmtNum(funnel.data.abandoned)} identified but never registered · ${fmtNum(funnel.data.revenue)} lifetime revenue from this group</small>}>
        {funnel.data && <Funnel steps={funnel.data.steps} />}
      </Panel>
    </div>

    <div className="an-grid an-grid-2">
      <Panel title="Lead outcomes" eyebrow="Identified leads, by when they were identified" query={ts} empty={!series.length}
        footer={<Legend items={[{ label: 'Registered', color: PALETTE[1] }, { label: 'Abandoned (no registration)', color: PALETTE[4] }]} />}
        actions={<button type="button" className="sp-clear" onClick={() => update({ tab: 'leads' })}>Abandonment analysis →</button>}>
        <StackedChart data={series.map(d => ({ bucket: d.bucket, Registered: Math.max(0, d.identified - d.abandoned), Abandoned: d.abandoned }))}
          keys={['Registered', 'Abandoned']} gran={gran} kind="bar" colors={[PALETTE[1], PALETTE[4]]} />
      </Panel>
      <Panel title="When it happens" eyebrow="Weekday × hour" query={heat}
        actions={<Select label="Heatmap metric" value={heatMetric} onChange={v => update({ hm: v === 'visits' ? null : v })}
          options={[{ value: 'visits', label: 'Page views' }, { value: 'identified', label: 'Identifications' },
            { value: 'registrations', label: 'Registrations' }, { value: 'sales', label: 'Sales' }]} />}>
        {heat.data && <Heatmap days={heat.data.days} grid={heat.data.grid} label={{ visits: 'page views', identified: 'identifications', registrations: 'registrations', sales: 'sales' }[heatMetric]} />}
      </Panel>
    </div>

    <div className="an-grid an-grid-3">
      <Panel title="Sources" eyebrow="New people by UTM source" query={sources} empty={!sources.data?.rows?.length}
        actions={<button type="button" className="sp-clear" onClick={() => update({ tab: 'attribution' })}>Attribution →</button>}>
        {sources.data && <Donut rows={sources.data.rows} valueKey="contacts" labelKey="key" centerLabel="people" />}
      </Panel>
      <Panel title="Devices" eyebrow="New people by device" query={devices} empty={!devices.data?.rows?.length}>
        {devices.data && <Donut rows={devices.data.rows} valueKey="contacts" labelKey="key" centerLabel="people" />}
      </Panel>
      <Panel title="Top pages" eyebrow="By visitors" query={pages} empty={!pages.data?.rows?.length}
        actions={<button type="button" className="sp-clear" onClick={() => update({ tab: 'pages' })}>All pages →</button>}>
        {pages.data && <BarList rows={pages.data.rows} value="visitors" secondary={r => fmtPct(r.identification_rate)}
          onClick={r => drill({ tab: 'pages', pg: r.raw })} />}
      </Panel>
    </div>
  </>;
}
