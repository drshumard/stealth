import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BarChart3, Check, ChevronRight, Clock3, DollarSign, Globe2, Home, KeyRound, Loader2, LogOut, Menu,
  ShieldCheck, UserCog, Users, Workflow, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTimezone, TIMEZONE_OPTIONS } from '@/components/TimezoneContext';
import { PasswordField } from '@/components/LoginPage';
import { authJson } from './auth';
import { Drawer, initialsOf } from './ui';
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
  { label: 'Users', path: '/users', icon: UserCog, group: 'Admin', admin: true },
];
const GROUPS = ['Workspace', 'Acquisition', 'Operations', 'Insights', 'Admin'];

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

function Account({ user, onLogout, onChangePassword }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const name = user?.name || user?.username || 'Signed in';
  return (
    <div className="sp-sidebar-foot">
      <button type="button" className="sp-account" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <span className="sp-avatar">{initialsOf(name, 'U')}</span>
        <div><strong>{name}</strong><span>{user?.role === 'admin' ? 'Admin' : 'Member'} · {user?.username}</span></div>
      </button>
      <span className="sp-online" />
      {open && <>
        <button type="button" className="sp-menu-scrim" aria-label="Close account menu" onClick={() => setOpen(false)} />
        <div className="sp-menu" role="menu">
          <div className="sp-menu-list">
            <button type="button" role="menuitem" className="sp-menu-item" onClick={() => { setOpen(false); onChangePassword(); }}>
              <span>Change password</span><KeyRound size={14} />
            </button>
            {user?.role === 'admin' && (
              <button type="button" role="menuitem" className="sp-menu-item" onClick={() => { setOpen(false); navigate('/users'); }}>
                <span>Manage users</span><UserCog size={14} />
              </button>
            )}
            <button type="button" role="menuitem" className="sp-menu-item" data-tone="danger" onClick={() => { setOpen(false); onLogout(); }}>
              <span>Log out</span><LogOut size={14} />
            </button>
          </div>
        </div>
      </>}
    </div>
  );
}

function ChangePassword({ open, onClose }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) { setCurrent(''); setPassword(''); setConfirm(''); setError(''); } }, [open]);
  const submit = async e => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The two new passwords don’t match.');
    setSaving(true);
    try {
      await authJson('/auth/change-password', { method: 'POST', body: { current, password } });
      toast.success('Password changed — other devices were signed out');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Drawer open={open} onClose={onClose} eyebrow="Account / security" label="Change password">
      <form className="sp-drawer-body sp-form-drawer" onSubmit={submit}>
        <span className="sp-drawer-avatar"><KeyRound size={22} /></span>
        <h2>Change password</h2>
        <p>At least 8 characters. Your other signed-in devices will be signed out.</p>
        {error && <div className="sp-login-error" role="alert">{error}</div>}
        <div className="sp-form-stack">
          <PasswordField value={current} onChange={setCurrent} placeholder="Current password" autoFocus />
          <PasswordField value={password} onChange={setPassword} placeholder="New password" autoComplete="new-password" />
          <PasswordField value={confirm} onChange={setConfirm} placeholder="Repeat new password" autoComplete="new-password" />
        </div>
        <div className="sp-builder-foot sp-drawer-foot">
          <button type="button" className="sp-secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="sp-primary-button" disabled={saving}>{saving ? <Loader2 size={15} className="sp-spin" /> : null} Save password</button>
        </div>
      </form>
    </Drawer>
  );
}

export default function WorkspaceShell({ onLogout, user, children }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const nav = NAV.filter(item => !item.admin || user?.role === 'admin');
  const current = nav.find(item => isActive(item, pathname)) || nav[0];

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
          {GROUPS.filter(group => nav.some(item => item.group === group)).map(group => (
            <div className="sp-nav-group" key={group}>
              <p>{group}</p>
              <nav aria-label={group}>
                {nav.filter(item => item.group === group).map(item => {
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
        <Account user={user} onLogout={onLogout} onChangePassword={() => setPwOpen(true)} />
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
      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
