import { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Clock, Globe, User, Mail, Phone, Hash, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
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
    u.searchParams.forEach((val, key) => {
      params.push({ key, val });
    });
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
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-6 w-6 p-0 shrink-0"
      style={{ color: copied ? 'var(--mint-success)' : 'var(--text-dim)' }}
      aria-label={label || 'Copy'}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </Button>
  );
};

const InfoRow = ({ icon: Icon, label, value, mono, copyable }) => (
  <div className="flex items-start gap-3 py-2.5">
    <div className="mt-0.5">
      <Icon size={14} style={{ color: 'var(--text-dim)' }} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs mb-0.5" style={{ color: 'var(--text-dim)' }}>{label}</div>
      <div
        className={`text-sm break-all ${mono ? 'font-mono' : ''}`}
        style={{ color: value ? 'var(--text)' : 'var(--text-dim)', fontFamily: mono ? 'IBM Plex Mono, monospace' : undefined }}
      >
        {value || '—'}
      </div>
    </div>
    {copyable && value && <CopyButton text={value} label={`Copy ${label}`} />}
  </div>
);

const UrlVisitItem = ({ visit, index }) => {
  const { base, params } = parseUrlParams(visit.current_url || '');
  const { base: refBase, params: refParams } = parseUrlParams(visit.referrer_url || '');

  return (
    <div
      data-testid="contact-url-row"
      className="relative pl-6 pb-5"
    >
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-2 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
        style={{
          backgroundColor: 'var(--bg-elev-2)',
          borderColor: index === 0 ? 'var(--primary-cyan)' : 'var(--stroke)',
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: index === 0 ? 'var(--primary-cyan)' : 'var(--text-dim)' }}
        />
      </div>

      <div
        className="rounded-lg p-3 border"
        style={{
          backgroundColor: 'var(--bg-elev-2)',
          borderColor: 'var(--stroke)',
        }}
      >
        {/* Timestamp + title */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Clock size={11} style={{ color: 'var(--text-dim)' }} />
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {formatDateTime(visit.timestamp)}
            </span>
          </div>
          {visit.page_title && (
            <Badge
              variant="secondary"
              className="text-xs px-2 py-0 max-w-[140px] truncate"
              style={{
                backgroundColor: 'rgba(21,184,200,0.08)',
                color: 'var(--primary-cyan)',
                border: '1px solid rgba(21,184,200,0.15)',
              }}
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
            <CopyButton data-testid="copy-url-button" text={visit.current_url} label="Copy URL" />
          </div>
          <div
            className="text-xs break-all font-mono"
            style={{ color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' }}
          >
            {base}
          </div>
          {params.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {params.map(({ key, val }) => (
                <Badge
                  key={key}
                  variant="secondary"
                  className="text-xs font-mono px-1.5 py-0"
                  style={{
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    color: 'var(--amber-warn)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                >
                  {key}={val}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Referrer URL */}
        {visit.referrer_url && (
          <div>
            <Separator className="my-2" style={{ backgroundColor: 'var(--stroke)' }} />
            <div className="flex items-center gap-1.5 mb-1">
              <ExternalLink size={11} style={{ color: 'var(--text-dim)' }} />
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Referrer</span>
            </div>
            <div
              className="text-xs break-all font-mono"
              style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              {refBase}
            </div>
            {refParams.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {refParams.map(({ key, val }) => (
                  <Badge
                    key={key}
                    variant="secondary"
                    className="text-xs font-mono px-1.5 py-0"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--stroke)',
                      fontFamily: 'IBM Plex Mono, monospace',
                    }}
                  >
                    {key}={val}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const ContactDetailModal = ({ contactId, open, onClose }) => {
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !contactId) return;
    setLoading(true);
    setContact(null);
    fetch(`${BACKEND_URL}/api/contacts/${contactId}`)
      .then(r => r.json())
      .then(data => {
        setContact(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, contactId]);

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
            <DialogClose
              data-testid="contact-detail-modal-close-button"
              className="shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity duration-150"
              aria-label="Close contact detail"
            >
              <X size={16} style={{ color: 'var(--text-muted)' }} />
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 mt-4">
          <Tabs defaultValue="overview">
            <TabsList
              className="h-8 mb-4"
              style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--stroke)' }}
            >
              <TabsTrigger
                data-testid="contact-overview-tab"
                value="overview"
                className="text-xs data-[state=active]:text-white"
                style={{ fontFamily: 'Work Sans, sans-serif' }}
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                data-testid="contact-urls-tab"
                value="urls"
                className="text-xs data-[state=active]:text-white"
                style={{ fontFamily: 'Work Sans, sans-serif' }}
              >
                URL History
                {contact && (
                  <Badge
                    className="ml-1.5 text-xs px-1.5 py-0 h-4 [font-variant-numeric:tabular-nums]"
                    style={{
                      backgroundColor: 'rgba(21,184,200,0.15)',
                      color: 'var(--primary-cyan)',
                      border: 'none',
                    }}
                  >
                    {contact.visits?.length || 0}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" style={{ backgroundColor: 'var(--stroke)' }} />
                  ))}
                </div>
              ) : contact ? (
                <div
                  className="rounded-xl border divide-y"
                  style={{
                    borderColor: 'var(--stroke)',
                    backgroundColor: 'var(--bg-elev-2)',
                    divideColor: 'var(--stroke)',
                  }}
                >
                  <div className="px-4">
                    <InfoRow icon={User} label="Full Name" value={contact.name} />
                  </div>
                  <div className="px-4" style={{ borderColor: 'var(--stroke)' }}>
                    <InfoRow icon={Mail} label="Email" value={contact.email} copyable />
                  </div>
                  <div className="px-4" style={{ borderColor: 'var(--stroke)' }}>
                    <InfoRow icon={Phone} label="Phone" value={contact.phone} />
                  </div>
                  <div className="px-4" style={{ borderColor: 'var(--stroke)' }}>
                    <InfoRow
                      icon={Hash}
                      label="Contact ID"
                      value={contact.contact_id}
                      mono
                      copyable
                    />
                  </div>
                  <div className="px-4" style={{ borderColor: 'var(--stroke)' }}>
                    <InfoRow icon={Calendar} label="First Seen" value={formatDateTime(contact.created_at)} />
                  </div>
                  <div className="px-4" style={{ borderColor: 'var(--stroke)' }}>
                    <InfoRow icon={Calendar} label="Last Updated" value={formatDateTime(contact.updated_at)} />
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Failed to load contact.</p>
              )}
            </TabsContent>

            {/* URL History Tab */}
            <TabsContent value="urls">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" style={{ backgroundColor: 'var(--stroke)' }} />
                  ))}
                </div>
              ) : contact?.visits && contact.visits.length > 0 ? (
                <ScrollArea className="h-[420px] pr-2">
                  <div className="url-timeline-rail">
                    {contact.visits.map((visit, i) => (
                      <UrlVisitItem key={visit.id} visit={visit} index={i} />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-12 gap-2"
                  style={{ color: 'var(--text-dim)' }}
                >
                  <Globe size={32} />
                  <p className="text-sm">No URL visits recorded yet.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
