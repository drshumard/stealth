import { useState } from 'react';
import { Search, Users, ChevronRight, Copy, Tag, GitMerge } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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

function utmSource(contact) {
  return contact?.attribution?.utm_source || null;
}

export const ContactsTable = ({ contacts, loading, onSelectContact, onCopyScript }) => {
  const [search, setSearch] = useState('');

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.name  && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
          <Input
            data-testid="contacts-table-search-input"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm border"
            style={{ backgroundColor: 'var(--bg-elev-2)', borderColor: 'var(--stroke)', color: 'var(--text)' }}
          />
        </div>
        <Badge variant="secondary" className="text-xs px-2 py-1 font-mono"
          style={{ backgroundColor: 'var(--bg-elev-2)', borderColor: 'var(--stroke)', color: 'var(--text-muted)', border: '1px solid' }}
        >
          {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--bg-elev-1)' }}>
        <Table data-testid="contacts-table">
          <TableHeader>
            <TableRow className="border-b hover:bg-transparent" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--bg-elev-2)' }}>
              <TableHead className="text-xs font-medium uppercase tracking-widest h-10 pl-4" style={{ color: 'var(--text-dim)' }}>Name</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-widest h-10" style={{ color: 'var(--text-dim)' }}>Email</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-widest h-10 hidden sm:table-cell" style={{ color: 'var(--text-dim)' }}>Source</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-widest h-10 hidden md:table-cell" style={{ color: 'var(--text-dim)' }}>Created</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-widest h-10 text-right pr-4" style={{ color: 'var(--text-dim)' }}>Visits</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} style={{ borderColor: 'var(--stroke)' }}>
                  <TableCell className="pl-4"><Skeleton className="h-4 w-28" style={{ backgroundColor: 'var(--stroke)' }} /></TableCell>
                  <TableCell><Skeleton className="h-4 w-44" style={{ backgroundColor: 'var(--stroke)' }} /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" style={{ backgroundColor: 'var(--stroke)' }} /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" style={{ backgroundColor: 'var(--stroke)' }} /></TableCell>
                  <TableCell className="pr-4 text-right"><Skeleton className="h-4 w-8 ml-auto" style={{ backgroundColor: 'var(--stroke)' }} /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow style={{ borderColor: 'transparent' }}>
                <TableCell colSpan={5}>
                  <div data-testid="contacts-empty-state" className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center"
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
                          ? 'Try a different search term.'
                          : 'Add the tracker script to your webinar page and submit a registration form to see leads appear here.'}
                      </p>
                    </div>
                    {!search && (
                      <Button data-testid="contacts-empty-state-copy-script" size="sm" onClick={onCopyScript}
                        className="gap-1.5 text-xs" style={{ backgroundColor: 'var(--primary-cyan)', color: 'var(--bg)' }}
                      >
                        <Copy size={12} /> Copy Script
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((contact) => {
                const src = utmSource(contact);
                return (
                  <TableRow
                    data-testid="contacts-table-row"
                    key={contact.contact_id}
                    className="contact-row border-b"
                    style={{ borderColor: 'var(--stroke)', cursor: 'pointer' }}
                    onClick={() => onSelectContact(contact.contact_id)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectContact(contact.contact_id); } }}
                    aria-label={`View details for ${contact.name || contact.email || 'Anonymous'}`}
                  >
                    <TableCell className="py-3 pl-4">
                      <div>
                        <span className="text-sm font-medium" style={{ color: contact.name ? 'var(--text)' : 'var(--text-dim)', fontStyle: !contact.name ? 'italic' : undefined }}>
                          {contact.name || 'Anonymous'}
                        </span>
                        <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono, monospace' }}>
                          {contact.contact_id.substring(0, 8)}…
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-sm" style={{ color: contact.email ? 'var(--text-muted)' : 'var(--text-dim)', fontStyle: !contact.email ? 'italic' : undefined }}>
                        {contact.email || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 hidden sm:table-cell">
                      {src ? (
                        <Badge variant="secondary" className="text-xs px-2 py-0"
                          style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: 'var(--amber-warn)', border: '1px solid rgba(245,158,11,0.2)' }}
                        >
                          <Tag size={10} className="mr-1" />{src}
                        </Badge>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 hidden md:table-cell">
                      <div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(contact.created_at)}</div>
                        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatTime(contact.created_at)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {contact.merged_children && contact.merged_children.length > 0 && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 gap-1 hidden sm:flex"
                            style={{ backgroundColor: 'rgba(69,209,156,0.1)', color: 'var(--mint-success)', border: '1px solid rgba(69,209,156,0.2)' }}
                          >
                            <GitMerge size={9} />
                            {contact.merged_children.length}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs font-mono px-2"
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
