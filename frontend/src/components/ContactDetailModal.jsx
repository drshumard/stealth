import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ExternalLink, Globe, ShoppingCart, Tag, Trash2, TrendingUp } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTimezone } from '@/components/TimezoneContext';
import { CopyButton, Drawer, DrawerTabs, Field, Status, initialsOf, money } from '@/workspace/ui';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const SALE_TONE = { completed: 'green', paid: 'green', refunded: 'red', failed: 'red' };

function parseUrlParams(url) {
  try {
    const u = new URL(url);
    const params = [];
    u.searchParams.forEach((val, key) => params.push({ key, val }));
    return { base: u.origin + u.pathname, params };
  } catch {
    return { base: url, params: [] };
  }
}

const ATTRIBUTION_GROUPS = [
  { title: 'UTM Parameters', fields: [['utm_source'], ['utm_medium'], ['utm_campaign'], ['utm_term'], ['utm_content'], ['utm_id']] },
  { title: 'Ad Platform IDs', fields: [['campaign_id'], ['adset_id'], ['ad_id'], ['fb_ad_set_id'], ['google_campaign_id']] },
  { title: 'Click IDs & FB Cookies', fields: [['fbclid'], ['fbc', 'fbc (FB Click)'], ['fbp', 'fbp (FB Browser)'], ['gclid'], ['ttclid'], ['source_link_tag']] },
];

function UrlVisitItem({ visit, fmt }) {
  const { base, params } = parseUrlParams(visit.current_url || '');
  const { base: refBase, params: refParams } = parseUrlParams(visit.referrer_url || '');
  const visitAttribution = visit.attribution
    ? Object.entries(visit.attribution).filter(([k, v]) => v && k !== 'extra' && typeof v === 'string') : [];
  return (
    <li className="sp-visit" data-testid="contact-url-row">
      <div className="sp-visit-head"><time dateTime={visit.timestamp}>{fmt(visit.timestamp)}</time>{visit.page_title && <Status tone="blue">{visit.page_title}</Status>}</div>
      <div className="sp-visit-label"><Globe size={12} /> Current URL <CopyButton text={visit.current_url} label="Copy URL" /></div>
      <p className="sp-break">{base}</p>
      {params.length > 0 && <div className="sp-chips">{params.map(({ key, val }) => <span key={key} className="sp-chip">{key}={val}</span>)}</div>}
      {visit.referrer_url && <>
        <div className="sp-visit-label"><ExternalLink size={12} /> Referrer</div>
        <p className="sp-break sp-muted">{refBase}</p>
        {refParams.length > 0 && <div className="sp-chips">{refParams.map(({ key, val }) => <span key={key} className="sp-chip" data-tone="quiet">{key}={val}</span>)}</div>}
      </>}
      {visitAttribution.length > 0 && <>
        <div className="sp-visit-label"><Tag size={12} /> Attribution (this visit)</div>
        <div className="sp-chips">{visitAttribution.map(([k, v]) => <span key={k} className="sp-chip" data-tone="green">{k}={v}</span>)}</div>
      </>}
    </li>
  );
}

