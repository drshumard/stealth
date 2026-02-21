import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, RefreshCw, ShoppingCart, TrendingUp,
  CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  User, Mail, Package, Tag, Calendar, Code2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function fmtCurrency(amount, currency = 'USD') {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS = {
  completed:  { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', icon: CheckCircle2 },
  paid:       { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', icon: CheckCircle2 },
  success:    { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', icon: CheckCircle2 },
  pending:    { bg: '#fffbeb', text: '#92400e', border: '#fcd34d', icon: Clock },
  processing: { bg: '#fffbeb', text: '#92400e', border: '#fcd34d', icon: Clock },
  refunded:   { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', icon: XCircle },
  failed:     { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', icon: XCircle },
  cancelled:  { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', icon: XCircle },
};
const defaultStatus = { bg: '#f8f7f4', text: 'var(--text-muted)', border: 'var(--stroke)', icon: Clock };

function StatusPill({ status }) {
  const s = STATUS[status?.toLowerCase()] || defaultStatus;
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      <Icon size={11} />{status || 'unknown'}
    </span>
  );
}

/* ── Structured breakdown replaces the raw JSON dump ── */
function SaleDetail({ sale }) {
  const [showRaw, setShowRaw] = useState(false);

  const fields = [
    { icon: Mail,     label: 'Email',    value: sale.contact_email || sale.email },
    { icon: Package,  label: 'Product',  value: sale.product },
    { icon: DollarSign, label: 'Amount', value: fmtCurrency(sale.amount, sale.currency) },
    { icon: Tag,      label: 'Source',   value: sale.source },
    { icon: Calendar, label: 'Date',     value: fmtDate(sale.created_at) },
  ].filter(f => f.value);

  return (
    <div className="px-6 pb-5 pt-1">
      {/* Structured fields */}
      <div className="rounded-2xl border overflow-hidden mb-3"
        style={{ borderColor: 'var(--stroke)', backgroundColor: '#fafaf8' }}>
        {fields.map((f, i) => (
          <div key={f.label}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: i < fields.length - 1 ? '1px solid var(--stroke)' : 'none' }}>
            <f.icon size={14} style={{ color: 'var(--brand-navy)', opacity: 0.5, flexShrink: 0 }} />
            <span className="text-xs font-bold uppercase tracking-wide w-16 shrink-0"
              style={{ color: 'var(--text-dim)' }}>
              {f.label}
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{f.value}</span>
          </div>
        ))}
      </div>

      {/* Raw payload toggle */}
      {sale.raw_data && Object.keys(sale.raw_data).length > 0 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); setShowRaw(v => !v); }}
            className="flex items-center gap-1.5 text-xs font-semibold mb-2 transition-colors"
            style={{ color: 'var(--text-dim)' }}
          >
            <Code2 size={12} />
            {showRaw ? 'Hide' : 'Show'} raw payload
            {showRaw ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showRaw && (
            <pre className="text-xs rounded-xl p-4 overflow-auto max-h-52"
              style={{ backgroundColor: '#f2f3f9', border: '1.5px solid #d2d8ef',
                       fontFamily: 'IBM Plex Mono, monospace', color: '#030352', lineHeight: 1.6 }}>
              {JSON.stringify(sale.raw_data, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

function SaleRow({ sale, onSelectContact }) {
  const [open, setOpen] = useState(false);
  const sc    = STATUS[sale.status?.toLowerCase()] || defaultStatus;
  const isLinked = !!sale.contact_id;

  const handleRowClick = () => {
    if (isLinked) {
      onSelectContact?.(sale.contact_id);
    } else {
      setOpen(v => !v);   // unmatched → expand structured details inline
    }
  };

  return (
    <div className="border-b last:border-0 transition-colors"
      style={{ borderColor: 'var(--stroke)', backgroundColor: open ? '#faf9f7' : 'transparent' }}>

      {/* Main row */}
      <div
        className={`flex items-center gap-4 px-6 py-4 transition-colors duration-120 ${
          isLinked ? 'cursor-pointer hover:bg-[#faf9f7]' : 'cursor-pointer hover:bg-[#faf9f7]'
        }`}
        onClick={handleRowClick}
      >
        {/* Contact / product */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isLinked
              ? <User size={13} style={{ color: 'var(--brand-navy)', opacity: 0.5, flexShrink: 0 }} />
              : <User size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
            <span className="text-sm font-bold"
              style={{ color: isLinked ? 'var(--brand-navy)' : 'var(--text-muted)' }}>
              {sale.contact_name || sale.contact_email || sale.email || 'Unknown'}
            </span>
            {sale.contact_name && sale.contact_email && (
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{sale.contact_email}</span>
            )}
            {isLinked && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(3,3,82,0.07)', color: '#030352' }}>
                view →
              </span>
            )}
          </div>
          {sale.product && (
            <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {sale.product}
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="text-right shrink-0 min-w-[80px]">
          <div className="text-base font-bold tabular-nums"
            style={{ color: '#030352', fontFamily: 'Space Grotesk, sans-serif' }}>
            {fmtCurrency(sale.amount, sale.currency)}
          </div>
          {sale.source && (
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{sale.source}</div>
          )}
        </div>

        {/* Status */}
        <div className="shrink-0 w-28 text-right">
          <StatusPill status={sale.status} />
        </div>

        {/* Date */}
        <div className="text-right shrink-0 hidden md:block w-36">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(sale.created_at)}</div>
        </div>

        {/* Expand indicator (only for unmatched) */}
        {!isLinked && (
          open
            ? <ChevronUp  size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            : <ChevronDown size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        )}
      </div>

      {/* Inline detail panel — only for unmatched sales */}
      {!isLinked && open && <SaleDetail sale={sale} />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border p-6 relative overflow-hidden"
      style={{ border: `1.5px solid ${accent}28`,
               background: `radial-gradient(ellipse at top right, ${accent}1a 0%, ${accent}08 55%, #fff 100%)` }}>
      <div className="absolute -right-3 -top-3 opacity-[0.06] pointer-events-none" aria-hidden>
        <Icon size={80} color={accent} />
      </div>
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accent}15` }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest"
          style={{ color: accent, opacity: 0.7 }}>{label}</span>
      </div>
      <div className="text-4xl font-bold tabular-nums relative z-10"
        style={{ fontFamily: 'Space Grotesk, sans-serif', color: accent, letterSpacing: '-0.03em' }}>
        {value}
      </div>
    </div>
  );
}

export default function SalesPage({ onSelectContact }) {
  const [sales,   setSales]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sales`);
      if (!res.ok) throw new Error();
      setSales(await res.json());
    } catch { setSales([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchSales();
    const t = setInterval(fetchSales, 20000);
    return () => clearInterval(t);
  }, [fetchSales]);

  const stats = useMemo(() => {
    const total   = sales.length;
    const revenue = sales.reduce((s, x) => s + (x.amount || 0), 0);
    const matched = sales.filter(s => s.contact_id).length;
    const avg     = total > 0 ? revenue / total : 0;
    return { total, revenue, matched, avg };
  }, [sales]);

  return (
    <div className="p-8 md:p-10">
      {/* Tinted header */}
      <div className="rounded-2xl px-8 py-7 mb-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 50%, #f9f8f5 100%)',
                 border: '1.5px solid #d2d8ef' }}>
        <DollarSign size={140}
          className="absolute -right-6 -bottom-6 opacity-[0.05] pointer-events-none"
          color="#030352" aria-hidden />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold"
              style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)',
                       letterSpacing: '-0.02em' }}>
              Sales
            </h1>
            <p className="text-base mt-1 font-semibold"
              style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>
              {stats.total} sale{stats.total !== 1 ? 's' : ''} · {stats.matched} matched to contacts
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchSales}
            className="h-9 w-9 p-0 rounded-lg mt-1"
            style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      {!loading && sales.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <StatCard
            icon={DollarSign} label="Total Revenue" accent="#030352"
            value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
              minimumFractionDigits: 0 }).format(stats.revenue)}
          />
          <StatCard
            icon={ShoppingCart} label="Total Sales" accent="#A31800"
            value={stats.total}
          />
          <StatCard
            icon={TrendingUp} label="Avg Order" accent="#059669"
            value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
              minimumFractionDigits: 0 }).format(stats.avg)}
          />
        </div>
      )}

      {/* Webhook URL */}
      <div className="rounded-2xl border p-5 mb-6 relative overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at top left, #fce8e4 0%, #fdf4f2 50%, #fff8f7 100%)',
                 border: '1.5px solid #f0c0b8' }}>
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-7xl font-mono font-bold opacity-[0.05] pointer-events-none select-none"
          style={{ color: '#A31800' }} aria-hidden>
          {'{}'}
        </div>
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-wide mb-1"
            style={{ color: 'var(--brand-red)' }}>
            Webhook Endpoint
          </p>
          <p className="text-sm font-mono select-all"
            style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--brand-navy)', fontWeight: 600 }}>
            POST {BACKEND_URL}/api/sales/webhook
          </p>
          <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
            Send any JSON payload — Tether auto-extracts email, amount, product and links to a matching contact. Click a matched sale to open the contact profile.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff',
                 boxShadow: '0 4px 20px rgba(3,3,82,0.06)' }}>

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b"
          style={{ borderColor: 'var(--stroke)',
                   background: 'linear-gradient(to bottom, #eef0f8, #f4f5fb)' }}>
          <span className="flex-1 text-xs font-bold uppercase tracking-wide"
            style={{ color: '#030352', opacity: 0.65 }}>Contact / Product</span>
          <span className="text-xs font-bold uppercase tracking-wide text-right min-w-[80px]"
            style={{ color: '#030352', opacity: 0.65 }}>Amount</span>
          <span className="text-xs font-bold uppercase tracking-wide text-right w-28"
            style={{ color: '#030352', opacity: 0.65 }}>Status</span>
          <span className="text-xs font-bold uppercase tracking-wide text-right w-36 hidden md:block"
            style={{ color: '#030352', opacity: 0.65 }}>Date</span>
          <span className="w-4" />
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3,4].map(i =>
              <Skeleton key={i} className="h-14 rounded-xl" style={{ backgroundColor: '#f0ede8' }} />
            )}
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #e8ebf5, #f2f3f9)' }}>
              <ShoppingCart size={28} style={{ color: '#030352' }} />
            </div>
            <div className="text-center">
              <p className="text-base font-bold mb-1"
                style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif' }}>
                No sales yet
              </p>
              <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
                POST a sale payload to the webhook above. Tether will match it to a contact by email.
              </p>
            </div>
          </div>
        ) : (
          sales.map(sale =>
            <SaleRow key={sale.id} sale={sale} onSelectContact={onSelectContact} />
          )
        )}
      </div>
    </div>
  );
}
