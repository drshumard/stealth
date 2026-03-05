import { useState, useMemo } from 'react';
import { RefreshCw, Copy, Filter, X, CalendarDays, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { ContactsTable } from '@/components/ContactsTable';
import { useTimezone } from '@/components/TimezoneContext';
import { exportLeadsToPdf } from '@/utils/pdfExport';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// ── date range helpers (same logic as AutomationRuns) ─────────────────────────
const DATE_OPTIONS = [
  { value: 'all',    label: 'All time' },
  { value: 'today',  label: 'Today' },
  { value: '7d',     label: 'Last 7 days' },
  { value: '30d',    label: 'Last 30 days' },
  { value: '90d',    label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range…' },
];

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


function dateLabel(range, customRange) {
  if (range === 'all' || !range) return null;
  if (range === 'custom' && customRange?.from) {
    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    const from = customRange.from.toLocaleDateString('en-US', opts);
    if (!customRange.to || customRange.from.toDateString() === customRange.to.toDateString()) return from;
    return `${from} – ${customRange.to.toLocaleDateString('en-US', opts)}`;
  }
  return DATE_OPTIONS.find(o => o.value === range)?.label || null;
}

function passesDate(contact, range, customRange, todayStr) {
  if (range === 'all') return true;
  const d = new Date(contact.updated_at);
  const now = Date.now();
  if (range === 'today') {
    const cd = localDateStr(d);
    return cd === todayStr;
  }
  if (range === '7d')  return d >= new Date(now - 7  * 864e5);
  if (range === '30d') return d >= new Date(now - 30 * 864e5);
  if (range === '90d') return d >= new Date(now - 90 * 864e5);
  if (range === 'custom' && customRange?.from) {
    const from = customRange.from;
    const to   = customRange.to || customRange.from;
    // Use local date strings for comparison to avoid timezone issues
    const dStr    = localDateStr(d);
    const fromStr = localDateStr(from);
    const toStr   = localDateStr(to);
    return dStr >= fromStr && dStr <= toStr;
  }
  return true;
}

export default function LeadsPage({ contacts, loading, initialLoad, stats, onRefresh, onSelectContact, onDeleteContact, onBulkDelete }) {
  const { timezone, todayString } = useTimezone();
  const [search,       setSearch]       = useState('');
  const [srcFilter,    setSrc]          = useState('all');
  const [dateRange,    setDateRange]    = useState('all');
  const [customRange,  setCustomRange]  = useState(null);
  const [calOpen,      setCalOpen]      = useState(false);
  const [exporting,    setExporting]    = useState(false);
  const [selectedIds,  setSelectedIds]  = useState(new Set()); // track checkbox selection from table

  const handleCopyScript = () =>
    navigator.clipboard.writeText(`<script src="${BACKEND_URL}/api/shumard.js"></script>`)
      .then(() => toast.success('Script copied!'));

  const handleDateRangeChange = (val) => {
    setDateRange(val);
    if (val !== 'custom') setCustomRange(null);
    if (val === 'custom') setCalOpen(true);
  };

  const todayStr = todayString();

  const identified = useMemo(() => contacts.filter(c => c.email || c.phone || c.name), [contacts]);
  const sources    = useMemo(() => {
    const s = new Set(identified.map(c => c.attribution?.utm_source).filter(Boolean));
    return Array.from(s).sort();
  }, [identified]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return identified.filter(c => {
      if (srcFilter !== 'all' && c.attribution?.utm_source !== srcFilter) return false;
      if (!passesDate(c, dateRange, customRange, todayStr)) return false;
      if (q) return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q);
      return true;
    });
  }, [identified, srcFilter, dateRange, customRange, todayStr, search]);

  const activeFilters = (srcFilter !== 'all' ? 1 : 0) + (dateRange !== 'all' ? 1 : 0);

  const handleExportPdf = async () => {
    const toExport = selectedIds.size > 0
      ? filtered.filter(c => selectedIds.has(c.contact_id))
      : filtered;
    setExporting(true);
    try {
      const { fname, count } = await exportLeadsToPdf(toExport, dateLabel(dateRange, customRange), timezone);
      toast.success(`Saved ${fname}  (${count} lead${count !== 1 ? 's' : ''})`);
    } catch (e) {
      console.error('PDF export error:', e);
      toast.error(`Export failed: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8 md:p-10">
      {/* Page header */}
      <div className="rounded-2xl px-8 py-7 mb-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 50%, #f9f8f5 100%)', border: '1.5px solid #d2d8ef' }}>
        <div className="absolute -right-6 -bottom-6 opacity-[0.05] pointer-events-none text-[140px] font-bold select-none"
          style={{ color: '#030352', fontFamily: 'Space Grotesk, sans-serif' }} aria-hidden>✉</div>
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>Leads</h1>
            <p className="text-base mt-1 font-semibold" style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>
              {identified.length} identified contact{identified.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="outline" size="sm"
              className="gap-2 h-10 px-4 text-sm font-semibold"
              style={{ borderColor: 'var(--brand-navy)', color: 'var(--brand-navy)', backgroundColor: 'rgba(255,255,255,0.7)' }}
              onClick={handleExportPdf}
              disabled={exporting || filtered.length === 0}
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Export PDF
              {(selectedIds.size > 0 ? selectedIds.size : filtered.length) > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full ml-0.5"
                  style={{ backgroundColor: 'rgba(3,3,82,0.10)', color: '#030352' }}>
                  {selectedIds.size > 0 ? selectedIds.size : filtered.length}
                  {selectedIds.size > 0 ? ' selected' : ''}
                </span>
              )}
            </Button>
            <Button
              data-testid="leads-copy-script-button" size="sm"
              className="gap-2 h-10 px-5 text-sm font-semibold text-white"
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
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-5 border-b flex-wrap"
          style={{ borderColor: 'var(--stroke)', background: 'linear-gradient(to bottom, #f7f6f2, #ffffff)' }}>
          {/* Filter icon */}
          <div className="flex items-center gap-1.5 shrink-0" style={{ color: 'var(--text-dim)' }}>
            <Filter size={14} />
            <span className="text-xs font-semibold">Filter</span>
            {activeFilters > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold rounded-full"
                style={{ backgroundColor: 'rgba(3,3,82,0.12)', color: '#030352' }}>
                {activeFilters}
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Filter size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
            <Input
              data-testid="leads-filter-search-input"
              placeholder="Search name, email, phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-9 text-sm font-medium bg-white"
              style={{ borderColor: 'var(--stroke)', color: 'var(--text)' }}
            />
          </div>

          {/* Source */}
          <Select value={srcFilter} onValueChange={setSrc}>
            <SelectTrigger data-testid="leads-filter-source-select" className="h-9 text-sm w-36 font-medium bg-white" style={{ borderColor: 'var(--stroke)' }}>
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">All sources</SelectItem>
              {sources.map(s => <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Date range select */}
          <Select value={dateRange} onValueChange={handleDateRangeChange}>
            <SelectTrigger data-testid="leads-filter-date-range" className="h-9 text-sm w-40 font-medium bg-white" style={{ borderColor: 'var(--stroke)' }}>
              <SelectValue>
                {dateRange === 'custom' ? dateLabel('custom', customRange) || 'Custom range…'
                  : DATE_OPTIONS.find(o => o.value === dateRange)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DATE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Calendar picker */}
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button
                className="h-9 px-3 text-sm font-medium rounded-lg border flex items-center gap-1.5 transition-colors bg-white"
                style={{
                  borderColor: dateRange === 'custom' && customRange ? 'var(--brand-navy)' : 'var(--stroke)',
                  color:       dateRange === 'custom' && customRange ? 'var(--brand-navy)' : 'var(--text-dim)',
                }}
                onClick={() => { setDateRange('custom'); setCalOpen(true); }}
              >
                <CalendarDays size={14} />
                {dateRange === 'custom' && customRange ? dateLabel('custom', customRange) : 'Pick dates'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start"
              style={{ backgroundColor: '#ffffff', border: '1.5px solid var(--stroke)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={range => {
                  setCustomRange(range);
                  if (range?.from) {
                    setDateRange('custom');
                    if (range.to) setCalOpen(false);
                  }
                }}
                numberOfMonths={2}
                initialFocus
              />
              <div className="px-4 pb-3 flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {customRange?.from
                    ? `${customRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${customRange.to ? ' → ' + customRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ' → pick end'}`
                    : 'Select start date'}
                </span>
                {customRange && (
                  <button className="text-xs font-semibold" style={{ color: 'var(--brand-red)' }}
                    onClick={() => { setCustomRange(null); setDateRange('all'); setCalOpen(false); }}>
                    Clear
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {(activeFilters > 0 || search) && (
            <button onClick={() => { setSrc('all'); setDateRange('all'); setCustomRange(null); setSearch(''); }}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition-colors bg-white"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--stroke)' }}>
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
        <div className="px-6 py-5">
          <ContactsTable
            contacts={filtered}
            loading={loading}
            initialLoad={initialLoad}
            onSelectContact={onSelectContact}
            onCopyScript={handleCopyScript}
            onBulkDelete={onBulkDelete}
            hideSearch
            onSelectionChange={setSelectedIds}
          />
        </div>
      </div>
    </div>
  );
}
