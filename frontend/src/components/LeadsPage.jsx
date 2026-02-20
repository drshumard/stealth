import { useState, useMemo } from 'react';
import { RefreshCw, Copy, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ContactsTable } from '@/components/ContactsTable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const DATE_OPTIONS = [
  { value: 'all',   label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d',    label: 'Last 7 days' },
  { value: '30d',   label: 'Last 30 days' },
];

function passesDate(contact, range) {
  if (range === 'all') return true;
  const d = new Date(contact.updated_at);
  const now = Date.now();
  if (range === 'today') {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return d >= start;
  }
  if (range === '7d')  return d >= new Date(now - 7  * 864e5);
  if (range === '30d') return d >= new Date(now - 30 * 864e5);
  return true;
}

export default function LeadsPage({
  contacts, loading, initialLoad, stats,
  onRefresh, onSelectContact, onDeleteContact, onBulkDelete,
}) {
  const [search, setSearch]       = useState('');
  const [sourceFilter, setSource] = useState('all');
  const [dateFilter, setDate]     = useState('all');

  const handleCopyScript = () => {
    const tag = `<script src="${BACKEND_URL}/api/shumard.js"></script>`;
    navigator.clipboard.writeText(tag).then(() =>
      toast.success('Script tag copied!', { description: 'Paste it in the <head> of your page.', duration: 3000 })
    );
  };

  // Only identified contacts
  const identified = useMemo(
    () => contacts.filter(c => c.email || c.phone || c.name),
    [contacts]
  );

  // Derive unique sources from identified contacts
  const sources = useMemo(() => {
    const s = new Set(identified.map(c => c.attribution?.utm_source).filter(Boolean));
    return Array.from(s).sort();
  }, [identified]);

  // Apply source + date + search filters
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return identified.filter(c => {
      if (sourceFilter !== 'all' && c.attribution?.utm_source !== sourceFilter) return false;
      if (!passesDate(c, dateFilter)) return false;
      if (q) {
        return (
          (c.name  && c.name.toLowerCase().includes(q))  ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [identified, sourceFilter, dateFilter, search]);

  const activeFilters = (sourceFilter !== 'all' ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0);
  const clearFilters  = () => { setSource('all'); setDate('all'); setSearch(''); };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--stroke)' }}
      >
        <div className="flex items-center gap-2">
          <h1
            className="text-sm font-semibold"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
          >
            Leads
          </h1>
          <Badge
            className="text-xs font-mono px-2"
            style={{
              backgroundColor: 'rgba(21,184,200,0.1)',
              color: 'var(--primary-cyan)',
              border: '1px solid rgba(21,184,200,0.2)',
            }}
          >
            {identified.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            data-testid="leads-refresh-button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="h-7 w-7 p-0"
            style={{ backgroundColor: 'var(--bg-elev-2)', borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
          >
            <RefreshCw size={13} />
          </Button>
          <Button
            data-testid="leads-copy-script-button"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleCopyScript}
            style={{ backgroundColor: 'var(--primary-cyan)', color: 'var(--bg)' }}
          >
            <Copy size={12} />
            Copy Script
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b shrink-0 flex-wrap"
        style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--bg-elev-1)' }}
      >
        <div className="flex items-center gap-1.5 shrink-0" style={{ color: 'var(--text-dim)' }}>
          <Filter size={13} />
          <span className="text-xs">Filters</span>
          {activeFilters > 0 && (
            <Badge
              className="text-xs px-1.5 h-4 font-mono"
              style={{ backgroundColor: 'rgba(21,184,200,0.15)', color: 'var(--primary-cyan)', border: 'none' }}
            >
              {activeFilters}
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Input
            data-testid="leads-search-input"
            placeholder="Search name, email, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 text-xs pl-3"
            style={{ backgroundColor: 'var(--bg-elev-2)', borderColor: 'var(--stroke)', color: 'var(--text)' }}
          />
        </div>

        {/* Source filter */}
        <Select value={sourceFilter} onValueChange={setSource}>
          <SelectTrigger
            data-testid="leads-source-filter"
            className="h-7 text-xs w-36 shrink-0"
            style={{ backgroundColor: 'var(--bg-elev-2)', borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
          >
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: 'var(--bg-elev-2)', borderColor: 'var(--stroke)' }}>
            <SelectItem value="all" className="text-xs">All sources</SelectItem>
            {sources.map(src => (
              <SelectItem key={src} value={src} className="text-xs">{src}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <Select value={dateFilter} onValueChange={setDate}>
          <SelectTrigger
            data-testid="leads-date-filter"
            className="h-7 text-xs w-32 shrink-0"
            style={{ backgroundColor: 'var(--bg-elev-2)', borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
          >
            <SelectValue placeholder="All time" />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: 'var(--bg-elev-2)', borderColor: 'var(--stroke)' }}>
            {DATE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear */}
        {(activeFilters > 0 || search) && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors duration-150 shrink-0"
            style={{ color: 'var(--text-dim)', border: '1px solid var(--stroke)', backgroundColor: 'transparent' }}
          >
            <X size={11} />
            Clear
          </button>
        )}

        <div className="ml-auto shrink-0">
          <Badge
            variant="secondary"
            className="text-xs font-mono px-2"
            style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--stroke)', color: 'var(--text-muted)' }}
          >
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-5">
        <ContactsTable
          contacts={filtered}
          loading={loading}
          initialLoad={initialLoad}
          onSelectContact={onSelectContact}
          onCopyScript={handleCopyScript}
          onBulkDelete={onBulkDelete}
          hideSearch
        />
      </div>
    </div>
  );
}
