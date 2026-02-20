import { Users, Activity, TrendingUp, Tag } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, accent, sub }) => (
  <div
    className="rounded-xl border p-5"
    style={{ backgroundColor: 'var(--bg-elev-1)', borderColor: 'var(--stroke)' }}
  >
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--text-dim)' }}>{label}</span>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${accent}18` }}
      >
        <Icon size={15} style={{ color: accent }} />
      </div>
    </div>
    <div
      className="text-3xl font-bold tabular-nums"
      style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {value ?? '—'}
    </div>
    {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{sub}</div>}
  </div>
);

export default function AnalyticsPage({ stats, contacts }) {
  // Tally top sources from contacts
  const sourceMap = {};
  contacts.forEach(c => {
    const src = c.attribution?.utm_source;
    if (src) sourceMap[src] = (sourceMap[src] || 0) + 1;
  });
  const topSources = Object.entries(sourceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const identifiedCount = contacts.filter(c => c.email || c.phone || c.name).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--stroke)' }}
      >
        <h1
          className="text-sm font-semibold"
          style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
        >
          Analytics
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon={Users}
            label="Total Contacts"
            value={stats.total_contacts}
            accent="var(--primary-cyan)"
            sub={`${identifiedCount} identified`}
          />
          <StatCard
            icon={Activity}
            label="Today's Events"
            value={stats.today_visits}
            accent="var(--mint-success)"
            sub="page views today"
          />
        </div>

        {/* Top sources */}
        {topSources.length > 0 && (
          <div>
            <h2
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-dim)' }}
            >
              Top Sources
            </h2>
            <div
              className="rounded-xl border divide-y"
              style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--bg-elev-1)' }}
            >
              {topSources.map(([src, count]) => (
                <div key={src} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Tag size={13} style={{ color: 'var(--amber-warn)' }} />
                    <span className="text-sm" style={{ color: 'var(--text)' }}>{src}</span>
                  </div>
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'rgba(21,184,200,0.1)',
                      color: 'var(--primary-cyan)',
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
