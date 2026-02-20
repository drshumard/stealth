import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Users, Activity, Zap } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { id: 'leads',     label: 'Leads',     icon: Users,     path: '/' },
  { id: 'logs',      label: 'Logs',      icon: Activity,  path: '/logs' },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPage =
    location.pathname === '/analytics' ? 'analytics' :
    location.pathname === '/logs'       ? 'logs'      : 'leads';

  return (
    <aside
      className="flex flex-col border-r shrink-0"
      style={{
        width: '200px',
        backgroundColor: 'var(--bg-elev-1)',
        borderColor: 'var(--stroke)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b" style={{ borderColor: 'var(--stroke)' }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--primary-cyan)' }}
        >
          <Zap size={13} style={{ color: 'var(--bg)' }} />
        </div>
        <span
          className="text-sm font-semibold tracking-tight"
          style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
        >
          Shumard
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon, path }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              data-testid={`sidebar-nav-${id}`}
              onClick={() => navigate(path)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-150"
              style={{
                backgroundColor: active ? 'rgba(21,184,200,0.1)' : 'transparent',
                color: active ? 'var(--primary-cyan)' : 'var(--text-dim)',
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: active ? 500 : 400,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Status */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--stroke)' }}>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: 'var(--mint-success)' }}
          />
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Active</span>
        </div>
      </div>
    </aside>
  );
};
