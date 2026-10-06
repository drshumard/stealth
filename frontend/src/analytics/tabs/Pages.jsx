import { useMemo } from 'react';
import { ArrowLeft, ExternalLink, Filter } from 'lucide-react';
import { PALETTE, fmtCompact, fmtDuration, fmtNum, fmtPct, useA } from '../lib';
import { BarList, DataTable, Legend, Panel, TrendChart } from '../charts';
import { useSeries } from './Overview';

const pageCell = r => (
  <span className="an-page-cell"><strong title={r.raw}>{r.raw}</strong>{r.title && <small title={r.title}>{r.title}</small>}</span>
);

export default function Pages({ state, update }) {
  const selected = state.params.get('pg');
  const q = useA('/pages', state, { limit: 200 });
  const rows = useMemo(() => q.data?.rows || [], [q.data]);
  const maxViews = Math.max(1, ...rows.map(r => r.views));

  const columns = [
    { key: 'raw', label: 'Page', render: pageCell, sortValue: r => r.raw, csv: r => r.raw },
    { key: 'views', label: 'Views', fmt: 'num', bar: maxViews },
    { key: 'visitors', label: 'Visitors', fmt: 'num' },
    { key: 'entries', label: 'Entries', fmt: 'num', hint: 'Sessions that started on this page' },
    { key: 'bounce_rate', label: 'Bounce', fmt: 'pct', hint: 'Sessions that started here and saw no other page' },
    { key: 'avg_session_seconds', label: 'Median session', fmt: 'dur', hint: 'Median length of multi-page sessions starting here' },
    { key: 'exits', label: 'Exits', fmt: 'num', hint: 'Multi-page sessions that ended here' },
    { key: 'identified', label: 'Identified', fmt: 'num', hint: 'Visitors who are identified leads' },
    { key: 'identification_rate', label: 'ID rate', fmt: 'pct' },
    { key: 'registered', label: 'Registered', fmt: 'num' },
    { key: 'abandoned', label: 'Abandoned', fmt: 'num' },
    { key: 'buyers', label: 'Buyers', fmt: 'num' },
  ];

  const entry = useMemo(() => [...rows].sort((a, b) => b.entries - a.entries).slice(0, 8), [rows]);
  const converters = useMemo(() => rows.filter(r => r.visitors >= 100).sort((a, b) => b.identification_rate - a.identification_rate).slice(0, 8), [rows]);

  if (selected) return <PageDetail state={state} update={update} page={selected} row={rows.find(r => r.raw === selected)} />;

  return <>
    <div className="an-grid an-grid-3">
      <Panel help="pages" title="Sites" eyebrow="Views by domain" query={q} empty={!q.data?.hosts?.length}>
        {q.data && <BarList rows={q.data.hosts} label="host" value="views" secondary={h => `${h.pages} pages`}
          onClick={h => update({ host: h.host })} />}
      </Panel>
      <Panel help="pages" title="Landing pages" eyebrow="Where sessions start" query={q} empty={!entry.length}>
        <BarList rows={entry} label="raw" value="entries" secondary={r => `${fmtPct(r.bounce_rate, 0)} bounce`} onClick={r => update({ pg: r.raw })} />
      </Panel>
      <Panel help="pages" title="Lead-generating pages" eyebrow="Visitors who became leads (100+ visitors)" query={q} empty={!converters.length}>
        <BarList rows={converters} label="raw" value="identification_rate" fmt={v => fmtPct(v)} tone="green"
          secondary={r => `${fmtCompact(r.identified)} of ${fmtCompact(r.visitors)}`} onClick={r => update({ pg: r.raw })} />
      </Panel>
    </div>
    <Panel help="pages" title="All pages" eyebrow={`${fmtNum(q.data?.total_rows)} pages · query strings removed, www. ignored`} query={q} empty={!rows.length}>
      <DataTable columns={columns} rows={rows} rowKey={r => r.raw} defaultSort={{ key: 'views', dir: 'desc' }} maxRows={25}
        onRowClick={r => update({ pg: r.raw })} exportName={`pages-${state.since}-${state.until}`} />
    </Panel>
  </>;
}

function PageDetail({ state, update, page, row }) {
  const { ts, gran, series, prevSeries } = useSeries(state, { page });
  const flow = useA('/pages/flow', state, { page, limit: 10 });
  const back = () => update({ pg: null });
  return <>
    <div className="an-detail-head">
      <button type="button" className="sp-back" onClick={back}><ArrowLeft size={16} /> All pages</button>
      <div className="an-detail-title">
        <span className="sp-eyebrow">Page</span><h2>{page}</h2>{row?.title && <p>{row.title}</p>}
      </div>
      <div className="an-detail-actions">
        <a className="sp-secondary-button an-small-button" href={`https://${page}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open page</a>
        <button type="button" className="sp-primary-button an-small-button" onClick={() => update({ page, pg: null, tab: 'overview' })}>
          <Filter size={13} /> Filter whole dashboard to this page</button>
      </div>
    </div>
    {row && (
      <div className="an-stat-strip">
        {[['Views', fmtNum(row.views)], ['Visitors', fmtNum(row.visitors)], ['Entries', fmtNum(row.entries)], ['Bounce', fmtPct(row.bounce_rate)],
          ['Median session', fmtDuration(row.avg_session_seconds)], ['Identified', `${fmtNum(row.identified)} · ${fmtPct(row.identification_rate)}`],
          ['Registered', fmtNum(row.registered)], ['Abandoned', fmtNum(row.abandoned)], ['Buyers', fmtNum(row.buyers)]].map(([l, v]) => (
          <div key={l}><span>{l}</span><strong>{v}</strong></div>
        ))}
      </div>
    )}
    <Panel help="pages" title="Visitors to this page" eyebrow={`by ${gran || '…'}`} query={ts} empty={!series.length}
      footer={<Legend items={[{ label: 'Visitors', color: PALETTE[0] }, { label: 'Identified that period (of these visitors)', color: PALETTE[1] },
        ...(state.compare ? [{ label: 'Previous period', color: '#8a98aa', dashed: true, faded: true }] : [])]} />}>
      <TrendChart data={series} prev={state.compare ? prevSeries : null} metrics={['visitors', 'identified']} gran={gran} />
    </Panel>
    <div className="an-grid an-grid-2">
      <Panel help="pages" title="Came from" eyebrow="The page viewed just before (same session)" query={flow} empty={!flow.data?.previous?.length}>
        {flow.data && <BarList rows={flow.data.previous} label="page" value="count" secondary={r => fmtPct(r.count / flow.data.views, 0)}
          onClick={r => !r.page.startsWith('(') && update({ pg: r.page })} />}
      </Panel>
      <Panel help="pages" title="Went next" eyebrow="The page viewed just after (same session)" query={flow} empty={!flow.data?.next?.length}>
        {flow.data && <BarList rows={flow.data.next} label="page" value="count" tone="green" secondary={r => fmtPct(r.count / flow.data.views, 0)}
          onClick={r => !r.page.startsWith('(') && update({ pg: r.page })} />}
      </Panel>
    </div>
  </>;
}
