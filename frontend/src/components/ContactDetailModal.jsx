import { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Clock, Globe, User, Mail, Phone, Hash, Calendar, Tag, TrendingUp, AlertCircle, Wifi, GitMerge, Layers, Trash2 } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  <div className="flex items-start gap-3 py-2.5 px-4">
    <div className="mt-0.5 shrink-0">
      <Icon size={14} style={{ color: accent || 'var(--text-dim)' }} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs mb-0.5" style={{ color: 'var(--text-dim)' }}>{label}</div>
      <div
        className={`text-sm break-all ${mono ? 'font-mono' : ''}`}
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

export const ContactDetailModal = ({ contactId, open, onClose, onDelete }) => {
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !contactId) { setContact(null); return; }
    setLoading(true);
    setError(null);
    fetch(`${BACKEND_URL}/api/contacts/${contactId}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(data => { setContact(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [open, contactId]);

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
        className="max-w-4xl p-0 overflow-hidden border"
        style={{
          backgroundColor: '#ffffff',
          borderColor: 'var(--stroke)',
          color: 'var(--text)',
          maxHeight: '92vh',
          boxShadow: 'var(--shadow)',
        }}
      >
        <DialogHeader className="px-8 pt-6 pb-0" style={{ backgroundColor: '#fafaf8', borderBottom: '1px solid var(--stroke)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle
                className="text-base font-semibold mb-0.5"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
              >
                {loading ? (
                  <Skeleton className="h-5 w-40" style={{ backgroundColor: 'var(--stroke)' }} />
                ) : (
                  contact?.name || contact?.email || 'Anonymous Contact'
                )}
              </DialogTitle>
              {contact && (
                <p className="text-xs font-mono" style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono, monospace' }}>
                  ID: {contact.contact_id}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {contact && onDelete && (
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
                        Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{contact.name || contact.email || 'this contact'}</strong>?
                        This will permanently remove the contact and all their visit history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        style={{ backgroundColor: '#ffffff', borderColor: 'var(--stroke)', color: 'var(--text)' }}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        data-testid="contact-detail-confirm-delete-button"
                        onClick={() => { onDelete(contact.contact_id); onClose(); }}
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

        <div className="px-8 pb-8 mt-5 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 130px)' }}>
          {error ? (
            <div className="flex items-center gap-2 py-4" style={{ color: 'var(--red-error)' }}>
              <AlertCircle size={16} />
              <span className="text-sm">Failed to load contact data.</span>
            </div>
          ) : (
            <Tabs defaultValue="overview">
              <TabsList className="h-10 mb-5 gap-1 p-1" style={{ backgroundColor: '#f5f3ef', border: '1px solid var(--stroke)' }}>
                <TabsTrigger data-testid="contact-overview-tab" value="overview" className="text-sm font-medium px-5">
                  Overview
                </TabsTrigger>
                <TabsTrigger data-testid="contact-attribution-tab" value="attribution" className="text-sm font-medium px-5">
                  Attribution
                  {hasAttribution && (
                    <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--mint-success)' }} />
                  )}
                </TabsTrigger>
                <TabsTrigger data-testid="contact-urls-tab" value="urls" className="text-sm font-medium px-5">
                  URL History
                  {contact && (
                    <span className="ml-2 inline-flex items-center justify-center text-xs font-bold w-5 h-5 rounded-full" style={{ backgroundColor: 'var(--brand-navy)', color: '#fff' }}>
                      {contact.visits?.length || 0}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview">
                {loading ? (
                  <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" style={{ backgroundColor: 'var(--stroke)' }} />)}</div>
                ) : contact ? (
                  <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}>
                    <InfoRow icon={User}     label="Full Name"  value={contact.name}  />
                    <InfoRow icon={Mail}     label="Email"      value={contact.email} copyable />
                    <InfoRow icon={Phone}    label="Phone"      value={contact.phone} />
                    <InfoRow icon={Hash}     label="Contact ID" value={contact.contact_id} mono copyable />
                    <InfoRow icon={Wifi}     label="IP Address" value={contact.client_ip} mono />
                    <InfoRow icon={Layers}   label="Session ID" value={contact.session_id} mono copyable />
                    <InfoRow icon={Calendar} label="First Seen" value={formatDateTime(contact.created_at)} />
                    <InfoRow icon={Calendar} label="Last Updated" value={formatDateTime(contact.updated_at)} />
                    {contact.merged_children && contact.merged_children.length > 0 && (
                      <div className="flex items-start gap-3 py-2.5 px-4">
                        <div className="mt-0.5 shrink-0"><GitMerge size={14} style={{ color: 'var(--mint-success)' }} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>
                            Stitched Identities ({contact.merged_children.length})
                          </div>
                          <div className="flex flex-col gap-1">
                            {contact.merged_children.map(cid => (
                              <span key={cid} className="text-xs font-mono break-all"
                                style={{ color: 'var(--mint-success)', fontFamily: 'IBM Plex Mono, monospace' }}
                              >{cid}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </TabsContent>

              {/* Attribution */}
              <TabsContent value="attribution">
                {loading ? (
                  <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" style={{ backgroundColor: 'var(--stroke)' }} />)}</div>
                ) : contact ? (
                  <div className="space-y-4">
                    {hasAttribution ? (
                      <>
                        {/* UTM Parameters */}
                        {(contact.attribution?.utm_source || contact.attribution?.utm_medium || contact.attribution?.utm_campaign || contact.attribution?.utm_term || contact.attribution?.utm_content || contact.attribution?.utm_id) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-dim)' }}>UTM Parameters</p>
                            <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}>
                              <AttrRow label="utm_source"   value={contact.attribution?.utm_source} />
                              <AttrRow label="utm_medium"   value={contact.attribution?.utm_medium} />
                              <AttrRow label="utm_campaign" value={contact.attribution?.utm_campaign} />
                              <AttrRow label="utm_term"     value={contact.attribution?.utm_term} />
                              <AttrRow label="utm_content"  value={contact.attribution?.utm_content} />
                              <AttrRow label="utm_id"       value={contact.attribution?.utm_id} />
                            </div>
                          </div>
                        )}

                        {/* Ad Platform IDs */}
                        {(contact.attribution?.campaign_id || contact.attribution?.adset_id || contact.attribution?.ad_id || contact.attribution?.fb_ad_set_id || contact.attribution?.google_campaign_id) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-dim)' }}>Ad Platform IDs</p>
                            <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}>
                              <AttrRow label="campaign_id"        value={contact.attribution?.campaign_id} />
                              <AttrRow label="adset_id"           value={contact.attribution?.adset_id} />
                              <AttrRow label="ad_id"              value={contact.attribution?.ad_id} />
                              <AttrRow label="fb_ad_set_id"       value={contact.attribution?.fb_ad_set_id} />
                              <AttrRow label="google_campaign_id" value={contact.attribution?.google_campaign_id} />
                            </div>
                          </div>
                        )}

                        {/* Click IDs */}
                        {(contact.attribution?.fbclid || contact.attribution?.gclid || contact.attribution?.ttclid || contact.attribution?.source_link_tag) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-dim)' }}>Click IDs</p>
                            <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}>
                              <AttrRow label="fbclid"          value={contact.attribution?.fbclid} />
                              <AttrRow label="gclid"           value={contact.attribution?.gclid} />
                              <AttrRow label="ttclid"          value={contact.attribution?.ttclid} />
                              <AttrRow label="source_link_tag" value={contact.attribution?.source_link_tag} />
                            </div>
                          </div>
                        )}

                        {/* All Other / Unknown Params */}
                        {contact.attribution?.extra && Object.keys(contact.attribution.extra).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-dim)' }}>Other Parameters</p>
                            <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff' }}>
                              {Object.entries(contact.attribution.extra).map(([k, v]) => (
                                <AttrRow key={k} label={k} value={v} />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--text-dim)' }}>
                        <TrendingUp size={32} />
                        <p className="text-sm">No attribution data for this contact.</p>
                        <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-dim)' }}>
                          Attribution is captured from UTM params, fbclid, gclid and other URL parameters when a visitor arrives from an ad.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </TabsContent>

              {/* URL History */}
              <TabsContent value="urls">
                {loading ? (
                  <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" style={{ backgroundColor: 'var(--stroke)' }} />)}</div>
                ) : contact?.visits && contact.visits.length > 0 ? (
                  <ScrollArea className="h-[420px]">
                    <div className="url-timeline-rail pr-4">
                      {contact.visits.map((visit, i) => (
                        <UrlVisitItem key={visit.id} visit={visit} index={i} />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--text-dim)' }}>
                    <Globe size={32} />
                    <p className="text-sm">No URL visits recorded yet.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
