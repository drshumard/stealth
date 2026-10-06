import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import { AlertTriangle, ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight, ChevronDown, Download, Loader2, Minus } from 'lucide-react';
import { FORMAT, METRICS, PALETTE, bucketLabel, delta, fmtCompact, fmtMetric, fmtNum, fmtPct } from './lib';

// Charts and panels for the analytics workspace — recharts, styled to the workspace.

const AXIS = { stroke: '#c9d3e1', tick: { fill: '#8a98aa', fontSize: 11 }, tickLine: false, axisLine: false };
const GRID = <CartesianGrid stroke="#edf1f6" vertical={false} />;

// ── frame: title, actions, loading / error / empty ──
export function Panel({ title, eyebrow, actions, children, query, empty, className = '', footer, span }) {
  const loading = query?.isLoading;
  const error = query?.isError && !query?.data;
  return (
    <section className={`sp-surface an-panel ${className}`} data-span={span}>
      {(title || actions) && (
        <div className="an-panel-head">
          <div>{eyebrow && <span className="sp-eyebrow">{eyebrow}</span>}{title && <h2>{title}</h2>}</div>
          <div className="an-panel-actions">
            {query?.isFetching && !loading && <Loader2 size={14} className="sp-spin an-refreshing" aria-label="Updating" />}
            {actions}
          </div>
        </div>
      )}
      <div className="an-panel-body">
        {loading ? <PanelLoading /> : error ? (
          <div className="an-state an-error"><AlertTriangle size={18} /><span>{query.error?.message || 'Could not load this panel.'}</span>
            <button type="button" className="sp-secondary-button" onClick={() => query.refetch()}>Try again</button></div>
        ) : empty ? <div className="an-state">{empty === true ? 'No data for this period and filters.' : empty}</div> : children}
      </div>
      {footer && <div className="an-panel-foot">{footer}</div>}
    </section>
  );
}

