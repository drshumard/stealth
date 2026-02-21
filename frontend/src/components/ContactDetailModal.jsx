import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { X, Copy, Check, ExternalLink, Clock, Globe, User, Mail, Phone, Hash, Calendar, Tag, TrendingUp, AlertCircle, Wifi, GitMerge, Layers, Trash2, ShoppingCart, DollarSign, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function formatDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

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

const CopyButton = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied!', { duration: 1500 });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      variant="ghost" size="sm"
      onClick={handleCopy}
      className="h-6 w-6 p-0 shrink-0"
      style={{ color: copied ? 'var(--mint-success)' : 'var(--text-dim)' }}
      aria-label={label || 'Copy'}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </Button>
  );
};

const InfoRow = ({ icon: Icon, label, value, mono, copyable, accent }) => (
  <div className="flex items-start gap-4 py-4 px-5">
    <div className="mt-0.5 shrink-0">
      <Icon size={15} style={{ color: accent || 'var(--text-dim)' }} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-dim)' }}>{label}</div>
      <div
        className={`text-sm font-medium break-all ${mono ? 'font-mono' : ''}`}
        style={{
          color: value ? 'var(--text)' : 'var(--text-dim)',
          fontFamily: mono ? 'IBM Plex Mono, monospace' : undefined,
          fontStyle: !value ? 'italic' : undefined,
        }}
      >
        {value || 'Not provided'}
      </div>
    </div>
    {copyable && value && <CopyButton text={value} label={`Copy ${label}`} />}
  </div>
);

const AttrRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 px-4 min-w-0">
      <div className="text-xs w-36 shrink-0" style={{ color: 'var(--text-dim)' }}>{label}</div>
      <div
        className="text-xs font-mono flex-1 min-w-0"
        style={{
          color: 'var(--amber-warn)',
          fontFamily: 'IBM Plex Mono, monospace',
          wordBreak: 'break-all',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </div>
      <CopyButton text={value} label={`Copy ${label}`} />
    </div>
  );
};

