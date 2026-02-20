import { TrendingUp, Users, Activity, Tag } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, accent, sub }) => (
  <div
    className="rounded-2xl border p-6"
    style={{ backgroundColor: '#ffffff', borderColor: 'var(--stroke)', boxShadow: 'var(--shadow-soft)' }}
  >
    <div className="flex items-center justify-between mb-4">
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accent}18` }}>
        <Icon size={16} style={{ color: accent }} />
      </div>
    </div>
    <div
      className="text-4xl font-bold tabular-nums"
      style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {value ?? '—'}
    </div>
    {sub && <div className="text-xs mt-1.5" style={{ color: 'var(--text-dim)' }}>{sub}</div>}
  </div>
);

export default function AnalyticsPage({ stats, contacts }) {
  const sourceMap = {};
  contacts.forEach(c => {
    const src = c.attribution?.utm_source;
    if (src) sourceMap[src] = (sourceMap[src] || 0) + 1;
  });
  const topSources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const identifiedCount = contacts.filter(c => c.email || c.phone || c.name).length;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}>Analytics</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Overview of your lead capture performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard icon={Users}    label="Total Contacts" value={stats.total_contacts} accent="#f97316" sub={`${identifiedCount} with email or phone`} />
        <StatCard icon={Activity} label="Today's Events"  value={stats.today_visits}  accent="#10b981" sub="page views today" />
      </div>

      {topSources.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)', fontFamily: 'Space Grotesk, sans-serif' }}>Top Sources</h2>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-soft)' }}>
            {topSources.map(([src, count], i) => (
              <div
                key={src}
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: i < topSources.length - 1 ? '1px solid var(--stroke)' : 'none' }}
              >
                <div className="flex items-center gap-3">
                  <Tag size={13} style={{ color: 'var(--primary-orange)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{src}</span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Mini bar */}
                  <div className="w-24 h-1.5 rounded-full" style={{ backgroundColor: 'var(--stroke)' }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${Math.round((count / contacts.length) * 100)}%`, backgroundColor: 'var(--primary-orange)' }}
                    />
                  </div>
                  <span
                    className="text-xs font-semibold font-mono w-6 text-right tabular-nums"
                    style={{ color: 'var(--primary-orange)' }}
                  >{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