export function PanelLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 3500); return () => clearTimeout(t); }, []);
  return <div className="an-state an-loading"><span className="sp-skeleton" /><span className="sp-skeleton" /><span className="sp-skeleton" />
    {slow && <small>Crunching the full visit history — this view takes a few seconds the first time.</small>}</div>;
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="an-segmented" role="radiogroup" aria-label={label}>
      {options.map(o => <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

export function Select({ value, onChange, options, label, className = '' }) {
  return (
    <label className={`sp-select-wrap an-select ${className}`}><span className="sr-only">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select><ChevronDown size={14} aria-hidden="true" /></label>
  );
}

export function Delta({ cur, prev, good = 'up', compact }) {
  const d = delta(cur, prev);
  if (d == null) return <span className="an-delta" data-tone="quiet">{compact ? '' : 'no comparison'}</span>;
  const up = d > 0.0005, down = d < -0.0005;
  const tone = !up && !down ? 'quiet' : (up === (good === 'up') ? 'good' : 'bad');
  const Icon = up ? (compact ? ArrowUp : ArrowUpRight) : down ? (compact ? ArrowDown : ArrowDownRight) : Minus;
  return <span className="an-delta" data-tone={tone}><Icon size={12} />{Math.abs(d) >= 10 ? '>999%' : fmtPct(Math.abs(d), Math.abs(d) < 0.1 ? 1 : 0)}</span>;
}

// ── tooltip ──
function Tip({ active, payload, label, gran, fmt, labelFmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="an-tip">
      <strong>{labelFmt ? labelFmt(label) : gran ? bucketLabel(label, gran, true) : label}</strong>
      {payload.filter(p => p.value != null).map(p => (
        <div key={p.dataKey + (p.name || '')}><i style={{ background: p.color || p.stroke || p.fill }} /><span>{p.name}</span>
          <b>{(p.payload?.__fmt?.[p.dataKey] || fmt?.[p.dataKey] || fmtNum)(p.value)}</b></div>
      ))}
    </div>
  );
}

// ── KPI card with sparkline ──
export function Kpi({ metric, cur, prev, series, active, onClick, compare }) {
  const m = METRICS[metric];
  return (
    <button type="button" className="an-kpi" aria-pressed={!!active} onClick={onClick}>
      <span className="an-kpi-label">{m.label}</span>
      <strong>{fmtMetric(metric, cur)}</strong>
      <span className="an-kpi-foot">{compare ? <><Delta cur={cur} prev={prev} good={m.good} /><small>vs {fmtMetric(metric, prev)}</small></> : <small>&nbsp;</small>}</span>
      {series?.length > 1 && (
        <span className="an-spark" aria-hidden="true">
          <ResponsiveContainer width="100%" height={34}>
            <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs><linearGradient id={`sp-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={active ? '#315fd1' : '#9fb4e6'} stopOpacity={0.35} /><stop offset="1" stopColor="#fff" stopOpacity={0} /></linearGradient></defs>
              <Area dataKey={metric} type="monotone" stroke={active ? '#315fd1' : '#9fb4e6'} strokeWidth={1.5} fill={`url(#sp-${metric})`} isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </span>
      )}
    </button>
  );
}

// ── main time-series chart: up to 3 metrics, optional previous period (dashed) ──
export function TrendChart({ data, prev, metrics, kind = 'area', gran, height = 300 }) {
  const rows = useMemo(() => data.map((d, i) => {
    const r = { ...d };
    metrics.forEach(m => { if (prev?.[i]) r[`prev_${m}`] = prev[i][m]; });
    return r;
  }), [data, prev, metrics]);
  const fmts = {};
  metrics.forEach(m => { fmts[m] = FORMAT[METRICS[m]?.fmt] || fmtNum; fmts[`prev_${m}`] = fmts[m]; });
  const leftFmt = METRICS[metrics[0]]?.fmt;
  const peak = m => Math.max(0, ...data.map(d => d[m] || 0));
  // A metric in another unit, or more than ~8× smaller than the first, gets the right-hand axis so it isn't flattened.
  const axisOf = m => (m === metrics[0] || (METRICS[m]?.fmt === leftFmt && peak(m) * 8 >= peak(metrics[0])) ? 'left' : 'right');
  const needsRight = metrics.some(m => axisOf(m) === 'right');
  const tick = v => (leftFmt === 'pct' ? fmtPct(v, 0) : leftFmt === 'money' ? `$${fmtCompact(v)}` : fmtCompact(v));
  const rightFmt = METRICS[metrics.find(m => axisOf(m) === 'right')]?.fmt;   // first right-axis metric sets its format
  const rtick = v => (rightFmt === 'pct' ? fmtPct(v, 0) : rightFmt === 'money' ? `$${fmtCompact(v)}` : fmtCompact(v));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 10, right: needsRight ? 4 : 12, bottom: 0, left: 0 }}>
        <defs>{metrics.map((m, i) => (
          <linearGradient key={m} id={`g-${m}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PALETTE[i]} stopOpacity={0.28} /><stop offset="1" stopColor={PALETTE[i]} stopOpacity={0.02} />
          </linearGradient>))}</defs>
        {GRID}
        <XAxis dataKey="bucket" {...AXIS} tickFormatter={k => bucketLabel(k, gran)} minTickGap={24} />
        <YAxis yAxisId="left" {...AXIS} width={52} tickFormatter={tick} />
        {needsRight && <YAxis yAxisId="right" orientation="right" {...AXIS} width={52} tickFormatter={rtick} />}
        <Tooltip content={<Tip gran={gran} fmt={fmts} />} cursor={{ stroke: '#c9d3e1', strokeDasharray: '3 3' }} />
        {prev && metrics.map((m, i) => (
          <Line key={`p-${m}`} yAxisId={axisOf(m)} dataKey={`prev_${m}`} name={`${METRICS[m].label} (previous)`} type="monotone"
            stroke={PALETTE[i]} strokeOpacity={0.45} strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        ))}
        {metrics.map((m, i) => (kind === 'bar'
          ? <Bar key={m} yAxisId={axisOf(m)} dataKey={m} name={METRICS[m].label} fill={PALETTE[i]} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          : kind === 'line'
            ? <Line key={m} yAxisId={axisOf(m)} dataKey={m} name={METRICS[m].label} type="monotone" stroke={PALETTE[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            : <Area key={m} yAxisId={axisOf(m)} dataKey={m} name={METRICS[m].label} type="monotone" stroke={PALETTE[i]} strokeWidth={2} fill={`url(#g-${m})`} activeDot={{ r: 4 }} isAnimationActive={false} />))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── stacked series (new vs returning, top-N breakdown over time) ──
export function StackedChart({ data, keys, gran, kind = 'area', percent = false, height = 260, fmt = fmtNum, colors }) {
  const rows = useMemo(() => (percent ? data.map(d => {
    const total = keys.reduce((s, k) => s + (d[k] || 0), 0);
    return { ...d, ...Object.fromEntries(keys.map(k => [k, total ? (d[k] || 0) / total : 0])) };
  }) : data), [data, keys, percent]);
  const f = percent ? v => fmtPct(v, 0) : fmt;
  const fmts = Object.fromEntries(keys.map(k => [k, f]));
  const Chart = kind === 'bar' ? BarChart : AreaChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }} stackOffset={percent ? 'expand' : undefined}>
        {GRID}
        <XAxis dataKey="bucket" {...AXIS} tickFormatter={k => bucketLabel(k, gran)} minTickGap={24} />
        <YAxis {...AXIS} width={48} tickFormatter={v => (percent ? fmtPct(v, 0) : fmtCompact(v))} />
        <Tooltip content={<Tip gran={gran} fmt={fmts} />} cursor={{ fill: 'rgba(49,95,209,.05)' }} />
        {keys.map((k, i) => (kind === 'bar'
          ? <Bar key={k} dataKey={k} name={k} stackId="s" fill={(colors || PALETTE)[i % 10]} maxBarSize={30} isAnimationActive={false} />
          : <Area key={k} dataKey={k} name={k} stackId="s" type="monotone" stroke={(colors || PALETTE)[i % 10]} fill={(colors || PALETTE)[i % 10]} fillOpacity={0.55} isAnimationActive={false} />))}
      </Chart>
    </ResponsiveContainer>
  );
}

export function Legend({ items }) {
  return <div className="an-legend">{items.map((it, i) => <span key={it.label}><i style={{ background: it.color || PALETTE[i % 10], opacity: it.faded ? 0.45 : 1 }} data-dashed={it.dashed || undefined} />{it.label}</span>)}</div>;
}

// ── donut with a ranked legend ──
export function Donut({ rows, valueKey = 'value', labelKey = 'label', fmt = fmtNum, height = 180, centerLabel }) {
  const total = rows.reduce((s, r) => s + (r[valueKey] || 0), 0);
  const top = rows.slice(0, 6);
  const rest = rows.slice(6).reduce((s, r) => s + (r[valueKey] || 0), 0);
  const data = rest ? [...top, { [labelKey]: 'Other', [valueKey]: rest }] : top;
  return (
    <div className="an-donut">
      <div className="an-donut-chart">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={labelKey} innerRadius="62%" outerRadius="92%" paddingAngle={1.5} stroke="none" isAnimationActive={false}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % 10]} />)}
            </Pie>
            <Tooltip content={<Tip labelFmt={() => ''} fmt={{ [valueKey]: fmt }} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="an-donut-center"><strong>{fmtCompact(total)}</strong><small>{centerLabel}</small></div>
      </div>
      <ul className="an-donut-legend">
        {data.map((r, i) => (
          <li key={r[labelKey]}><i style={{ background: PALETTE[i % 10] }} /><span title={r[labelKey]}>{r[labelKey]}</span>
            <b>{fmt(r[valueKey])}</b><small>{fmtPct(total ? r[valueKey] / total : 0, 0)}</small></li>
        ))}
      </ul>
    </div>
  );
}

// ── ranked horizontal bars (HTML, so long labels stay readable) ──
export function BarList({ rows, label = 'key', value, fmt = fmtNum, secondary, onClick, max: maxIn, tone }) {
  const max = maxIn || Math.max(1, ...rows.map(r => r[value] || 0));
  return (
    <ol className="an-barlist">
      {rows.map(r => {
        const Tag = onClick ? 'button' : 'div';
        return (
          <li key={r[label]}>
            <Tag type={onClick ? 'button' : undefined} className="an-barlist-row" onClick={onClick ? () => onClick(r) : undefined}>
              <span className="an-barlist-fill" data-tone={tone} style={{ width: `${Math.max(0.5, ((r[value] || 0) / max) * 100)}%` }} />
              <span className="an-barlist-label" title={r[label]}>{r[label]}</span>
              <span className="an-barlist-value">{fmt(r[value])}{secondary && <small>{secondary(r)}</small>}</span>
            </Tag>
          </li>
        );
      })}
    </ol>
  );
}

// ── histogram ──
export function Histogram({ rows, height = 200, color = PALETTE[0], fmt = fmtNum, label = 'count', xLabel }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const data = rows.map(r => ({ ...r, share: total ? r.count / total : 0 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
        {GRID}
        <XAxis dataKey="bucket" {...AXIS} interval={0} tick={{ fill: '#8a98aa', fontSize: 10.5 }} label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -2, fill: '#a0abba', fontSize: 10 } : undefined} />
        <YAxis {...AXIS} width={44} tickFormatter={fmtCompact} />
        <Tooltip content={<Tip labelFmt={l => l} fmt={{ count: fmt, share: v => fmtPct(v) }} />} cursor={{ fill: 'rgba(49,95,209,.05)' }} />
        <Bar dataKey="count" name={label} fill={color} radius={[3, 3, 0, 0]} maxBarSize={56} isAnimationActive={false}
          label={{ position: 'top', fill: '#7a8aa0', fontSize: 10, formatter: v => (total ? fmtPct(v / total, 0) : '') }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── weekday × hour heatmap ──
export function Heatmap({ days, grid, fmt = fmtNum, label = 'visits' }) {
  const max = Math.max(1, ...grid.flat());
  const rowTotals = grid.map(r => r.reduce((s, v) => s + v, 0));
  const colTotals = grid[0].map((_, h) => grid.reduce((s, r) => s + r[h], 0));
  const peak = grid.flatMap((r, d) => r.map((v, h) => ({ v, d, h }))).sort((a, b) => b.v - a.v)[0];
  return (
    <div className="an-heat-wrap">
      <div className="an-heat" role="img" aria-label={`${label} by weekday and hour; busiest ${days[peak.d]} ${peak.h}:00`}>
        <span />
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="an-heat-hour">{h % 3 === 0 ? `${String(h).padStart(2, '0')}` : ''}</span>)}
        <span className="an-heat-total">Total</span>
        {grid.map((row, d) => [
          <span key={`d${d}`} className="an-heat-day">{days[d]}</span>,
          ...row.map((v, h) => (
            <span key={`${d}-${h}`} className="an-heat-cell" style={{ '--a': (v / max) ** 0.75 }} title={`${days[d]} ${String(h).padStart(2, '0')}:00 — ${fmt(v)} ${label}`} />
          )),
          <span key={`t${d}`} className="an-heat-total">{fmtCompact(rowTotals[d])}</span>,
        ])}
        <span />
        {colTotals.map((v, h) => <span key={`c${h}`} className="an-heat-col" style={{ '--h': v / Math.max(1, ...colTotals) }} title={`${String(h).padStart(2, '0')}:00 — ${fmt(v)}`} />)}
        <span />
      </div>
      <p className="an-note">Busiest: <strong>{days[peak.d]} {String(peak.h).padStart(2, '0')}:00</strong> ({fmt(peak.v)} {label}). Times in your display timezone.</p>
    </div>
  );
}

// ── funnel ──
export function Funnel({ steps, fmt = fmtNum }) {
  const top = steps[0]?.count || 1;
  return (
    <ol className="an-funnel">
      {steps.map((s, i) => (
        <li key={s.step}>
          <div className="an-funnel-label"><span>{String(i + 1).padStart(2, '0')}</span><strong>{s.step}</strong></div>
          <div className="an-funnel-bar"><span style={{ width: `${Math.max(0.6, (s.count / top) * 100)}%` }} data-step={i} /></div>
          <div className="an-funnel-figures"><b>{fmt(s.count)}</b><small>{fmtPct(s.of_total)} of all</small>
            {i > 0 && <em data-tone={s.of_previous >= 0.5 ? 'good' : s.of_previous >= 0.1 ? 'mid' : 'bad'}>{fmtPct(s.of_previous)} of previous</em>}</div>
        </li>
      ))}
    </ol>
  );
}

// ── cohort retention matrix ──
export function CohortMatrix({ rows, period }) {
  const cols = Math.max(...rows.map(r => r.retention.length));
  return (
    <div className="an-table-scroll">
      <table className="an-cohort">
        <thead><tr><th>Cohort</th><th>People</th><th>Identified</th><th>Registered</th><th>Bought</th><th>Revenue</th>
          {Array.from({ length: cols }, (_, i) => <th key={i}>{i === 0 ? (period === 'week' ? 'Week 0' : 'Month 0') : `+${i}`}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.cohort}>
              <th>{bucketLabel(r.cohort, period, true)}</th><td>{fmtNum(r.size)}</td>
              <td>{fmtPct(r.identified)}</td><td>{fmtPct(r.registered)}</td><td>{fmtPct(r.buyers, 2)}</td><td>${fmtCompact(r.revenue)}</td>
              {Array.from({ length: cols }, (_, i) => {
                const v = r.retention[i];
                return <td key={i} className="an-cohort-cell" style={v != null && i > 0 ? { '--a': Math.min(1, v / 0.06) } : undefined}
                  data-first={i === 0 || undefined}>{v == null ? '' : i === 0 ? '100%' : fmtPct(v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── bubble: volume vs conversion ──
export function Bubble({ rows, x, y, z, label = 'key', xLabel, yLabel, zLabel, xFmt = fmtNum, yFmt = fmtPct, zFmt = fmtNum, height = 300, onClick }) {
  const data = rows.filter(r => r[x] != null && r[y] != null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 16, bottom: 18, left: 0 }}>
        <CartesianGrid stroke="#edf1f6" />
        <XAxis type="number" dataKey={x} name={xLabel} {...AXIS} scale="log" domain={['auto', 'auto']} tickFormatter={fmtCompact}
          label={{ value: `${xLabel} (log scale)`, position: 'insideBottom', offset: -10, fill: '#a0abba', fontSize: 10 }} allowDataOverflow />
        <YAxis type="number" dataKey={y} name={yLabel} {...AXIS} width={52} tickFormatter={v => yFmt(v)} />
        <ZAxis type="number" dataKey={z} range={[40, 900]} name={zLabel} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const r = payload[0].payload;
          return <div className="an-tip"><strong>{r[label]}</strong>
            <div><span>{xLabel}</span><b>{xFmt(r[x])}</b></div><div><span>{yLabel}</span><b>{yFmt(r[y])}</b></div>
            <div><span>{zLabel}</span><b>{zFmt(r[z])}</b></div></div>;
        }} />
        <Scatter data={data} fill="#315fd1" fillOpacity={0.55} stroke="#2453bd" isAnimationActive={false} onClick={onClick ? p => onClick(p.payload || p) : undefined} cursor={onClick ? 'pointer' : undefined} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ── sortable data table ──
export function DataTable({ columns, rows, defaultSort, onRowClick, rowKey = r => r.key, maxRows, exportName }) {
  const [sort, setSort] = useState(defaultSort || { key: columns[1]?.key, dir: 'desc' });
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === sort.key);
    if (!col) return rows;
    const val = r => (col.sortValue ? col.sortValue(r) : r[col.key]);
    return [...rows].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      const c = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sort.dir === 'asc' ? c : -c;
    });
  }, [rows, sort, columns]);
  const shown = maxRows && !showAll ? sorted.slice(0, maxRows) : sorted;
  return (
    <div className="an-datatable">
      <div className="an-table-scroll">
        <table>
          <thead><tr>{columns.map(c => (
            <th key={c.key} data-align={c.align || (c.fmt ? 'right' : 'left')} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))} title={c.hint}>
                {c.label}{sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
              </button>
            </th>))}</tr></thead>
          <tbody>
            {shown.map(r => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} data-clickable={!!onRowClick || undefined}>
                {columns.map(c => (
                  <td key={c.key} data-align={c.align || (c.fmt ? 'right' : 'left')}>
                    {c.render ? c.render(r) : c.fmt ? (FORMAT[c.fmt] || fmtNum)(r[c.key]) : r[c.key]}
                    {c.bar && r[c.key] != null && <span className="an-cell-bar" style={{ width: `${Math.min(100, (r[c.key] / c.bar) * 100)}%` }} />}
                  </td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(maxRows && sorted.length > maxRows) || exportName ? (
        <div className="an-table-foot">
          {maxRows && sorted.length > maxRows ? <button type="button" className="sp-clear" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer' : `Show all ${sorted.length}`}</button> : <span />}
          {exportName && <ExportButton name={exportName} columns={columns} rows={sorted} />}
        </div>
      ) : null}
    </div>
  );
}

export function ExportButton({ name, columns, rows }) {
  return (
    <button type="button" className="sp-secondary-button an-small-button" onClick={() => import('./lib').then(({ downloadCsv }) =>
      downloadCsv(`${name}.csv`, columns.map(c => ({ ...c, csv: c.csv || (r => r[c.key]) })), rows))}>
      <Download size={13} /> CSV
    </button>
  );
}
