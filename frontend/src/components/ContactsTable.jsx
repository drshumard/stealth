import { useState } from 'react';
import { Search, Users, ChevronRight, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

function formatDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export const ContactsTable = ({ contacts, loading, onSelectContact, onCopyScript }) => {
  const [search, setSearch] = useState('');

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-dim)' }}
          />
          <Input
            data-testid="contacts-table-search-input"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm border"
            style={{
              backgroundColor: 'var(--bg-elev-2)',
              borderColor: 'var(--stroke)',
              color: 'var(--text)',
            }}
          />
        </div>
        <Badge
          variant="secondary"
          className="text-xs px-2 py-1 font-mono"
          style={{
            backgroundColor: 'var(--bg-elev-2)',
            borderColor: 'var(--stroke)',
            color: 'var(--text-muted)',
            border: '1px solid',
          }}
        >
          {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--bg-elev-1)' }}
      >
        <Table data-testid="contacts-table">
          <TableHeader>
            <TableRow
              className="border-b hover:bg-transparent"
              style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--bg-elev-2)' }}
            >
              <TableHead
                className="text-xs font-medium uppercase tracking-widest h-10 pl-4"
                style={{ color: 'var(--text-dim)' }}
              >
                Name
              </TableHead>
              <TableHead
                className="text-xs font-medium uppercase tracking-widest h-10"
                style={{ color: 'var(--text-dim)' }}
              >
                Email
              </TableHead>
              <TableHead
                className="text-xs font-medium uppercase tracking-widest h-10 hidden sm:table-cell"
                style={{ color: 'var(--text-dim)' }}
              >
                Phone
              </TableHead>
              <TableHead
                className="text-xs font-medium uppercase tracking-widest h-10 hidden md:table-cell"
                style={{ color: 'var(--text-dim)' }}
              >
                Created
              </TableHead>
              <TableHead
                className="text-xs font-medium uppercase tracking-widest h-10 text-right pr-4"
                style={{ color: 'var(--text-dim)' }}
              >
                Visits
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} style={{ borderColor: 'var(--stroke)' }}>
                  <TableCell className="pl-4"><Skeleton className="h-4 w-28" style={{ backgroundColor: 'var(--stroke)' }} /></TableCell>
                  <TableCell><Skeleton className="h-4 w-44" style={{ backgroundColor: 'var(--stroke)' }} /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-24" style={{ backgroundColor: 'var(--stroke)' }} /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" style={{ backgroundColor: 'var(--stroke)' }} /></TableCell>
                  <TableCell className="pr-4 text-right"><Skeleton className="h-4 w-8 ml-auto" style={{ backgroundColor: 'var(--stroke)' }} /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow style={{ borderColor: 'transparent' }}>
                <TableCell colSpan={5}>
                  <div
                    data-testid="contacts-empty-state"
                    className="flex flex-col items-center justify-center py-16 gap-4"
                  >
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--stroke)' }}
                    >
                      <Users size={24} style={{ color: 'var(--text-dim)' }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                        {search ? 'No contacts match your search' : 'No contacts yet'}
                      </p>
                      <p className="text-xs max-w-sm" style={{ color: 'var(--text-dim)' }}>
                        {search
                          ? 'Try a different name or email address.'
                          : 'Paste the tracking script into your webinar page header and submit a registration form.'}
                      </p>
                    </div>
                    {!search && (
                      <Button
                        data-testid="contacts-empty-state-copy-script"
                        size="sm"
                        onClick={onCopyScript}
                        className="gap-1.5 text-xs"
                        style={{ backgroundColor: 'var(--primary-cyan)', color: 'var(--bg)' }}
                      >
                        <Copy size={12} /> Copy Script
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((contact) => (
                <TableRow
                  data-testid="contacts-table-row"
                  key={contact.contact_id}
                  className="contact-row border-b"
                  style={{ borderColor: 'var(--stroke)' }}
                  onClick={() => onSelectContact(contact.contact_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectContact(contact.contact_id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${contact.name || contact.email || 'Anonymous'}`}
                >
                  <TableCell className="py-3 pl-4">
                    <div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: contact.name ? 'var(--text)' : 'var(--text-dim)' }}
                      >
                        {contact.name || <span className="italic text-xs">Anonymous</span>}
                      </span>
                      <div
                        className="text-xs font-mono mt-0.5"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        {contact.contact_id.substring(0, 8)}…
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-sm" style={{ color: contact.email ? 'var(--text-muted)' : 'var(--text-dim)' }}>
                      {contact.email || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 hidden sm:table-cell">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {contact.phone || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 hidden md:table-cell">
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(contact.created_at)}</div>
                      <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatTime(contact.created_at)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Badge
                        variant="secondary"
                        className="text-xs font-mono [font-variant-numeric:tabular-nums] px-2"
                        style={{
                          backgroundColor: contact.visit_count > 0 ? 'rgba(21,184,200,0.12)' : 'var(--bg-elev-2)',
                          color: contact.visit_count > 0 ? 'var(--primary-cyan)' : 'var(--text-dim)',
                          border: '1px solid',
                          borderColor: contact.visit_count > 0 ? 'rgba(21,184,200,0.2)' : 'var(--stroke)',
                        }}
                      >
                        {contact.visit_count}
                      </Badge>
                      <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
