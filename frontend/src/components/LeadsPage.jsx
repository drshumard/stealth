import { useState, useMemo } from 'react';
import { RefreshCw, Copy, Filter, X, Download, Users } from 'lucide-react';
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
  const [tagFilter,  setTag]  = useState('all');

  const handleCopyScript = () =>
    navigator.clipboard.writeText(`<script src="${BACKEND_URL}/api/shumard.js"></script>`)
      .then(() => toast.success('Script copied!'));

  const identified = useMemo(() => contacts.filter(c => c.email || c.phone || c.name), [contacts]);
  const sources    = useMemo(() => {
    const s = new Set(identified.map(c => c.attribution?.utm_source).filter(Boolean));
    return Array.from(s).sort();
  }, [identified]);

  // Collect all distinct tags across identified contacts
  const allTags = useMemo(() => {
    const t = new Set(identified.flatMap(c => c.tags || []));
    return Array.from(t).sort();
  }, [identified]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return identified.filter(c => {
      if (srcFilter !== 'all' && c.attribution?.utm_source !== srcFilter) return false;
      if (!passesDate(c, dateFilter)) return false;
      if (tagFilter !== 'all' && !(c.tags || []).includes(tagFilter)) return false;
      if (q) return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q);
      return true;
    });
  }, [identified, srcFilter, dateFilter, tagFilter, search]);

  const activeFilters = (srcFilter !== 'all' ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0) + (tagFilter !== 'all' ? 1 : 0);

  return (
    <div className="p-8 md:p-10">
      {/* Tinted page header */}
      <div
        className="rounded-2xl px-8 py-7 mb-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 50%, #f9f8f5 100%)',
          border: '1.5px solid #d2d8ef',
        }}
      >
        {/* Faint decorative icon */}
        <Users size={140} className="absolute -right-6 -bottom-6 opacity-[0.05] pointer-events-none" color="#030352" aria-hidden />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>Leads</h1>
            <p className="text-base mt-1 font-semibold" style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>
              {identified.length} identified contact{identified.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2 h-10 px-5 text-sm font-semibold"
              style={{ borderColor: 'var(--brand-navy)', color: 'var(--brand-navy)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
              <Download size={14} /> Export
            </Button>
            <Button
              data-testid="leads-copy-script-button"
              size="sm" className="gap-2 h-10 px-5 text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--brand-red)' }}
              onClick={handleCopyScript}
            >
              <Copy size={14} /> Copy Script
            </Button>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl border" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: '0 4px 20px rgba(3,3,82,0.06)' }}>
        {/* Toolbar — warm tint */}
        <div
          className="flex items-center gap-3 px-6 py-5 border-b flex-wrap"
          style={{
            borderColor: 'var(--stroke)',
            background: 'linear-gradient(to bottom, #f7f6f2, #ffffff)',
          }}
        >
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
            <Input
              data-testid="leads-filter-search-input"
              placeholder="Search name, email, phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-10 text-sm font-medium bg-white"
              style={{ borderColor: 'var(--stroke)', color: 'var(--text)' }}
            />
          </div>

          <Select value={srcFilter} onValueChange={setSrc}>
            <SelectTrigger data-testid="leads-filter-source-select" className="h-10 text-sm w-40 font-medium bg-white" style={{ borderColor: 'var(--stroke)' }}>
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">All sources</SelectItem>
              {sources.map(s => <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDate}>
            <SelectTrigger data-testid="leads-filter-date-range" className="h-10 text-sm w-36 font-medium bg-white" style={{ borderColor: 'var(--stroke)' }}>
              <SelectValue placeholder="All time" />
            </SelectTrigger>
            <SelectContent>
              {DATE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {allTags.length > 0 && (
            <Select value={tagFilter} onValueChange={setTag}>
              <SelectTrigger data-testid="leads-filter-tag" className="h-10 text-sm w-36 font-medium bg-white" style={{ borderColor: 'var(--stroke)' }}>
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">All tags</SelectItem>
                {allTags.map(t => (
                  <SelectItem key={t} value={t} className="text-sm">
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--brand-navy)' }} />
                      {t}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(activeFilters > 0 || search) && (
            <button
              onClick={() => { setSrc('all'); setDate('all'); setSearch(''); }}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors font-medium bg-white"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--stroke)' }}
            >
              <X size={13} /> Clear
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onRefresh} className="h-9 w-9 p-0 rounded-lg" style={{ color: 'var(--text-dim)' }}>
              <RefreshCw size={14} />
            </Button>
            <span
              className="text-sm font-bold tabular-nums px-3 py-1 rounded-lg"
              style={{ backgroundColor: 'rgba(3,3,82,0.06)', color: 'var(--brand-navy)' }}
            >
              {filtered.length} results
            </span>
          </div>
        </div>

        <div className="px-6 py-5">
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
