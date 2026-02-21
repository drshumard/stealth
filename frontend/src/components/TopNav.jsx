import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Globe, BarChart3, List, Search, Bell, ChevronDown, Zap, DollarSign, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_TABS = [
  { id: 'leads',       label: 'Leads',       icon: Users,       path: '/' },
  { id: 'sales',       label: 'Sales',       icon: DollarSign,  path: '/sales' },
  { id: 'visitors',    label: 'Visitors',    icon: Globe,       path: '/visitors' },
  { id: 'automations', label: 'Automations', icon: Zap,         path: '/automations' },
  { id: 'analytics',   label: 'Analytics',   icon: BarChart3,   path: '/analytics' },
  { id: 'logs',        label: 'Logs',        icon: List,        path: '/logs' },
];

export const TopNav = ({ stats, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const active =
    location.pathname === '/analytics'   ? 'analytics'   :
    location.pathname === '/visitors'    ? 'visitors'    :
    location.pathname === '/sales'       ? 'sales'       :
    location.pathname === '/automations' ? 'automations' :
    location.pathname === '/logs'        ? 'logs'        : 'leads';

  return (
    <header
      data-testid="top-nav"
      className="flex items-center justify-between px-8 py-4 border-b"
      style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}
    >
      {/* Left: brand + tabs */}
      <div className="flex items-center gap-8">
        {/* TETHER text logo — no icon */}
        <span
          className="text-xl font-bold tracking-tight shrink-0 select-none"
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            color: 'var(--brand-navy)',
            letterSpacing: '-0.04em',
          }}
        >
          TETHER
        </span>

        {/* Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV_TABS.map(({ id, label, icon: Icon, path }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                data-testid={`top-nav-tab-${id}`}
                onClick={() => navigate(path)}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive ? 'nav-tab-active' : 'nav-tab-inactive'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: actions + user */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          data-testid="top-nav-search-button"
          variant="ghost" size="sm"
          className="w-9 h-9 p-0 rounded-full"
          style={{ color: 'var(--text-muted)' }}
        >
          <Search size={16} />
        </Button>
        <Button
          data-testid="top-nav-notifications-button"
          variant="ghost" size="sm"
          className="w-9 h-9 p-0 rounded-full relative"
          style={{ color: 'var(--text-muted)' }}
        >
          <Bell size={16} />
          {stats?.today_visits > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--brand-red)' }}
            />
          )}
        </Button>

        {/* Divider */}
        <div className="w-px h-6 mx-1" style={{ backgroundColor: 'var(--stroke)' }} />

        {/* User section */}
        <button
          data-testid="top-nav-user-menu"
          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150 hover:bg-[#f5f3ef]"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: 'var(--brand-navy)' }}
          >
            T
          </div>
          <div className="text-left hidden md:block">
            <div className="text-sm font-bold leading-tight" style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif' }}>Tether</div>
            <div className="text-xs leading-tight" style={{ color: 'var(--text-dim)' }}>Lead Tracking</div>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-dim)' }} />
        </button>

        {onLogout && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="w-8 h-8 p-0 rounded-full ml-1"
            style={{ color: 'var(--text-dim)' }}
            title="Log out"
          >
            <LogOut size={15} />
          </Button>
        )}
      </div>
    </header>
  );
};
