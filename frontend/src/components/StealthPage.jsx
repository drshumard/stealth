import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Shield, CheckCircle2, XCircle, ExternalLink, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function FbBadge({ has }) {
  return has ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
      <CheckCircle2 size={11} /> YES
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: '#f8f7f4', color: 'var(--text-dim)', border: '1px solid var(--stroke)' }}>
      <XCircle size={11} /> NO
    </span>
  );
}

const GRID = '2fr 1.5fr 1.4fr 100px 1fr 80px';

function RegRow({ reg, onSelectContact }) {
  return (
    <div
      className="grid items-center px-6 py-4 border-b last:border-0 hover:bg-[#faf9f7] transition-colors"
      style={{ gridTemplateColumns: GRID, gap: '16px', borderColor: 'var(--stroke)' }}
    >
      {/* Name / email */}
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
          {reg.name || 'Unknown'}
        </div>
        <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {reg.email}
        </div>
      </div>

      {/* Phone */}
      <div className="text-sm truncate" style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem' }}>
        {reg.phone || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontFamily: 'Work Sans, sans-serif' }}>—</span>}
      </div>

      {/* Registered */}
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {timeAgo(reg.registered_at)}
      </div>

      {/* FB Click */}
      <div><FbBadge has={reg.has_fbclid} /></div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 min-w-0">
        {reg.tags?.map(tag => (
          <span key={tag} className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(3,3,82,0.08)', color: '#030352', border: '1px solid rgba(3,3,82,0.15)' }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Open contact */}
      <div className="text-right">
        {reg.contact_id ? (
          <button
            onClick={() => onSelectContact?.(reg.contact_id)}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--brand-navy)', backgroundColor: 'rgba(3,3,82,0.06)', border: '1px solid rgba(3,3,82,0.15)' }}
            title="Open contact"
          >
            <ExternalLink size={11} /> View
          </button>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Unlinked</span>
        )}
      </div>
    </div>
  );
}

export default function StealthPage({ onSelectContact }) {
  const qc = useQueryClient();

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ['stealth'],
    queryFn:  () => fetch(`${BACKEND_URL}/api/stealth`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    refetchInterval: 15_000,
  });

  const total    = regs.length;
  const withFb   = regs.filter(r => r.has_fbclid).length;
  const withPhone = regs.filter(r => r.phone).length;

  return (
    <div className="p-8 md:p-10">
      {/* Tinted header */}
      <div className="rounded-2xl px-8 py-7 mb-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 50%, #f9f8f5 100%)', border: '1.5px solid #d2d8ef' }}>
        <Shield size={140} className="absolute -right-6 -bottom-6 opacity-[0.05] pointer-events-none" color="#030352" aria-hidden />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>
              StealthWebinar
            </h1>
            <p className="text-base mt-1 font-semibold" style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>
              {total} registrant{total !== 1 ? 's' : ''} · {withFb} from Facebook · {withPhone} with phone
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['stealth'] })}
            className="h-9 w-9 p-0 rounded-lg mt-1" style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Webhook URL card */}
      <div className="rounded-2xl border p-5 mb-6 relative overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at top left, #fce8e4 0%, #fdf4f2 50%, #fff8f7 100%)', border: '1.5px solid #f0c0b8' }}>
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-7xl font-mono font-bold opacity-[0.05] pointer-events-none select-none"
          style={{ color: '#A31800' }} aria-hidden>{'{}'}</div>
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--brand-red)' }}>
            Webhook Endpoint — Configure in StealthWebinar
          </p>
          <p className="text-sm font-mono select-all font-bold"
            style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--brand-navy)' }}>
            POST {BACKEND_URL}/api/stealth/webhook
          </p>
          <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
            Accepts any JSON with <code style={{ color: 'var(--brand-navy)' }}>email</code>, <code style={{ color: 'var(--brand-navy)' }}>phone</code>, <code style={{ color: 'var(--brand-navy)' }}>name</code>.
            Automatically links to existing contacts and runs automations requiring phone.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: '0 4px 20px rgba(3,3,82,0.06)' }}>

        {/* Header */}
        <div className="grid items-center px-6 py-4 border-b"
          style={{ gridTemplateColumns: GRID, gap: '16px', borderColor: 'var(--stroke)', background: 'linear-gradient(to bottom, #eef0f8, #f4f5fb)' }}>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#030352', opacity: 0.65 }}>Registrant</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#030352', opacity: 0.65 }}>Phone</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#030352', opacity: 0.65 }}>Registered</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#030352', opacity: 0.65 }}>FB Click</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#030352', opacity: 0.65 }}>Tags</span>
          <span className="text-xs font-bold uppercase tracking-wide text-right" style={{ color: '#030352', opacity: 0.65 }}>Contact</span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" style={{ backgroundColor: '#f0ede8' }} />)}
          </div>
        ) : regs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #e8ebf5, #f2f3f9)' }}>
              <Shield size={28} style={{ color: '#030352' }} />
            </div>
            <div className="text-center">
              <p className="text-base font-bold mb-1" style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif' }}>
                No registrations yet
              </p>
              <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
                Configure StealthWebinar to POST registrations to the webhook URL above.
              </p>
            </div>
          </div>
        ) : (
          regs.map(reg => <RegRow key={reg.id} reg={reg} onSelectContact={onSelectContact} />)
        )}
      </div>
    </div>
  );
}
