import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity, BarChart3, Check, ChevronRight, Clock3, DollarSign, Globe2, Home, LogOut, Menu,
  ShieldCheck, Users, Workflow, X,
} from 'lucide-react';
import { useTimezone, TIMEZONE_OPTIONS } from '@/components/TimezoneContext';
import './workspace.css';

// The Stealth workspace shell — from the Stealth design prototype (kept locally). Navigation keeps the live URLs:
// Registrations is /stealth and Activity is /logs.
const NAV = [
  { label: 'Overview', path: '/', icon: Home, group: 'Workspace' },
  { label: 'Registrations', path: '/stealth', icon: ShieldCheck, group: 'Acquisition' },
  { label: 'Leads', path: '/leads', icon: Users, group: 'Acquisition' },
  { label: 'Visitors', path: '/visitors', icon: Globe2, group: 'Acquisition' },
  { label: 'Sales', path: '/sales', icon: DollarSign, group: 'Operations' },
  { label: 'Automations', path: '/automations', icon: Workflow, group: 'Operations' },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, group: 'Insights' },
  { label: 'Activity', path: '/logs', icon: Activity, group: 'Insights' },
];
const GROUPS = ['Workspace', 'Acquisition', 'Operations', 'Insights'];

const isActive = (item, pathname) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path));

// "PDT", "GMT+1" … for the chosen display timezone.
function tzAbbr(timezone) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
      .formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || timezone;
  } catch {
    return timezone;
  }
}

function TimezoneMenu() {
  const { timezone, setTimezone } = useTimezone();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const options = TIMEZONE_OPTIONS.filter(o => !search
    || o.label.toLowerCase().includes(search.toLowerCase()) || o.value.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="sp-tz">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen(v => !v); setSearch(''); }}
        title="Display timezone">
        <Clock3 size={15} /> {tzAbbr(timezone)}
      </button>
      {open && <>
        <button type="button" className="sp-menu-scrim" aria-label="Close timezone menu" onClick={() => setOpen(false)} />
        <div className="sp-menu" role="menu" aria-label="Display timezone">
          <div className="sp-menu-head">
            <span className="sp-eyebrow">Display timezone</span>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search timezone…" aria-label="Search timezone" />
          </div>
          <div className="sp-menu-list">
            {options.map(o => (
              <button key={o.value} type="button" role="menuitemradio" aria-checked={timezone === o.value} className="sp-menu-item"
                onClick={() => { setTimezone(o.value); setOpen(false); }}>
                <span>{o.label}</span>{timezone === o.value && <Check size={13} />}
              </button>
            ))}
          </div>
        </div>
      </>}
    </div>
  );
}

function Account({ onLogout }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sp-sidebar-foot">
      <button type="button" className="sp-account" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <span className="sp-avatar">DS</span>
        <div><strong>Dr. Shumard</strong><span>Stealth workspace</span></div>
      </button>
      <span className="sp-online" />
      {open && <>
        <button type="button" className="sp-menu-scrim" aria-label="Close account menu" onClick={() => setOpen(false)} />
        <div className="sp-menu" role="menu">
          <div className="sp-menu-list">
            <button type="button" role="menuitem" className="sp-menu-item" data-tone="danger" onClick={() => { setOpen(false); onLogout(); }}>
              <span>Log out</span><LogOut size={14} />
            </button>
          </div>
        </div>
      </>}
    </div>
  );
}

export default function WorkspaceShell({ onLogout, children }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = NAV.find(item => isActive(item, pathname)) || NAV[0];

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  return (
    <div className="sp-app">
      <a href="#sp-main" className="sp-skip">Skip to content</a>
      {menuOpen && <button className="sp-mobile-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`sp-sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Stealth navigation">
        <div className="sp-brand">
          <img src="/dr-shumard-logo.png" width="181" height="27" alt="Dr. Shumard" />
          <button className="sp-mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        <div className="sp-nav-scroll">
          {GROUPS.map(group => (
            <div className="sp-nav-group" key={group}>
              <p>{group}</p>
              <nav aria-label={group}>
                {NAV.filter(item => item.group === group).map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.path} to={item.path} aria-current={item === current ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                      <span className="sp-nav-icon"><Icon size={17} /></span><span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
        <Account onLogout={onLogout} />
      </aside>
      <div className="sp-workspace">
        <header className="sp-topbar">
          <div className="sp-breadcrumb">
            <button className="sp-menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
            <span>Workspace</span><ChevronRight size={14} /><strong>Stealth</strong><ChevronRight size={14} /><strong>{current.label}</strong>
          </div>
          <div className="sp-topbar-right"><TimezoneMenu /></div>
        </header>
        <main id="sp-main" className="sp-main">{children}</main>
        <footer className="sp-footer"><span>Dr. Shumard · Stealth workspace</span></footer>
      </div>
    </div>
  );
}
