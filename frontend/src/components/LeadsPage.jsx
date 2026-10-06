import { useState, useMemo } from 'react';
import { RefreshCw, Copy, X, CalendarDays, Loader2, FileText, Search, ChevronDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { ContactsTable } from '@/components/ContactsTable';
import { useTimezone } from '@/components/TimezoneContext';
import { exportLeadsToPdf } from '@/utils/pdfExport';
import { PageIntro, SurfaceHead, count } from '@/workspace/ui';

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

  const exportCount = selectedIds.size > 0 ? selectedIds.size : filtered.length;

  // Leads — design: the prototype's Leads directory. Identified contacts (an email, phone or name) from the newest
  // 10,000 the API returns, with the live page's filters, PDF export and tracking script.
  return <>
    <PageIntro eyebrow="Acquisition / People" title="Leads"
      description="A focused view of identified contacts and the next step in their journey."
      actions={<span className="sp-actions">
        <button type="button" className="sp-secondary-button" onClick={handleExportPdf} disabled={exporting || filtered.length === 0}>
          {exporting ? <Loader2 size={15} className="sp-spin" /> : <FileText size={15} />} Export PDF
          {exportCount > 0 && <span className="sp-button-count">{count(exportCount)}{selectedIds.size > 0 ? ' selected' : ''}</span>}
        </button>
        <button type="button" data-testid="leads-copy-script-button" className="sp-primary-button" onClick={handleCopyScript}><Copy size={15} /> Copy script</button>
      </span>} />
    <section className="sp-surface" aria-label="Leads list">
      <SurfaceHead eyebrow="Directory" title="All leads"><span className="sp-count">{count(identified.length)} identified</span></SurfaceHead>
      <div className="sp-toolbar">
        <label className="sp-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search leads</span>
          <input data-testid="leads-filter-search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone…" /></label>
        <label className="sp-select-wrap"><span className="sr-only">Filter by source</span>
          <select data-testid="leads-filter-source-select" value={srcFilter} onChange={e => setSrc(e.target.value)}>
            <option value="all">All sources</option>{sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select><ChevronDown size={15} aria-hidden="true" /></label>
        <label className="sp-select-wrap"><span className="sr-only">Date range</span>
          <select data-testid="leads-filter-date-range" value={dateRange} onChange={e => handleDateRangeChange(e.target.value)}>
            {DATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value === 'custom' && dateRange === 'custom' && customRange ? dateLabel('custom', customRange) : o.label}</option>)}
          </select><ChevronDown size={15} aria-hidden="true" /></label>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="sp-secondary-button" data-active={(dateRange === 'custom' && !!customRange) || undefined}
              onClick={() => { setDateRange('custom'); setCalOpen(true); }}>
              <CalendarDays size={15} /> {dateRange === 'custom' && customRange ? dateLabel('custom', customRange) : 'Pick dates'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="sp-popover w-auto p-0" align="start">
            <Calendar mode="range" selected={customRange} numberOfMonths={2} initialFocus
              onSelect={range => {
                setCustomRange(range);
                if (range?.from) {
                  setDateRange('custom');
                  if (range.to) setCalOpen(false);
                }
              }} />
            <div className="sp-popover-foot">
              <span>{customRange?.from
                ? `${customRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${customRange.to ? ' → ' + customRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}`
                : 'Select start date'}</span>
              {customRange && <button type="button" className="sp-clear" onClick={() => { setCustomRange(null); setDateRange('all'); setCalOpen(false); }}>Clear</button>}
            </div>
          </PopoverContent>
        </Popover>
        {(activeFilters > 0 || search) && (
          <button type="button" className="sp-clear" onClick={() => { setSrc('all'); setDateRange('all'); setCustomRange(null); setSearch(''); }}>
            <X size={13} /> Clear filters
          </button>
        )}
        <span className="sp-toolbar-end">
          <button type="button" className="sp-icon-button" onClick={onRefresh} aria-label="Refresh leads"><RefreshCw size={15} /></button>
          <span className="sp-count">{count(filtered.length)} results</span>
        </span>
      </div>
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
    </section>
  </>;
}
