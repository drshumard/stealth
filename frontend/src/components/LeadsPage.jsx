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
  if (range === '7d')  return d >= new Date(now - 7 * 864e5);
  if (range === '30d') return d >= new Date(now - 30 * 864e5);
  return true;
}

export default function LeadsPage({ contacts, loading, initialLoad, stats, onRefresh, onSelectContact, onDeleteContact, onBulkDelete }) {
  const [search,    setSearch] = useState('');
  const [srcFilter, setSrc]   = useState('all');
  const [dateFilter, setDate] = useState('all');

  const handleCopyScript = () =>
    navigator.clipboard.writeText(`<script src="${BACKEND_URL}/api/shumard.js"></script>`)
      .then(() => toast.success('Script copied!'));

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
      if (q) return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q);
      return true;
    });
  }, [identified, srcFilter, dateFilter, search]);

  const activeFilters = (srcFilter !== 'all' ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0);

  return (
    <div className="p-8 md:p-10">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>
            Leads
          </h1>
          <p className="text-base mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>
            {identified.length} identified contact{identified.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <Button
            variant="outline" size="sm"
            className="gap-2 h-10 px-5 text-sm font-semibold"
            style={{ borderColor: 'var(--brand-navy)', color: 'var(--brand-navy)' }}
          >
            <Download size={14} /> Export
          </Button>
          <Button
            data-testid="leads-copy-script-button"
            size="sm"
            className="gap-2 h-10 px-5 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-red)' }}
            onClick={handleCopyScript}
          >
            <Copy size={14} /> Copy Script
          </Button>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl border" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-soft)' }}>
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-5 border-b flex-wrap" style={{ borderColor: 'var(--stroke)' }}>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
            <Input
              data-testid="leads-filter-search-input"
              placeholder="Search name, email, phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-10 text-sm font-medium"
              style={{ borderColor: 'var(--stroke)', backgroundColor: '#faf9f7', color: 'var(--text)' }}
            />
          </div>

          <Select value={srcFilter} onValueChange={setSrc}>
            <SelectTrigger data-testid="leads-filter-source-select" className="h-10 text-sm w-40 font-medium" style={{ borderColor: 'var(--stroke)' }}>
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">All sources</SelectItem>
              {sources.map(s => <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDate}>
            <SelectTrigger data-testid="leads-filter-date-range" className="h-10 text-sm w-36 font-medium" style={{ borderColor: 'var(--stroke)' }}>
              <SelectValue placeholder="All time" />
            </SelectTrigger>
            <SelectContent>
              {DATE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {(activeFilters > 0 || search) && (
            <button
              onClick={() => { setSrc('all'); setDate('all'); setSearch(''); }}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors font-medium"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--stroke)' }}
            >
              <X size={13} /> Clear
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onRefresh} className="h-9 w-9 p-0 rounded-lg" style={{ color: 'var(--text-dim)' }}>
              <RefreshCw size={14} />
            </Button>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--brand-navy)' }}>
              {filtered.length} results
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 py-4">
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
