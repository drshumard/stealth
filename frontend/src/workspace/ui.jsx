import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, ChevronRight, Code2, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTimezone } from '@/components/TimezoneContext';

// The workspace's building blocks — from the Stealth design prototype (kept locally, not in git), on live data.

export function Status({ children, tone = 'quiet' }) {
  return <span className="sp-status" data-tone={tone}>{children}</span>;
}

// Date over time, in the chosen display timezone.
export function DateStamp({ value }) {
  const { formatDate, formatTime } = useTimezone();
  if (!value) return <span className="sp-date"><span>—</span></span>;
  return <span className="sp-date"><span>{formatDate(value)}</span><small>{formatTime(value)}</small></span>;
}

export const initialsOf = (name, fallback = '?') => {
  const words = (name || '').trim().split(/\s+/).filter(w => /^\p{L}/u.test(w));
  return words.length ? words.map(w => w[0]).slice(0, 2).join('').toUpperCase() : fallback;
};

export function Person({ name, email }) {
  return (
    <span className="sp-person">
      <span className="sp-avatar">{initialsOf(name || email)}</span>
      <span className="sp-person-copy"><strong>{name || email || 'Anonymous visitor'}</strong>{name && email && <small>{email}</small>}</span>
    </span>
  );
}

export function Metric({ label, value, detail, icon: Icon, tone = 'blue' }) {
  return (
    <div className="sp-metric">
      <span className="sp-metric-icon" data-tone={tone}><Icon size={18} /></span>
      <div><span className="sp-metric-label">{label}</span><strong>{value ?? '—'}</strong>{detail && <small>{detail}</small>}</div>
    </div>
  );
}

export function PageIntro({ eyebrow, title, description, actions }) {
  return (
    <div className="sp-page-intro">
      <div><span className="sp-eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {actions && <div className="sp-page-actions">{actions}</div>}
    </div>
  );
}

export function SurfaceHead({ eyebrow, title, children }) {
  return (
    <div className="sp-surface-head">
      <div><span className="sp-eyebrow">{eyebrow}</span><h2>{title}</h2></div>
      {children}
    </div>
  );
}

export function IntegrationNote({ title, endpoint, copy }) {
  return (
    <div className="sp-integration">
      <span className="sp-integration-icon"><Code2 size={19} /></span>
      <div><span className="sp-eyebrow">Integration</span><strong>{title}</strong><p>{copy}</p></div>
      <code>{endpoint}</code>
    </div>
  );
}

// The prototype's clickable record table. columns: [{ key, label, render(row), className?, width? }].
export function RecordTable({ rows, columns, label, onOpen, rowKey = r => r.id, emptyText = 'No records match these filters.', foot }) {
  const cols = columns.map((c, i) => c.width || (i === 0 ? '2fr' : '1fr')).join(' ');
  return (
    <div className="sp-table-wrap">
      <div role="table" aria-label={label} className="sp-table">
        <div role="row" className="sp-table-head" style={{ '--sp-cols': cols }}>
          {columns.map(c => <div key={c.key} role="columnheader">{c.label}</div>)}
          <div role="columnheader" className="sp-table-action-head">Details</div>
        </div>
        {rows.length ? rows.map(row => (
          <div role="row" tabIndex={0} key={rowKey(row)} className="sp-table-row" style={{ '--sp-cols': cols }}
            onClick={() => onOpen(row)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(row); } }}>
            {columns.map(c => <div role="cell" key={c.key} data-label={c.label} className={`sp-table-cell ${c.className || ''}`}>{c.render(row)}</div>)}
            <div role="cell" className="sp-table-open"><ChevronRight size={17} aria-hidden="true" /></div>
          </div>
        )) : <div className="sp-empty">{emptyText}</div>}
      </div>
      {foot && <div className="sp-table-foot">{foot}</div>}
    </div>
  );
}

export const money = (n, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'USD').toUpperCase(), maximumFractionDigits: 2 }).format(n || 0);
export const count = n => (n == null ? '—' : Number(n).toLocaleString('en-US'));

// The prototype's right-hand detail drawer (a Radix dialog: focus trap, Esc, outside click). It renders inside .sp-app
// so the workspace styles apply.
export function Drawer({ open, onClose, eyebrow, label, actions, testId, closeTestId, wide, children }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogPrimitive.Portal container={document.querySelector('.sp-app') || undefined}>
        <DialogPrimitive.Overlay className="sp-overlay">
          <DialogPrimitive.Content className={`sp-drawer${wide ? ' sp-drawer-wide' : ''}`} data-testid={testId} aria-describedby={undefined}>
            <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
            <div className="sp-drawer-head">
              <span className="sp-eyebrow">{eyebrow}</span>
              <span className="sp-drawer-actions">{actions}
                <DialogPrimitive.Close asChild>
                  <button type="button" className="sp-icon-button" data-testid={closeTestId} aria-label="Close details"><X size={19} /></button>
                </DialogPrimitive.Close>
              </span>
            </div>
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function DrawerTabs({ tabs, active, onChange }) {
  return (
    <div className="sp-drawer-tabs" role="tablist">
      {tabs.map(tab => (
        <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} data-testid={tab.testId} onClick={() => onChange(tab.id)}>
          {tab.label}{tab.badge != null && <span className="sp-tab-badge" data-tone={tab.tone}>{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="sp-copy" aria-label={label} title={label}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('Copied!', { duration: 1500 });
        setTimeout(() => setCopied(false), 2000);
      }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

// A drawer field: label, value (or "Not provided"), optional copy button.
export function Field({ label, value, copyable, wrap }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd data-empty={!value || undefined} data-wrap={wrap || undefined} title={value || undefined}>
        <span className="sp-dd-text">{value || 'Not provided'}</span>{copyable && value && <CopyButton text={value} label={`Copy ${label}`} />}
      </dd>
    </div>
  );
}