// ── Inner — keyed per contact ─────────────────────────────────────────────────
// Owns state and fetch; key={contactId} remounts it on every contact switch while the drawer shell stays mounted.
const ContactInner = ({ contactId, defaultTab, onClose, onDelete }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || 'overview');
  const { formatDateTime: fmt } = useTimezone();

  useEffect(() => { setActiveTab(defaultTab || 'overview'); }, [defaultTab]);

  const { data: contact, isLoading, error } = useQuery({
    queryKey: ['contact', contactId],
    queryFn:  () => fetch(`${BACKEND_URL}/api/contacts/${contactId}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); }),
    enabled: !!contactId,
  });

  const attr = contact?.attribution || {};
  const hasAttribution = Object.entries(attr).some(([k, v]) => {
    if (k === 'extra') return v && typeof v === 'object' && Object.keys(v).length > 0;
    return v && typeof v !== 'object';
  });
  const title = contact?.name || contact?.email || 'Anonymous Contact';

  const tabs = [
    { id: 'overview',    label: 'Overview',    testId: 'contact-overview-tab' },
    { id: 'attribution', label: 'Attribution', testId: 'contact-attribution-tab', badge: hasAttribution ? '●' : null, tone: 'green' },
    { id: 'urls',        label: 'URL History', testId: 'contact-urls-tab', badge: contact?.visits?.length || null },
    { id: 'sales',       label: 'Sales',       testId: 'contact-sales-tab', badge: contact?.sales?.length || null, tone: 'green' },
  ];

  const saleCard = sale => (
    <div key={sale.id} className="sp-sale-card">
      <span className="sp-metric-icon" data-tone="green"><ShoppingCart size={16} /></span>
      <div><strong>{sale.product || 'Purchase'}</strong><small>{[sale.source && `via ${sale.source}`, fmt(sale.created_at)].filter(Boolean).join(' · ')}</small></div>
      <div className="sp-sale-card-end"><strong className="sp-amount">{sale.amount != null ? money(sale.amount, sale.currency) : '—'}</strong>
        <Status tone={SALE_TONE[sale.status?.toLowerCase()] || 'amber'}>{sale.status || 'completed'}</Status></div>
    </div>
  );

  const tabContent = () => {
    if (isLoading) return <div className="sp-drawer-loading">{[...Array(5)].map((_, i) => <span key={i} className="sp-skeleton" />)}</div>;
    if (!contact) return null;

    if (activeTab === 'overview') return <>
      <h3>Record information</h3>
      <dl>
        <Field label="Full Name" value={contact.name} />
        <Field label="Email" value={contact.email} copyable />
        <Field label="Phone" value={contact.phone} />
        <Field label="Contact ID" value={contact.contact_id} copyable />
        <Field label="IP Address" value={contact.client_ip} />
        <Field label="User Agent" value={contact.user_agent} copyable wrap />
        <Field label="Session ID" value={contact.session_id} copyable />
        <Field label="First Seen" value={contact.created_at && fmt(contact.created_at)} />
        <Field label="Last Updated" value={contact.updated_at && fmt(contact.updated_at)} />
        {contact.merged_children?.length > 0 && (
          <div><dt>Stitched</dt><dd data-wrap>{contact.merged_children.map(cid => <span key={cid} className="sp-chip" data-tone="quiet">{cid}</span>)}</dd></div>
        )}
      </dl>
      {contact.tags?.length > 0 && <div className="sp-drawer-tags">{contact.tags.map(tag => <Status key={tag} tone="blue">{tag}</Status>)}</div>}
      {contact.sales?.length > 0 && <><h3 className="sp-drawer-section">Purchases</h3>{contact.sales.map(saleCard)}</>}
    </>;

    if (activeTab === 'attribution') {
      if (!hasAttribution) return <div className="sp-drawer-empty"><TrendingUp size={28} /><p>No attribution data for this contact.</p></div>;
      const groups = [...ATTRIBUTION_GROUPS];
      if (attr.extra && Object.keys(attr.extra).length > 0) groups.push({ title: 'Other Parameters', fields: Object.keys(attr.extra).map(k => [k]), extra: true });
      return groups.map(g => {
        const rows = g.fields.map(([key, label]) => [label || key, g.extra ? attr.extra[key] : attr[key]]).filter(([, v]) => v);
        if (!rows.length) return null;
        return <div key={g.title} className="sp-drawer-group"><h3>{g.title}</h3><dl>
          {rows.map(([label, value]) => <Field key={label} label={label} value={String(value)} copyable wrap />)}
        </dl></div>;
      });
    }

    if (activeTab === 'urls') return contact.visits?.length > 0
      ? <ol className="sp-visits-list">{contact.visits.map(visit => <UrlVisitItem key={visit.id} visit={visit} fmt={fmt} />)}</ol>
      : <div className="sp-drawer-empty"><Globe size={28} /><p>No URL visits recorded yet.</p></div>;

    if (activeTab === 'sales') return contact.sales?.length > 0
      ? contact.sales.map(saleCard)
      : <div className="sp-drawer-empty"><ShoppingCart size={28} /><p>No purchases recorded yet.</p></div>;

    return null;
  };

  return (
    <div className="sp-drawer-body">
      <div className="sp-drawer-title">
        <span className="sp-drawer-avatar">{isLoading ? '' : initialsOf(contact?.name || contact?.email, 'A')}</span>
        {contact && onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" className="sp-secondary-button sp-danger-button" data-testid="contact-detail-delete-button" aria-label="Delete contact" title="Delete contact">
                <Trash2 size={14} /> Delete
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="sp-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>{contact.name || contact.email || 'this contact'}</strong>?
                  This will permanently remove the contact and all their visit history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="sp-secondary-button">Cancel</AlertDialogCancel>
                <AlertDialogAction data-testid="contact-detail-confirm-delete-button" className="sp-danger-solid"
                  onClick={() => { onDelete(contact.contact_id); onClose(); }}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {isLoading ? <span className="sp-skeleton sp-skeleton-title" /> : <h2>{title}</h2>}
      {contact?.email && contact?.name && <p>{contact.email}</p>}
      {contact && <p className="sp-drawer-id">ID: {contact.contact_id}</p>}
      {error ? (
        <div className="sp-drawer-note sp-drawer-error"><AlertCircle size={17} /><span>{error.message || 'Failed to load contact data.'}</span></div>
      ) : <>
        <DrawerTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        <div className="sp-drawer-panel">{tabContent()}</div>
      </>}
    </div>
  );
};

// ── ContactDetailModal — the prototype's detail drawer ───────────────────────
// The drawer stays mounted for the open → close lifecycle; only the inner part remounts when contactId changes.
export const ContactDetailModal = ({ contactId, defaultTab = 'overview', open, onClose, onDelete }) => (
  <Drawer open={open} onClose={onClose} eyebrow="Contact / details" label="Contact details"
    testId="contact-detail-modal" closeTestId="contact-detail-modal-close-button">
    {open && contactId ? (
      <ContactInner key={contactId} contactId={contactId} defaultTab={defaultTab} onClose={onClose} onDelete={onDelete} />
    ) : null}
  </Drawer>
);
