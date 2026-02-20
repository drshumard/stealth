import { TrendingUp, Users, Activity, Tag, Zap } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, tintBg, tintGlow, tintBorder, iconBg, iconColor, sub }) => (
  <div
    className="rounded-2xl border-0 p-8 relative overflow-hidden"
    style={{
      background: tintGlow,
      border: `1.5px solid ${tintBorder}`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    }}
  >
    {/* Decorative large faint icon in background */}
    <div
      className="absolute -right-4 -top-4 opacity-[0.06] pointer-events-none select-none"
      aria-hidden
    >
      <Icon size={120} color={iconColor} />
    </div>

    <div className="relative z-10">
      <div className="flex items-center justify-between mb-5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={22} style={{ color: iconColor }} />
        </div>
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: iconColor, opacity: 0.7 }}
        >
          {label}
        </span>
      </div>

      <div
        className="text-5xl font-bold tabular-nums mb-2"
        style={{ fontFamily: 'Space Grotesk, sans-serif', color: iconColor, letterSpacing: '-0.04em' }}
        data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {value ?? '—'}
      </div>
      {sub && <div className="text-sm font-semibold" style={{ color: iconColor, opacity: 0.65 }}>{sub}</div>}
    </div>
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
      {/* Page header with navy tint */}
      <div
        className="rounded-2xl px-8 py-7 mb-8"
        style={{
          background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 50%, #f9f8f5 100%)',
          border: '1.5px solid #d2d8ef',
        }}
      >
        <h1 className="text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>Analytics</h1>
        <p className="text-base mt-1 font-semibold" style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>Overview of your lead capture performance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
        <StatCard
          icon={Users}
          label="Total Contacts"
          value={stats.total_contacts}
          tintGlow="radial-gradient(ellipse at top right, #d6dcf0 0%, #eef0f8 55%, #f0f2fa 100%)"
          tintBorder="#c0c9e8"
          iconBg="rgba(3,3,82,0.12)"
          iconColor="#030352"
          sub={`${identifiedCount} with email or phone`}
        />
        <StatCard
          icon={Activity}
          label="Today's Events"
          value={stats.today_visits}
          tintGlow="radial-gradient(ellipse at top right, #f5cdc6 0%, #fdf0ee 55%, #fef5f3 100%)"
          tintBorder="#f0c0b8"
          iconBg="rgba(163,24,0,0.10)"
          iconColor="#A31800"
          sub="page views today"
        />
      </div>

      {/* Top sources */}
      {topSources.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(3,3,82,0.10)' }}>
              <Tag size={15} style={{ color: 'var(--brand-navy)' }} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}>Top Sources</h2>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #f2f3f9 0%, #f8f7f5 100%)',
              border: '1.5px solid #d2d8ef',
            }}
          >
            {topSources.map(([src, count], i) => (
              <div
                key={src}
                className="flex items-center justify-between px-7 py-5"
                style={{
                  borderBottom: i < topSources.length - 1 ? '1px solid rgba(3,3,82,0.08)' : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: 'rgba(3,3,82,0.10)', color: '#030352' }}
                  >
                    {src.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-bold capitalize" style={{ color: 'var(--text)' }}>{src}</span>
                </div>
                <div className="flex items-center gap-5">
                  <div className="w-40 h-2.5 rounded-full" style={{ backgroundColor: 'rgba(3,3,82,0.10)' }}>
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: `${Math.round((count / maxCount) * 100)}%`,
                        background: 'linear-gradient(90deg, #030352 0%, #3a3d7c 100%)',
                      }}
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
