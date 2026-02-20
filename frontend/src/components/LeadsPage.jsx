import { useState, useMemo } from 'react';
import { RefreshCw, Copy, Filter, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ContactsTable } from '@/components/ContactsTable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const DATE_OPTIONS = [
  { value: 'all',   label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d',    label: 'Last 7 days' },
  { value: '30d',   label: 'Last 30 days' },
];

function passesDate(c, range) {
  if (range === 'all') return true;
  const d = new Date(c.updated_at), now = Date.now();
  if (range === 'today') { const s = new Date(); s.setHours(0,0,0,0); return d >= s; }
  if (range === '7d')  return d >= new Date(now - 7  * 864e5);
  if (range === '30d') return d >= new Date(now - 30 * 864e5);
  return true;
}

export default function LeadsPage({ contacts, loading, initialLoad, stats, onRefresh, onSelectContact, onDeleteContact, onBulkDelete }) {
  const [search,   setSearch]  = useState('');
  const [srcFilter, setSrc]    = useState('all');
  const [dateFilter, setDate]  = useState('all');

  const handleCopyScript = () => {
    navigator.clipboard.writeText(`<script src="${BACKEND_URL}/api/shumard.js"></script>`)
      .then(() => toast.success('Script copied!', { description: 'Paste in your page <head>' }));
  };

  const identified = useMemo(() => contacts.filter(c => c.email || c.phone || c.name), [contacts]);
  const sources    = useMemo(() => {
    const s = new Set(identified.map(c => c.attribution?.utm_source).filter(Boolean));
    return Array.from(s).sort();
  }, [identified]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return identified.filter(c => {
      if (srcFilter !== 'all' && c.attribution?.utm_source !== srcFilter) return false;
      if (!passesDate(c, dateFilter)) return false;
      if (q) return (c.name?.toLowerCase().includes(q)) || (c.email?.toLowerCase().includes(q)) || (c.phone?.toLowerCase().includes(q));
      return true;
    });
  }, [identified, srcFilter, dateFilter, search]);

  const activeFilters = (srcFilter !== 'all' ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0);

  return (
    <div className="p-6 md:p-8">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}>Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {identified.length} identified contact{identified.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant="outline" size="sm"
            className="gap-1.5 h-9 text-sm"
            style={{ borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
          >
            <Download size={14} /> Export
          </Button>
          <Button
            data-testid="leads-copy-script-button"
            size="sm"
            className="gap-1.5 h-9 text-sm text-white"
            style={{ backgroundColor: 'var(--primary-orange)' }}
            onClick={handleCopyScript}
          >
            <Copy size={14} /> Copy Script
          </Button>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl border" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-soft)' }}>
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b flex-wrap" style={{ borderColor: 'var(--stroke)' }}>
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
            <Input
              data-testid="leads-filter-search-input"
              placeholder="Search name, email, phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs"
              style={{ borderColor: 'var(--stroke)', backgroundColor: '#fafaf8', color: 'var(--text)' }}
            />
          </div>

          <Select value={srcFilter} onValueChange={setSrc}>
            <SelectTrigger data-testid="leads-filter-source-select" className="h-8 text-xs w-36" style={{ borderColor: 'var(--stroke)' }}>
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All sources</SelectItem>
              {sources.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDate}>
            <SelectTrigger data-testid="leads-filter-date-range" className="h-8 text-xs w-28" style={{ borderColor: 'var(--stroke)' }}>
              <SelectValue placeholder="All time" />
            </SelectTrigger>
            <SelectContent>
              {DATE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {(activeFilters > 0 || search) && (
            <button
              onClick={() => { setSrc('all'); setDate('all'); setSearch(''); }}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--stroke)' }}
            >
              <X size={11} /> Clear
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              onClick={onRefresh}
              className="h-8 w-8 p-0"
              style={{ color: 'var(--text-dim)' }}
            ><RefreshCw size={13} /></Button>
            <Badge
              className="text-xs font-mono px-2 h-6"
              style={{ backgroundColor: '#fff7ed', color: 'var(--primary-orange)', border: '1px solid #fed7aa' }}
            >
              {filtered.length}
            </Badge>
          </div>
        </div>

        {/* Table */}
        <div className="p-4 pt-3">
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
    </div>
  );
}
