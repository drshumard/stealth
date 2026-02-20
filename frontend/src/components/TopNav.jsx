import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Globe, BarChart3, List, Search, Bell, ChevronDown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_TABS = [
  { id: 'leads',     label: 'Leads',     icon: Users,     path: '/' },
  { id: 'visitors',  label: 'Visitors',  icon: Globe,     path: '/visitors' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { id: 'logs',      label: 'Logs',      icon: List,      path: '/logs' },
];

export const TopNav = ({ stats }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const active =
    location.pathname === '/analytics' ? 'analytics' :
    location.pathname === '/visitors'  ? 'visitors'  :
    location.pathname === '/logs'      ? 'logs'      : 'leads';

  return (
    <header
      data-testid="top-nav"
      className="flex items-center justify-between px-6 py-3 border-b"
      style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}
    >
      {/* Left: brand + tabs */}
      <div className="flex items-center gap-6">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0 mr-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--primary-orange)' }}
          >
            <Zap size={13} className="text-white" />
          </div>
          <span
            className="text-sm font-bold tracking-tight hidden sm:block"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
          >
            Shumard
          </span>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV_TABS.map(({ id, label, icon: Icon, path }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                data-testid={`top-nav-tab-${id}`}
                onClick={() => navigate(path)}
                className={`flex items-center gap-2 px-4 py-1.5 text-sm whitespace-nowrap transition-all duration-150 ${
                  isActive ? 'nav-tab-active' : 'nav-tab-inactive'
                }`}
                style={{ fontFamily: 'Work Sans, sans-serif' }}
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
          className="w-8 h-8 p-0 rounded-full"
          style={{ color: 'var(--text-muted)' }}
        >
          <Search size={16} />
        </Button>
        <Button
          data-testid="top-nav-notifications-button"
          variant="ghost" size="sm"
          className="w-8 h-8 p-0 rounded-full relative"
          style={{ color: 'var(--text-muted)' }}
        >
          <Bell size={16} />
          {stats?.today_visits > 0 && (
            <span
              className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--primary-orange)' }}
            />
          )}
        </Button>

        {/* User section */}
        <button
          data-testid="top-nav-user-menu"
          className="flex items-center gap-2.5 ml-1 px-2 py-1.5 rounded-xl transition-colors duration-150"
          style={{ color: 'var(--text)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: 'var(--primary-orange)' }}
          >
            S
          </div>
          <div className="text-left hidden md:block">
            <div className="text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>Shumard</div>
            <div className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>Lead Tracking</div>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-dim)' }} />
        </button>
      </div>
    </header>
  );
};
