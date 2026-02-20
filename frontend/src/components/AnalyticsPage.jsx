import { TrendingUp, Users, Activity, Tag } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, accent, sub }) => (
  <div
    className="rounded-2xl border p-8"
    style={{ backgroundColor: '#ffffff', borderColor: 'var(--stroke)', boxShadow: 'var(--shadow-soft)' }}
  >
    <div className="flex items-start justify-between mb-5">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{label}</span>
      </div>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accent}15` }}>
        <Icon size={20} style={{ color: accent }} />
      </div>
    </div>
    <div
      className="text-5xl font-bold tabular-nums mb-2"
      style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.03em' }}
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {value ?? '—'}
    </div>
    {sub && <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
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
  const maxCount = topSources[0]?.[1] || 1;

  return (
    <div className="p-8 md:p-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>Analytics</h1>
        <p className="text-base mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>Overview of your lead capture performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
        <StatCard icon={Users}    label="Total Contacts" value={stats.total_contacts} accent="#030352" sub={`${identifiedCount} with email or phone`} />
        <StatCard icon={Activity} label="Today's Events"  value={stats.today_visits}  accent="#A31800" sub="page views today" />
      </div>

      {topSources.length > 0 && (
        <div>
          <h2 className="text-base font-bold mb-4" style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.01em' }}>Top Sources</h2>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-soft)' }}>
            {topSources.map(([src, count], i) => (
              <div
                key={src}
                className="flex items-center justify-between px-7 py-5"
                style={{ borderBottom: i < topSources.length - 1 ? '1px solid var(--stroke)' : 'none' }}
              >
                <div className="flex items-center gap-3">
                  <Tag size={14} style={{ color: 'var(--brand-red)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{src}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-2 rounded-full" style={{ backgroundColor: 'var(--stroke)' }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.round((count / maxCount) * 100)}%`, backgroundColor: 'var(--brand-navy)' }}
                    />
                  </div>
                  <span className="text-sm font-bold tabular-nums w-8 text-right" style={{ color: 'var(--brand-red)' }}>{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
