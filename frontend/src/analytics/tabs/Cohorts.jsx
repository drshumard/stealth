import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PALETTE, bucketLabel, fmtCompact, fmtNum, fmtPct, useA } from '../lib';
import { CohortMatrix, Legend, Panel, Segmented, Select } from '../charts';

// Cohorts ignore the period picker: they are the last N weeks / months of people, by when they were first seen.
export default function Cohorts({ state, update }) {
  const period = state.params.get('cp') || 'week';
  const count = state.params.get('cn') || (period === 'week' ? '10' : '6');
  const q = useA('/cohorts', state, { period, count });
  const rows = q.data?.rows || [];
  const data = rows.map(r => ({ cohort: r.cohort, size: r.size, registered: r.registered, identified: r.identified, back: r.retention[1] ?? null }));
  return <>
    <div className="an-toolbar">
      <Segmented label="Cohort period" value={period} onChange={v => update({ cp: v === 'week' ? null : v, cn: null })}
        options={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />
      <Select label="Number of cohorts" value={count} onChange={v => update({ cn: v })}
        options={(period === 'week' ? [6, 8, 10, 12, 16, 20, 26] : [3, 4, 6, 8]).map(n => ({ value: String(n), label: `Last ${n} ${period}s` }))} />
      <span className="an-note">People grouped by the {period} they were first seen. Source / campaign filters apply; the date range doesn’t.</span>
    </div>
    <Panel help="cohorts" title="Cohort quality" eyebrow="Size and conversion of each cohort" query={q} empty={!rows.length}
      footer={<Legend items={[{ label: 'People', color: '#c9d6f2' }, { label: 'Identified %', color: PALETTE[0] },
        { label: 'Registered %', color: PALETTE[1] }, { label: `Came back the next ${period}`, color: PALETTE[2] }]} />}>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#edf1f6" vertical={false} />
          <XAxis dataKey="cohort" tickFormatter={k => bucketLabel(k, period)} stroke="#c9d3e1" tick={{ fill: '#8a98aa', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="n" tickFormatter={fmtCompact} stroke="#c9d3e1" tick={{ fill: '#8a98aa', fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
          <YAxis yAxisId="p" orientation="right" tickFormatter={v => fmtPct(v, 0)} stroke="#c9d3e1" tick={{ fill: '#8a98aa', fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip formatter={(v, n) => (n === 'People' ? fmtNum(v) : fmtPct(v))} labelFormatter={k => bucketLabel(k, period, true)} />
          <Bar yAxisId="n" dataKey="size" name="People" fill="#c9d6f2" radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false} />
          <Line yAxisId="p" dataKey="identified" name="Identified" stroke={PALETTE[0]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          <Line yAxisId="p" dataKey="registered" name="Registered" stroke={PALETTE[1]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          <Line yAxisId="p" dataKey="back" name="Came back" stroke={PALETTE[2]} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
    <Panel help="cohorts" title="Retention" eyebrow={`Share of each cohort that visited again in later ${period}s`} query={q} empty={!rows.length}>
      <CohortMatrix rows={rows} period={period} />
      <p className="an-note">Darker = more of the cohort came back. Identified / registered / bought are what the cohort has done so far.</p>
    </Panel>
  </>;
}
