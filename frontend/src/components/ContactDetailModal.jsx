import { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Clock, Globe, User, Mail, Phone, Hash, Calendar, Tag, TrendingUp, AlertCircle, Wifi, GitMerge, Layers, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
    <div className="flex items-start gap-3 py-2 px-4">
      <div className="text-xs w-40 shrink-0" style={{ color: 'var(--text-dim)' }}>{label}</div>
      <div
        className="text-xs break-all font-mono flex-1"
        style={{ color: 'var(--amber-warn)', fontFamily: 'IBM Plex Mono, monospace' }}
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
    <div data-testid="contact-url-row" className="relative pl-6 pb-5">
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-2 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
        style={{
          backgroundColor: 'var(--bg-elev-2)',
          borderColor: index === 0 ? 'var(--primary-cyan)' : 'var(--stroke)',
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: index === 0 ? 'var(--primary-cyan)' : 'var(--text-dim)' }}
        />
      </div>

      <div className="rounded-lg p-3 border" style={{ backgroundColor: 'var(--bg-elev-2)', borderColor: 'var(--stroke)' }}>
        {/* Timestamp + title */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Clock size={11} style={{ color: 'var(--text-dim)' }} />
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatDateTime(visit.timestamp)}</span>
          </div>
          {visit.page_title && (
            <Badge variant="secondary" className="text-xs px-2 py-0 max-w-[160px] truncate"
              style={{ backgroundColor: 'rgba(21,184,200,0.08)', color: 'var(--primary-cyan)', border: '1px solid rgba(21,184,200,0.15)' }}
            >
              {visit.page_title}
            </Badge>
          )}
        </div>

        {/* Current URL */}
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Globe size={11} style={{ color: 'var(--primary-cyan)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Current URL</span>
            <CopyButton text={visit.current_url} label="Copy URL" />
          </div>
          <div className="text-xs break-all font-mono" style={{ color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' }}>
            {base}
          </div>
          {params.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {params.map(({ key, val }) => (
                <Badge key={key} variant="secondary" className="text-xs font-mono px-1.5 py-0"
                  style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: 'var(--amber-warn)', border: '1px solid rgba(245,158,11,0.2)', fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  {key}={val}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Referrer */}
        {visit.referrer_url && (
          <div>
            <Separator className="my-2" style={{ backgroundColor: 'var(--stroke)' }} />
            <div className="flex items-center gap-1.5 mb-1">
              <ExternalLink size={11} style={{ color: 'var(--text-dim)' }} />
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Referrer</span>
            </div>
            <div className="text-xs break-all font-mono" style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
              {refBase}
            </div>
            {refParams.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {refParams.map(({ key, val }) => (
                  <Badge key={key} variant="secondary" className="text-xs font-mono px-1.5 py-0"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--stroke)', fontFamily: 'IBM Plex Mono, monospace' }}
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
          <div className="mt-2">
            <Separator className="my-2" style={{ backgroundColor: 'var(--stroke)' }} />
            <div className="flex items-center gap-1.5 mb-1.5">
              <Tag size={11} style={{ color: 'var(--mint-success)' }} />
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Attribution (this visit)</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(visit.attribution)
                .filter(([k, v]) => v && k !== 'extra' && typeof v === 'string')
                .map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-xs font-mono px-1.5 py-0"
                    style={{ backgroundColor: 'rgba(69,209,156,0.08)', color: 'var(--mint-success)', border: '1px solid rgba(69,209,156,0.15)', fontFamily: 'IBM Plex Mono, monospace' }}
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

export const ContactDetailModal = ({ contactId, open, onClose }) => {
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

  const hasAttribution = contact?.attribution && Object.values(contact.attribution).some(v => v && typeof v !== 'object');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        data-testid="contact-detail-modal"
        className="max-w-3xl p-0 overflow-hidden border"
        style={{
          backgroundColor: 'var(--bg-elev-1)',
          borderColor: 'var(--stroke)',
          color: 'var(--text)',
          maxHeight: '90vh',
        }}
      >
        <DialogHeader className="px-6 pt-5 pb-0">
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
        </DialogHeader>

        <div className="px-6 pb-6 mt-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {error ? (
            <div className="flex items-center gap-2 py-4" style={{ color: 'var(--red-error)' }}>
              <AlertCircle size={16} />
              <span className="text-sm">Failed to load contact data.</span>
            </div>
          ) : (
            <Tabs defaultValue="overview">
              <TabsList className="h-8 mb-4" style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--stroke)' }}>
                <TabsTrigger data-testid="contact-overview-tab" value="overview" className="text-xs data-[state=active]:text-white">
                  Overview
                </TabsTrigger>
                <TabsTrigger data-testid="contact-attribution-tab" value="attribution" className="text-xs data-[state=active]:text-white">
                  Attribution
                  {hasAttribution && (
                    <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--mint-success)' }} />
                  )}
                </TabsTrigger>
                <TabsTrigger data-testid="contact-urls-tab" value="urls" className="text-xs data-[state=active]:text-white">
                  URL History
                  {contact && (
                    <Badge className="ml-1.5 text-xs px-1.5 py-0 h-4"
                      style={{ backgroundColor: 'rgba(21,184,200,0.15)', color: 'var(--primary-cyan)', border: 'none' }}
                    >
                      {contact.visits?.length || 0}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview">
                {loading ? (
                  <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" style={{ backgroundColor: 'var(--stroke)' }} />)}</div>
                ) : contact ? (
                  <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--bg-elev-2)' }}>
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
                  <div>
                    {hasAttribution ? (
                      <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--bg-elev-2)' }}>
                        <AttrRow label="UTM Source"   value={contact.attribution?.utm_source} />
                        <AttrRow label="UTM Medium"   value={contact.attribution?.utm_medium} />
                        <AttrRow label="UTM Campaign" value={contact.attribution?.utm_campaign} />
                        <AttrRow label="UTM Term"     value={contact.attribution?.utm_term} />
                        <AttrRow label="UTM Content"  value={contact.attribution?.utm_content} />
                        <AttrRow label="Facebook Click ID" value={contact.attribution?.fbclid} />
                        <AttrRow label="Google Click ID"   value={contact.attribution?.gclid} />
                        <AttrRow label="TikTok Click ID"   value={contact.attribution?.ttclid} />
                        <AttrRow label="Source Link Tag"   value={contact.attribution?.source_link_tag} />
                        <AttrRow label="FB Ad Set ID"       value={contact.attribution?.fb_ad_set_id} />
                        <AttrRow label="Google Campaign ID" value={contact.attribution?.google_campaign_id} />
                        {contact.attribution?.extra && Object.entries(contact.attribution.extra).map(([k, v]) => (
                          <AttrRow key={k} label={k} value={v} />
                        ))}
                      </div>
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
                  <ScrollArea className="h-[420px] pr-2">
                    <div className="url-timeline-rail">
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
