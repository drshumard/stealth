import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { API, PALETTE, fmtNum, getJson } from '../lib';
import { BarList, Panel } from '../charts';

// The last 30 minutes, refreshed every 10 seconds. Ignores the period and filters.
export default function Live() {
  const q = useQuery({ queryKey: ['analytics-live'], queryFn: () => getJson(`${API}/live`), refetchInterval: 10_000 });
  const d = q.data;
  const local = m => {
    const [h, mm] = m.split(':').map(Number);
    const dt = new Date();
    dt.setUTCHours(h, mm, 0, 0);
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  return <>
    <div className="an-stat-strip an-stat-strip-lg an-live-strip">
      <div data-tone="live"><span><i className="an-pulse" /> Active now</span><strong>{fmtNum(d?.active_5m)}</strong><small>visitors in the last 5 minutes</small></div>
      <div><span>Last 30 minutes</span><strong>{fmtNum(d?.active_30m)}</strong><small>visitors</small></div>
      <div><span>New leads</span><strong>{fmtNum(d?.identified_30m)}</strong><small>identified in 30 minutes</small></div>
      <div><span>Registrations</span><strong>{fmtNum(d?.registrations_30m)}</strong><small>in 30 minutes</small></div>
    </div>
    <Panel title="Page views per minute" eyebrow="Last 30 minutes · updates every 10 seconds" query={q} empty={!d?.series?.length}>
      {d && (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={d.series} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#edf1f6" vertical={false} />
            <XAxis dataKey="minute" tickFormatter={local} stroke="#c9d3e1" tick={{ fill: '#8a98aa', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis allowDecimals={false} stroke="#c9d3e1" tick={{ fill: '#8a98aa', fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
            <Tooltip labelFormatter={local} formatter={(v, n) => [fmtNum(v), n]} cursor={{ fill: 'rgba(49,95,209,.05)' }} />
            <Bar dataKey="views" name="Page views" fill={PALETTE[0]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="visitors" name="Visitors" fill={PALETTE[1]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
    <div className="an-grid an-grid-2">
      <Panel title="Pages right now" eyebrow="Visitors in the last 5 minutes" query={q} empty={!d?.pages?.length && 'Nobody on the site in the last 5 minutes.'}>
        {d && <BarList rows={d.pages} label="page" value="visitors" />}
      </Panel>
      <Panel title="Sources" eyebrow="Visitors in the last 30 minutes" query={q} empty={!d?.sources?.length}>
        {d && <BarList rows={d.sources} label="source" value="visitors" tone="green" />}
      </Panel>
    </div>
  </>;
}
