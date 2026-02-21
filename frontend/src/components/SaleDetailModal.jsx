import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, Package, Tag, Calendar, Code2, ChevronDown, ChevronUp, Globe, Activity, CheckCircle2, XCircle, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Modal for unmatched sales (no linked contact).
 * Mirrors the ContactDetailModal structure with the same spring-tab nav,
 * but shows sale details + empty states for attribution / URL history.
 */
export function SaleDetailModal({ sale, open, onClose }) {
  const [activeTab, setActiveTab] = useState('details');
  const [showRaw,   setShowRaw]   = useState(false);

  if (!sale) return null;

  const fmtAmt = sale.amount != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: sale.currency || 'USD', minimumFractionDigits: 0 }).format(sale.amount)
    : null;

  const statusColors = {
    completed:  { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', icon: CheckCircle2 },
    paid:       { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', icon: CheckCircle2 },
    refunded:   { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', icon: XCircle },
    failed:     { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', icon: XCircle },
  };
  const sc  = statusColors[sale.status?.toLowerCase()] || { bg: '#fffbeb', text: '#92400e', border: '#fcd34d', icon: Clock };
  const SI  = sc.icon;

  const tabs = [
    { id: 'details',     label: 'Sale Details' },
    { id: 'attribution', label: 'Attribution' },
    { id: 'urls',        label: 'URL History' },
  ];

  const GridRow = ({ label, value, mono }) => (
    <div className="grid items-center border-b last:border-0"
      style={{ gridTemplateColumns: '148px 1fr', borderColor: 'var(--stroke)' }}>
      <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: '#fafaf8', color: 'var(--text-dim)' }}>
        {label}
      </div>
      <div className={`px-4 py-3 text-sm font-medium ${mono ? 'break-all' : 'truncate'}`}
        style={{ color: value ? 'var(--text)' : 'var(--text-dim)', fontFamily: mono ? 'IBM Plex Mono, monospace' : undefined, fontSize: mono ? '0.72rem' : undefined, fontStyle: !value ? 'italic' : undefined }}>
        {value || 'Not provided'}
      </div>
    </div>
  );

  const tabContent = () => {
    if (activeTab === 'details') return (
      <div className="space-y-4">
        {/* Sale flashcard */}
        <div className="relative rounded-2xl border px-5 py-4 overflow-hidden" style={{ backgroundColor: sc.bg, borderColor: sc.border }}>
          <div className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(5,150,105,0.15)' }}>
            <DollarSign size={16} style={{ color: '#059669' }} />
          </div>
          {fmtAmt && (
            <div className="text-3xl font-bold tabular-nums mb-1 pr-12" style={{ color: sc.text, fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.03em' }}>{fmtAmt}</div>
          )}
          <div className="text-sm font-semibold pr-12 mb-2" style={{ color: sc.text }}>{sale.product || 'Purchase'}</div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border" style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.border }}>
            <SI size={11} />{sale.status || 'completed'}
          </span>
        </div>

        {/* Structured fields */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}>
          <GridRow label="Email"   value={sale.email} />
          <GridRow label="Product" value={sale.product} />
          <GridRow label="Amount"  value={fmtAmt} />
          <GridRow label="Source"  value={sale.source} />
          <GridRow label="Status"  value={sale.status} />
          <GridRow label="Date"    value={sale.created_at ? new Date(sale.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null} />
          <GridRow label="Sale ID" value={sale.id} mono />
        </div>

        {/* Raw payload toggle */}
        {sale.raw_data && Object.keys(sale.raw_data).length > 0 && (
          <>
            <button onClick={() => setShowRaw(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
              style={{ color: 'var(--text-dim)' }}>
              <Code2 size={12} />
              {showRaw ? 'Hide' : 'Show'} raw webhook payload
              {showRaw ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showRaw && (
              <pre className="text-xs rounded-xl p-4 overflow-auto max-h-52"
                style={{ backgroundColor: '#f2f3f9', border: '1.5px solid #d2d8ef', fontFamily: 'IBM Plex Mono, monospace', color: '#030352', lineHeight: 1.6 }}>
                {JSON.stringify(sale.raw_data, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>
    );

    if (activeTab === 'attribution') return (
      <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-dim)' }}>
        <Activity size={36} style={{ opacity: 0.4 }} />
        <p className="text-sm font-semibold">No attribution data recorded yet</p>
        <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-dim)' }}>
          Attribution is captured from UTM parameters when a visitor arrives from an ad. This sale is not linked to a tracked contact.
        </p>
      </div>
    );

    if (activeTab === 'urls') return (
      <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-dim)' }}>
        <Globe size={36} style={{ opacity: 0.4 }} />
        <p className="text-sm font-semibold">No URL history recorded yet</p>
        <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-dim)' }}>
          URL visit history is only available for contacts tracked by the Shumard script. This sale has no linked contact.
        </p>
      </div>
    );

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        hideClose
        data-testid="sale-detail-modal"
        className="max-w-2xl p-0 border flex flex-col overflow-hidden"
        style={{ backgroundColor: '#ffffff', borderColor: 'var(--stroke)', color: 'var(--text)', height: '600px', maxHeight: '92vh', boxShadow: 'var(--shadow)' }}
      >
        {/* Header */}
        <DialogHeader className="px-8 pt-6 pb-0 shrink-0"
          style={{ background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 60%, #f9f8f5 100%)', borderBottom: '1.5px solid #d2d8ef', paddingBottom: '20px' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-bold mb-0.5"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>
                {sale.email || 'Unknown Contact'}
              </DialogTitle>
              <p className="text-xs font-semibold" style={{ color: 'var(--brand-navy)', opacity: 0.55 }}>
                Unmatched sale · no contact record found
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-md p-1 hover:bg-white/20 transition-colors duration-150 mt-0.5"
              style={{ color: 'var(--text-dim)' }}
            >
              <X size={16} />
            </button>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col px-8 pb-8 mt-5 overflow-hidden">
          {/* Spring pill tab bar */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl mb-5 relative shrink-0"
            style={{ backgroundColor: '#f0f1f8', border: '1px solid var(--stroke)', width: 'fit-content' }}>
            {tabs.map(tab => (
              <button key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative px-4 py-1.5 text-sm font-medium rounded-lg z-10 flex items-center gap-1.5"
                style={{ color: activeTab === tab.id ? '#ffffff' : 'var(--text-muted)' }}>
                {activeTab === tab.id && (
                  <motion.div layoutId="sale-modal-tab-pill" className="absolute inset-0 rounded-lg"
                    style={{ backgroundColor: 'var(--brand-navy)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Animated content */}
          <div className="flex-1 min-h-0 overflow-y-auto relative">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={activeTab}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="h-full">
                {tabContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
