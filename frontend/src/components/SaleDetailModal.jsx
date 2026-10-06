import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Code2, Globe } from 'lucide-react';
import { useTimezone } from '@/components/TimezoneContext';
import { Drawer, DrawerTabs, Field, Status, initialsOf, money } from '@/workspace/ui';

const SALE_TONE = { completed: 'green', paid: 'green', refunded: 'red', failed: 'red' };

/**
 * Drawer for unmatched sales (no linked contact). Mirrors the contact drawer's tabs, but shows the sale's details
 * plus empty states for attribution / URL history.
 */
export function SaleDetailModal({ sale, open, onClose }) {
  const [activeTab, setActiveTab] = useState('details');
  const [showRaw,   setShowRaw]   = useState(false);
  const { formatDateTime } = useTimezone();

  if (!sale) return null;
  const fmtAmt = sale.amount != null ? money(sale.amount, sale.currency) : null;

  const tabs = [
    { id: 'details',     label: 'Sale Details' },
    { id: 'attribution', label: 'Attribution' },
    { id: 'urls',        label: 'URL History' },
  ];

  const tabContent = () => {
    if (activeTab === 'details') return <>
      <div className="sp-sale-hero">
        <span className="sp-eyebrow">{sale.product || 'Purchase'}</span>
        {fmtAmt && <strong>{fmtAmt}</strong>}
        <Status tone={SALE_TONE[sale.status?.toLowerCase()] || 'amber'}>{sale.status || 'completed'}</Status>
      </div>
      <h3>Record information</h3>
      <dl>
        <Field label="Email" value={sale.email} />
        <Field label="Product" value={sale.product} />
        <Field label="Amount" value={fmtAmt} />
        <Field label="Source" value={sale.source} />
        <Field label="Status" value={sale.status} />
        <Field label="Date" value={sale.created_at && formatDateTime(sale.created_at)} />
        <Field label="Sale ID" value={sale.id} wrap />
      </dl>
      {sale.raw_data && Object.keys(sale.raw_data).length > 0 && <>
        <button type="button" className="sp-raw-toggle" onClick={() => setShowRaw(v => !v)}>
          <Code2 size={13} /> {showRaw ? 'Hide' : 'Show'} raw webhook payload {showRaw ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showRaw && <pre className="sp-raw">{JSON.stringify(sale.raw_data, null, 2)}</pre>}
      </>}
    </>;
    if (activeTab === 'attribution') return (
      <div className="sp-drawer-empty"><Activity size={28} /><p>No attribution data recorded yet</p>
        <small>Attribution is captured from UTM parameters when a visitor arrives from an ad. This sale is not linked to a tracked contact.</small></div>
    );
    if (activeTab === 'urls') return (
      <div className="sp-drawer-empty"><Globe size={28} /><p>No URL history recorded yet</p>
        <small>URL visit history is only available for contacts tracked by the Shumard script. This sale has no linked contact.</small></div>
    );
    return null;
  };

  return (
    <Drawer open={open} onClose={onClose} eyebrow="Sale / details" label="Sale details" testId="sale-detail-modal">
      <div className="sp-drawer-body">
        <span className="sp-drawer-avatar">{initialsOf(sale.email, '$')}</span>
        <h2>{sale.email || 'Unknown Contact'}</h2>
        <p>Unmatched sale · no contact record found</p>
        <DrawerTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        <div className="sp-drawer-panel">{tabContent()}</div>
      </div>
    </Drawer>
  );
}
