import { useMemo } from 'react';
import { PALETTE, bucketLabel, fmtCompact, fmtNum, fmtPct, useA } from '../lib';
import { DataTable, Legend, Panel, Segmented, Select, StackedChart } from '../charts';

// Hourly — traffic per clock hour, split by a UTM field (ad, ad set, campaign…), with suspected bots flagged
// (backend/analytics.py /hourly).

const DIMS = [
  { value: 'content', label: 'Ad (utm_content)' }, { value: 'term', label: 'Ad set (utm_term)' },
  { value: 'campaign', label: 'Campaign' }, { value: 'source', label: 'Source' }, { value: 'medium', label: 'Medium' },
];
const MAX_DAYS = 31;
const TOP = 6;
const GRID_ROWS = 12;
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
const BOT_COLORS = [PALETTE[0], PALETTE[4]];

// Without suspected bots: take their views / visitors / sessions out of each row.
const human = r => ({ ...r, views: r.views - r.suspect_views, visitors: r.visitors - r.suspect_visitors, sessions: r.sessions - r.suspect_sessions });

export default function Hourly({ state, update }) {
  const dim = state.params.get('hd') || 'content';
  const exclude = state.params.get('hb') === 'exclude';
  const tooLong = state.days > MAX_DAYS;
  const q = useA('/hourly', state, { dimension: dim }, { enabled: !tooLong });
  const d = q.data;
  const label = DIMS.find(x => x.value === dim)?.label;
  const reasons = d?.bots?.rules ? {
    ip_burst: `${d.bots.rules.ip_burst}+ visitor IDs from one IP in an hour`,
    rapid: `${d.bots.rules.rapid}+ page views in an hour`,
    bot_ua: 'Browser says it is a bot / script',
  } : {};

  const v = useMemo(() => {
    if (!d) return null;
    const rows = d.rows.map(r => {
      const x = exclude ? human(r) : r;
      return { ...x, id: `${r.bucket}|${r.key}`, bot_share: r.visitors ? r.suspect_visitors / r.visitors : null };
    }).filter(r => r.views > 0);
    const totals = {};
    rows.forEach(r => { totals[r.key] = (totals[r.key] || 0) + r.visitors; });
    const ranked = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    const top = ranked.slice(0, TOP);
    const byBucket = Object.fromEntries(d.buckets.map(b => [b, { bucket: b, ...Object.fromEntries([...top, 'Other'].map(k => [k, 0])) }]));
    rows.forEach(r => { const s = byBucket[r.bucket]; if (s) s[top.includes(r.key) ? r.key : 'Other'] += r.visitors; });
    const hasOther = ranked.length > TOP;
    // hour of day × top values (visitors summed over the days of the period)
    const gridKeys = ranked.slice(0, GRID_ROWS);
    const grid = Object.fromEntries(gridKeys.map(k => [k, Array(24).fill(0)]));
    rows.forEach(r => { if (grid[r.key]) grid[r.key][Number(r.bucket.slice(11, 13))] += r.visitors; });
    const gridMax = Math.max(1, ...gridKeys.flatMap(k => grid[k]));
    const bots = d.buckets.map(b => ({ bucket: b, 'Likely human': 0, 'Suspected bot': 0 }));
    const botIdx = Object.fromEntries(d.buckets.map((b, i) => [b, i]));
    d.rows.forEach(r => {
      const s = bots[botIdx[r.bucket]];
      if (s) { s['Likely human'] += r.visitors - r.suspect_visitors; s['Suspected bot'] += r.suspect_visitors; }
    });
    return { rows, totals, top, series: Object.values(byBucket), keys: hasOther ? [...top, 'Other'] : top, gridKeys, grid, gridMax, bots };
  }, [d, exclude]);

  const filter = key => update({ [dim]: key });
  const tooLongMsg = `Hourly figures cover up to ${MAX_DAYS} days — pick a shorter period.`;
  const b = d?.bots;

  return <>
    <div className="an-toolbar">
      <Select label="Split by" value={dim} onChange={x => update({ hd: x === 'content' ? null : x })} options={DIMS} />
      <Segmented label="Suspected bots" value={exclude ? 'exclude' : 'all'} onChange={x => update({ hb: x === 'exclude' ? 'exclude' : null })}
        options={[{ value: 'all', label: 'All traffic' }, { value: 'exclude', label: 'Without suspected bots' }]} />
      <span className="an-note">Visitors are counted per hour: someone active in three different hours counts once in each. Click a row to filter to that {label?.toLowerCase()}.</span>
    </div>

    <Panel help="hourly" title={`Visitors by hour and ${label?.toLowerCase()}`} eyebrow={`Top ${TOP}${exclude ? ' · suspected bots removed' : ''}`}
      query={q} empty={tooLong ? tooLongMsg : !v?.rows.length}
      footer={v && <Legend items={v.keys.map((k, i) => ({ label: k, color: PALETTE[i] }))} />}>
      {v && <StackedChart data={v.series} keys={v.keys} gran="hour" kind="bar" height={280} />}
    </Panel>

    <Panel help="hourly" title={`${label} × hour of day`} eyebrow={`Top ${GRID_ROWS} · visitors summed over every day in the period`}
      query={q} empty={tooLong ? tooLongMsg : !v?.gridKeys.length}>
      {v && (
        <div className="an-table-scroll">
          <table className="an-cohort an-hourgrid">
            <thead><tr><th>{label}</th><th>Total</th>{HOURS.map(h => <th key={h}>{h.slice(0, 2)}</th>)}</tr></thead>
            <tbody>
              {v.gridKeys.map(k => (
                <tr key={k}>
                  <th><button type="button" className="an-key" title={k} onClick={() => filter(k)}>{k}</button></th>
                  <td>{fmtNum(v.totals[k])}</td>
                  {v.grid[k].map((n, h) => {
                    const a = (n / v.gridMax) ** 0.75;
                    return <td key={h} className="an-cohort-cell" style={{ '--a': a }} data-dark={a > 0.55 || undefined}
                      title={`${k} · ${HOURS[h]} — ${fmtNum(n)} visitors`}>{n ? fmtCompact(n) : ''}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>

    <div className="an-grid an-grid-2">
      <Panel help="bots" title="Suspected bots by hour"
        eyebrow={b ? `${fmtNum(b.suspect_visitors)} of ${fmtNum(b.visitors)} visitors (${fmtPct(b.visitors ? b.suspect_visitors / b.visitors : 0)})` : undefined}
        query={q} empty={tooLong ? tooLongMsg : !v?.rows.length}
        footer={b && <Legend items={[{ label: 'Likely human', color: BOT_COLORS[0] }, { label: 'Suspected bot', color: BOT_COLORS[1] }]} />}>
        {v && <StackedChart data={v.bots} keys={['Likely human', 'Suspected bot']} gran="hour" kind="bar" height={220} colors={BOT_COLORS} />}
        {b && <ul className="an-note an-bot-reasons">
          {Object.entries(reasons).map(([k, text]) => <li key={k}><strong>{fmtNum(b.by_reason[k])}</strong> {text}</li>)}
        </ul>}
      </Panel>
      <Panel help="bots" title="Where suspected bots come from" eyebrow={b ? `${fmtNum(b.ips.length)} IP addresses` : undefined}
        query={q} empty={tooLong ? tooLongMsg : !b?.ips.length && 'No suspected bots in this period.'}>
        {b && <DataTable rows={b.ips} rowKey={r => r.ip} defaultSort={{ key: 'visitors', dir: 'desc' }} maxRows={10}
          exportName={`suspected-bots-${state.since}-${state.until}`}
          columns={[
            { key: 'ip', label: 'IP address', render: r => <code>{r.ip}</code> },
            { key: 'visitors', label: 'Visitor IDs', fmt: 'num' },
            { key: 'views', label: 'Views', fmt: 'num' },
            { key: 'hours', label: 'Hours active', fmt: 'num' },
            { key: 'reasons', label: 'Why', render: r => r.reasons.map(x => reasons[x]).join('; '), csv: r => r.reasons.join(' ') },
            { key: 'top_key', label: `Mostly ${label?.toLowerCase()}`, render: r => <span className="an-key" title={r.top_key}>{r.top_key}</span> },
            { key: 'last', label: 'Last seen', render: r => bucketLabel(r.last, 'hour', true) },
          ]} />}
      </Panel>
    </div>

    <Panel help="hourly" title={`Every hour × ${label?.toLowerCase()}`} eyebrow={v ? `${fmtNum(v.rows.length)} rows` : undefined}
      query={q} empty={tooLong ? tooLongMsg : !v?.rows.length}>
      {v && <DataTable rows={v.rows} rowKey={r => r.id} defaultSort={{ key: 'bucket', dir: 'desc' }} maxRows={50}
        onRowClick={r => filter(r.key)} exportName={`hourly-${dim}-${state.since}-${state.until}`}
        columns={[
          { key: 'bucket', label: 'Hour', render: r => bucketLabel(r.bucket, 'hour', true), csv: r => r.bucket },
          { key: 'key', label, render: r => <strong className="an-key" title={r.key}>{r.key}</strong>, sortValue: r => String(r.key) },
          { key: 'views', label: 'Views', fmt: 'num' },
          { key: 'visitors', label: 'Visitors', fmt: 'num' },
          { key: 'sessions', label: 'Sessions', fmt: 'num' },
          { key: 'suspect_visitors', label: 'Suspected bots', fmt: 'num', hint: 'Visitors flagged by a bot rule in this hour' },
          { key: 'bot_share', label: 'Bot share', fmt: 'pct', hint: 'Suspected bots ÷ all visitors in this hour' },
        ]} />}
    </Panel>
  </>;
}