const UrlVisitItem = ({ visit, index }) => {
  const { base, params } = parseUrlParams(visit.current_url || '');
  const { base: refBase, params: refParams } = parseUrlParams(visit.referrer_url || '');

  return (
    <div data-testid="contact-url-row" className="relative pl-6 pb-5 min-w-0">
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-2 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
        style={{
          backgroundColor: '#ffffff',
          borderColor: index === 0 ? 'var(--primary-cyan)' : 'var(--stroke)',
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: index === 0 ? 'var(--primary-cyan)' : 'var(--text-dim)' }}
        />
      </div>

      <div className="rounded-lg p-3 border min-w-0 overflow-hidden" style={{ backgroundColor: '#ffffff', borderColor: 'var(--stroke)' }}>
        {/* Timestamp + title */}
        <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Clock size={11} style={{ color: 'var(--text-dim)' }} />
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatDateTime(visit.timestamp)}</span>
          </div>
          {visit.page_title && (
            <Badge variant="secondary" className="text-xs px-2 py-0 max-w-[160px] truncate shrink-0"
              style={{ backgroundColor: 'rgba(21,184,200,0.08)', color: 'var(--primary-cyan)', border: '1px solid rgba(21,184,200,0.15)' }}
            >
              {visit.page_title}
            </Badge>
          )}
        </div>

        {/* Current URL */}
        <div className="mb-2 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Globe size={11} className="shrink-0" style={{ color: 'var(--primary-cyan)' }} />
            <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>Current URL</span>
            <CopyButton text={visit.current_url} label="Copy URL" />
          </div>
          <div
            className="text-xs font-mono"
            style={{
              color: 'var(--text)',
              fontFamily: 'IBM Plex Mono, monospace',
              wordBreak: 'break-all',
              overflowWrap: 'anywhere',
            }}
          >
            {base}
          </div>
          {params.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {params.map(({ key, val }) => (
                <Badge key={key} variant="secondary" className="text-xs font-mono px-1.5 py-0 max-w-full"
                  style={{
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    color: 'var(--amber-warn)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    fontFamily: 'IBM Plex Mono, monospace',
                    wordBreak: 'break-all',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'normal',
                  }}
                >
                  {key}={val}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Referrer */}
        {visit.referrer_url && (
          <div className="min-w-0">
            <Separator className="my-2" style={{ backgroundColor: 'var(--stroke)' }} />
            <div className="flex items-center gap-1.5 mb-1">
              <ExternalLink size={11} className="shrink-0" style={{ color: 'var(--text-dim)' }} />
              <span className="text-xs shrink-0" style={{ color: 'var(--text-dim)' }}>Referrer</span>
            </div>
            <div
              className="text-xs font-mono"
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'IBM Plex Mono, monospace',
                wordBreak: 'break-all',
                overflowWrap: 'anywhere',
              }}
            >
              {refBase}
            </div>
            {refParams.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {refParams.map(({ key, val }) => (
                  <Badge key={key} variant="secondary" className="text-xs font-mono px-1.5 py-0 max-w-full"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--stroke)',
                      fontFamily: 'IBM Plex Mono, monospace',
                      wordBreak: 'break-all',
                      overflowWrap: 'anywhere',
                      whiteSpace: 'normal',
                    }}
                  >
                    {key}={val}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Visit-level attribution */}
        {visit.attribution && Object.values(visit.attribution).some(v => v && typeof v !== 'object') && (
          <div className="mt-2 min-w-0">
            <Separator className="my-2" style={{ backgroundColor: 'var(--stroke)' }} />
            <div className="flex items-center gap-1.5 mb-1.5">
              <Tag size={11} className="shrink-0" style={{ color: 'var(--mint-success)' }} />
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Attribution (this visit)</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(visit.attribution)
                .filter(([k, v]) => v && k !== 'extra' && typeof v === 'string')
                .map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-xs font-mono px-1.5 py-0 max-w-full"
                    style={{
                      backgroundColor: 'rgba(69,209,156,0.08)',
                      color: 'var(--mint-success)',
                      border: '1px solid rgba(69,209,156,0.15)',
                      fontFamily: 'IBM Plex Mono, monospace',
                      wordBreak: 'break-all',
                      overflowWrap: 'anywhere',
                      whiteSpace: 'normal',
                    }}
                  >
                    {k}={v}
                  </Badge>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ContactDetailModal = ({ contactId, defaultTab = 'overview', open, onClose, onDelete }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Reset tab when the modal opens or target contact changes.
  // key={selectedContactId} in App.js already remounts this component on contact change,
  // so this handles only the defaultTab prop changing while the same contact is open.
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // React Query owns all fetch/loading/error state.
  // enabled: open && !!contactId ensures nothing fires until the modal is actually open.
  // With key={selectedContactId} in App.js each contact gets a fresh component instance,
  // so there is zero possibility of stale data leaking from a previous contact.
  const {
    data:      contact,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['contact', contactId],
    queryFn:  () => fetch(`${BACKEND_URL}/api/contacts/${contactId}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); }),
    enabled: open && !!contactId,
  });

  const hasAttribution = contact?.attribution && (
    Object.entries(contact.attribution).some(([k, v]) => {
      if (k === 'extra') return v && typeof v === 'object' && Object.keys(v).length > 0;
      return v && typeof v !== 'object';
    })
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        hideClose
        data-testid="contact-detail-modal"
        className="max-w-4xl p-0 border flex flex-col overflow-hidden"
        style={{
          backgroundColor: '#ffffff',
          borderColor: 'var(--stroke)',
          color: 'var(--text)',
          /* Fixed height — never grows or shrinks regardless of content */
          height: '680px',
          maxHeight: '92vh',
          boxShadow: 'var(--shadow)',
        }}
      >
        <DialogHeader className="px-8 pt-6 pb-0 shrink-0" style={{ background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 60%, #f9f8f5 100%)', borderBottom: '1.5px solid #d2d8ef', paddingBottom: '20px' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle
                className="text-xl font-bold mb-0.5"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}
              >
                {isLoading ? (
                  <Skeleton className="h-6 w-44" style={{ backgroundColor: 'rgba(3,3,82,0.12)' }} />
                ) : (
                  safeContact?.name || safeContact?.email || 'Anonymous Contact'
                )}
              </DialogTitle>
              {isLoading ? (
                <Skeleton className="h-3 w-72 mt-1.5" style={{ backgroundColor: 'rgba(3,3,82,0.08)' }} />
              ) : safeContact ? (
                <p className="text-xs font-mono" style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono, monospace' }}>
                  ID: {safeContact.contact_id}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {safeContact && onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      data-testid="contact-detail-delete-button"
                      className="rounded-md p-1 hover:bg-red-500/10 transition-colors duration-150"
                      aria-label="Delete contact"
                      title="Delete contact"
                      style={{ color: 'var(--red-error, #ef4444)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent
                    style={{ backgroundColor: '#ffffff', borderColor: 'var(--stroke)', color: 'var(--text)' }}
                  >
                    <AlertDialogHeader>
                      <AlertDialogTitle style={{ color: 'var(--text)' }}>Delete Contact</AlertDialogTitle>
                      <AlertDialogDescription style={{ color: 'var(--text-muted)' }}>
                        Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{safeContact.name || safeContact.email || 'this contact'}</strong>?
                        This will permanently remove the contact and all their visit history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel style={{ backgroundColor: '#ffffff', borderColor: 'var(--stroke)', color: 'var(--text)' }}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        data-testid="contact-detail-confirm-delete-button"
                        onClick={() => { onDelete(safeContact.contact_id); onClose(); }}
                        style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <button
                data-testid="contact-detail-modal-close-button"
                onClick={onClose}
                className="shrink-0 rounded-md p-1 hover:bg-white/5 transition-colors duration-150"
                aria-label="Close"
                style={{ color: 'var(--text-dim)' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* flex-1 min-h-0 = fills remaining height without ever growing the modal */}
        <div className="flex-1 min-h-0 flex flex-col px-8 pb-8 mt-5 overflow-hidden">
          {error ? (
            <div className="flex items-center gap-2 py-4" style={{ color: 'var(--red-error)' }}>
              <AlertCircle size={16} />
              <span className="text-sm">Failed to load contact data.</span>
            </div>
          ) : (() => {
            const tabs = [
              { id: 'overview',    label: 'Overview' },
              { id: 'attribution', label: 'Attribution', badge: hasAttribution ? '●' : null, badgeGreen: true },
              { id: 'urls',        label: 'URL History', badge: safeContact?.visits?.length || null },
              { id: 'sales',       label: 'Sales',       badge: safeContact?.sales?.length  || null, badgeRed: true },
            ];

            const tabContent = () => {
              if (isLoading) return (
                <div className="space-y-3 pt-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" style={{ backgroundColor: 'var(--stroke)' }} />)}
                </div>
              );
              if (!safeContact) return null;

              if (activeTab === 'overview') return (
                <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}>
                  <InfoRow icon={User}     label="Full Name"    value={safeContact.name}  />
                  <InfoRow icon={Mail}     label="Email"        value={safeContact.email} copyable />
                  <InfoRow icon={Phone}    label="Phone"        value={safeContact.phone} />
                  <InfoRow icon={Hash}     label="Contact ID"   value={safeContact.contact_id} mono copyable />
                  <InfoRow icon={Wifi}     label="IP Address"   value={safeContact.client_ip} mono />
                  <InfoRow icon={Layers}   label="Session ID"   value={safeContact.session_id} mono copyable />
                  <InfoRow icon={Calendar} label="First Seen"   value={formatDateTime(safeContact.created_at)} />
                  <InfoRow icon={Calendar} label="Last Updated" value={formatDateTime(safeContact.updated_at)} />
                  {safeContact.tags?.length > 0 && (
                    <div className="flex items-start gap-4 py-4 px-5">
                      <div className="mt-0.5 shrink-0"><Tag size={15} style={{ color: 'var(--brand-navy)' }} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-dim)' }}>Tags</div>
                        <div className="flex flex-wrap gap-2">
                          {safeContact.tags.map(tag => (
                            <span key={tag} className="inline-flex items-center text-sm font-bold px-3 py-1 rounded-full"
                              style={{ backgroundColor: 'rgba(3,3,82,0.08)', color: '#030352', border: '1.5px solid rgba(3,3,82,0.18)' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {safeContact.merged_children?.length > 0 && (
                    <div className="flex items-start gap-3 py-2.5 px-4">
                      <div className="mt-0.5 shrink-0"><GitMerge size={14} style={{ color: 'var(--mint-success)' }} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Stitched Identities ({safeContact.merged_children.length})</div>
                        <div className="flex flex-col gap-1">
                          {safeContact.merged_children.map(cid => (
                            <span key={cid} className="text-xs font-mono break-all" style={{ color: 'var(--mint-success)', fontFamily: 'IBM Plex Mono, monospace' }}>{cid}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );

              if (activeTab === 'attribution') return (
                <div className="space-y-4">
                  {hasAttribution ? (<>
                    {(safeContact.attribution?.utm_source || safeContact.attribution?.utm_medium || safeContact.attribution?.utm_campaign || safeContact.attribution?.utm_term || safeContact.attribution?.utm_content || safeContact.attribution?.utm_id) && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-dim)' }}>UTM Parameters</p>
                        <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}>
                          <AttrRow label="utm_source" value={safeContact.attribution?.utm_source} />
                          <AttrRow label="utm_medium" value={safeContact.attribution?.utm_medium} />
                          <AttrRow label="utm_campaign" value={safeContact.attribution?.utm_campaign} />
                          <AttrRow label="utm_term" value={safeContact.attribution?.utm_term} />
                          <AttrRow label="utm_content" value={safeContact.attribution?.utm_content} />
                          <AttrRow label="utm_id" value={safeContact.attribution?.utm_id} />
                        </div>
                      </div>
                    )}
                    {(safeContact.attribution?.campaign_id || safeContact.attribution?.adset_id || safeContact.attribution?.ad_id || safeContact.attribution?.fb_ad_set_id || safeContact.attribution?.google_campaign_id) && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-dim)' }}>Ad Platform IDs</p>
                        <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}>
                          <AttrRow label="campaign_id" value={safeContact.attribution?.campaign_id} />
                          <AttrRow label="adset_id" value={safeContact.attribution?.adset_id} />
                          <AttrRow label="ad_id" value={safeContact.attribution?.ad_id} />
                          <AttrRow label="fb_ad_set_id" value={safeContact.attribution?.fb_ad_set_id} />
                          <AttrRow label="google_campaign_id" value={safeContact.attribution?.google_campaign_id} />
                        </div>
                      </div>
                    )}
                    {(safeContact.attribution?.fbclid || safeContact.attribution?.gclid || safeContact.attribution?.ttclid || safeContact.attribution?.source_link_tag) && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-dim)' }}>Click IDs</p>
                        <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}>
                          <AttrRow label="fbclid" value={safeContact.attribution?.fbclid} />
                          <AttrRow label="gclid" value={safeContact.attribution?.gclid} />
                          <AttrRow label="ttclid" value={safeContact.attribution?.ttclid} />
                          <AttrRow label="source_link_tag" value={safeContact.attribution?.source_link_tag} />
                        </div>
                      </div>
                    )}
                    {safeContact.attribution?.extra && Object.keys(safeContact.attribution.extra).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-dim)' }}>Other Parameters</p>
                        <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}>
                          {Object.entries(safeContact.attribution.extra).map(([k, v]) => <AttrRow key={k} label={k} value={v} />)}
                        </div>
                      </div>
                    )}
                  </>) : (
                    <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--text-dim)' }}>
                      <TrendingUp size={32} /><p className="text-sm">No attribution data for this safeContact.</p>
                    </div>
                  )}
                </div>
              );

              if (activeTab === 'urls') return safeContact.visits?.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="url-timeline-rail pr-4">
                    {safeContact.visits.map((visit, i) => <UrlVisitItem key={visit.id} visit={visit} index={i} />)}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--text-dim)' }}>
                  <Globe size={32} /><p className="text-sm">No URL visits recorded yet.</p>
                </div>
              );

              if (activeTab === 'sales') return safeContact.sales?.length > 0 ? (
                <div className="space-y-3">
                  {safeContact.sales.map(sale => {
                    const scMap = {
                      completed: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', icon: CheckCircle2 },
                      paid:      { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', icon: CheckCircle2 },
                      refunded:  { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', icon: XCircle },
                      failed:    { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', icon: XCircle },
                    };
                    const sc = scMap[sale.status?.toLowerCase()] || { bg: '#fffbeb', text: '#92400e', border: '#fcd34d', icon: Clock };
                    const SI = sc.icon;
                    return (
                      <div key={sale.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: sc.border, backgroundColor: sc.bg }}>
                        <div className="flex items-start justify-between gap-4 px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(3,3,82,0.10)' }}>
                              <ShoppingCart size={17} style={{ color: '#030352' }} />
                            </div>
                            <div>
                              <p className="text-sm font-bold" style={{ color: '#030352', fontFamily: 'Space Grotesk, sans-serif' }}>{sale.product || 'Purchase'}</p>
                              {sale.source && <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-dim)' }}>via {sale.source}</p>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xl font-bold tabular-nums" style={{ color: '#030352', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}>
                              {sale.amount != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: sale.currency || 'USD', minimumFractionDigits: 0 }).format(sale.amount) : '—'}
                            </p>
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mt-1" style={{ backgroundColor: 'rgba(3,3,82,0.08)', color: sc.text }}>
                              <SI size={10} />{sale.status || 'completed'}
                            </span>
                          </div>
                        </div>
                        <div className="px-5 pb-3">
                          <p className="text-xs font-medium" style={{ color: sc.text, opacity: 0.7 }}>
                            {new Date(sale.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--text-dim)' }}>
                  <ShoppingCart size={32} /><p className="text-sm">No purchases recorded yet.</p>
                </div>
              );

              return null;
            };

            return (
              <>
                {/* Spring pill tab bar — shrink-0 so it never flexes */}
                <div className="flex items-center gap-0.5 p-1 rounded-xl mb-5 relative shrink-0"
                  style={{ backgroundColor: '#f0f1f8', border: '1px solid var(--stroke)', width: 'fit-content' }}>
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      data-testid={`contact-${tab.id}-tab`}
                      onClick={() => setActiveTab(tab.id)}
                      className="relative px-4 py-1.5 text-sm font-medium rounded-lg z-10 flex items-center gap-1.5"
                      style={{ color: activeTab === tab.id ? '#ffffff' : 'var(--text-muted)' }}
                    >
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="modal-tab-pill"
                          className="absolute inset-0 rounded-lg"
                          style={{ backgroundColor: 'var(--brand-navy)' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                      {tab.badge && (
                        <span className="relative z-10 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold rounded-full"
                          style={{
                            backgroundColor: activeTab === tab.id
                              ? (tab.badgeRed ? '#A31800' : 'rgba(255,255,255,0.25)')
                              : (tab.badgeGreen ? 'rgba(5,150,105,0.15)' : tab.badgeRed ? 'rgba(163,24,0,0.12)' : 'rgba(3,3,82,0.12)'),
                            color: activeTab === tab.id ? '#fff'
                              : (tab.badgeGreen ? '#059669' : tab.badgeRed ? '#A31800' : '#030352'),
                          }}>
                          {tab.badge === '●' ? '●' : tab.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Fixed-height animated content — flex-1 min-h-0 fills remaining space, overflow-y-auto scrolls */}
                <div className="flex-1 min-h-0 overflow-y-auto relative">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeInOut' }}
                      className="h-full"
                    >
                      {tabContent()}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
