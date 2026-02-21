import { useState, useEffect, useMemo } from 'react';
import {
  Search, Users, Copy, GitMerge, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, Pencil, Trash2, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

/* ── Source badge colours (light tints) ── */
const SOURCE_PALETTE = {
  facebook:  { bg: '#fff0e6', text: '#c2410c', border: '#fed7aa' },
  instagram: { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
  google:    { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  linkedin:  { bg: '#eef2ff', text: '#3730a3', border: '#c7d2fe' },
  twitter:   { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
  youtube:   { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  referral:  { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
};
function srcStyle(src) {
  if (!src) return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };
  const key = src.toLowerCase();
  return SOURCE_PALETTE[key] || { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' };
}

function formatDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatTime(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/* ── Sort icon ── */
const SortIcon = ({ col, sort }) => {
  if (sort.col !== col) return <ArrowUpDown size={12} className="opacity-30 ml-1 shrink-0" />;
  return sort.dir === 'asc'
    ? <ArrowUp size={12} className="ml-1 shrink-0" style={{ color: 'var(--brand-navy)' }} />
    : <ArrowDown size={12} className="ml-1 shrink-0" style={{ color: 'var(--brand-navy)' }} />;
};

const PAGE_SIZES = [8, 10, 20, 50];

export const ContactsTable = ({
  contacts,
  loading,
  initialLoad,
  onSelectContact,
  onCopyScript,
  onBulkDelete,
  hideSearch,
}) => {
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(new Set());
  const [sort,     setSort]     = useState({ col: 'updated_at', dir: 'desc' });
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => { setSelected(new Set()); }, [contacts]);
  useEffect(() => { setPage(1); }, [search, contacts]);

  /* ── Filter ── */
  const filtered = useMemo(() => {
    if (hideSearch) return contacts;
    if (!search) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c =>
      (c.name  && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [contacts, search, hideSearch]);

  /* ── Sort ── */
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { col, dir } = sort;
    arr.sort((a, b) => {
      let av = a[col] ?? '', bv = b[col] ?? '';
      if (col === 'visit_count') { av = Number(av); bv = Number(bv); }
      else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ?  1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  /* ── Pagination ── */
  const totalPages  = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage    = Math.min(page, totalPages);
  const sliced      = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const [goInput,   setGoInput] = useState('');

  const toggleSort = (col) => {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' }
    );
    setPage(1);
  };

  /* ── Selection ── */
  const slicedIds    = sliced.map(c => c.contact_id);
  const allSelected  = slicedIds.length > 0 && slicedIds.every(id => selected.has(id));
  const someSelected = slicedIds.some(id => selected.has(id));
  const selectedCount = [...selected].filter(id => slicedIds.includes(id)).length;

  const toggleAll = () => {
    setSelected(prev => {
      const n = new Set(prev);
      allSelected ? slicedIds.forEach(id => n.delete(id)) : slicedIds.forEach(id => n.add(id));
      return n;
    });
  };
  const toggleOne = (id, e) => {
    e.stopPropagation();
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleBulkDelete = () => {
    const ids = [...selected].filter(id => slicedIds.includes(id));
    if (onBulkDelete) onBulkDelete(ids);
    setSelected(new Set());
  };

  /* ── Pagination pages array ── */
  const pagesArr = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (safePage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  }, [totalPages, safePage]);

  const Col = ({ label, col: colKey, className = '' }) => (
    <TableHead
      className={`text-xs uppercase tracking-wide cursor-pointer select-none h-11 ${className}`}
      style={{ color: '#030352', opacity: 0.65, fontFamily: 'Work Sans, sans-serif', fontWeight: 700 }}
      onClick={() => toggleSort(colKey)}
    >
      <div className="flex items-center">
        {label}<SortIcon col={colKey} sort={sort} />
      </div>
    </TableHead>
  );

  const showSkeletons = loading && initialLoad;

  return (
    <div>
      {/* Search bar — only when not provided by parent */}
      {!hideSearch && (
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
            <Input
              data-testid="contacts-table-search-input"
              placeholder="Search by name, email or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
              style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', color: 'var(--text)' }}
            />
          </div>
          <span className="text-sm" style={{ color: 'var(--text-dim)' }}>
            {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div
          data-testid="bulk-action-bar"
          className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-xl border"
          style={{ backgroundColor: '#fff0ee', borderColor: '#fecdc7' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--brand-navy)' }}>
              {selectedCount} selected
            </span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs px-2 py-0.5 rounded-full border transition-colors"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--stroke)' }}
            >
              Clear
            </button>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                data-testid="leads-bulk-delete-button"
                size="sm" variant="outline"
                className="h-7 gap-1.5 text-xs"
                style={{ borderColor: '#fecdc7', color: 'var(--brand-red)', backgroundColor: '#fff0ee' }}
              >
                <Trash2 size={12} /> Delete {selectedCount}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent style={{ backgroundColor: '#fff', borderColor: 'var(--stroke)' }}>
              <AlertDialogHeader>
                <AlertDialogTitle style={{ color: 'var(--text)' }}>
                  Delete {selectedCount} contact{selectedCount !== 1 ? 's' : ''}?
                </AlertDialogTitle>
                <AlertDialogDescription style={{ color: 'var(--text-muted)' }}>
                  This permanently removes them and all their visit history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel style={{ borderColor: 'var(--stroke)', color: 'var(--text)' }}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  data-testid="bulk-delete-confirm-button"
                  onClick={handleBulkDelete}
                  style={{ backgroundColor: 'var(--brand-red)', color: '#fff', border: 'none' }}
                >
                  Delete {selectedCount}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--stroke)' }}>
        <Table data-testid="contacts-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '40px' }} />          {/* Checkbox */}
            <col style={{ width: '28%' }} />            {/* Name + tags */}
            <col style={{ width: '29%' }} />            {/* Email */}
            <col style={{ width: '17%' }} />            {/* Created (md+) */}
            <col style={{ width: '15%' }} />            {/* Source (sm+) */}
            <col style={{ width: '11%' }} />            {/* Visits */}
          </colgroup>
          <TableHeader>
            <TableRow
              className="hover:bg-transparent"
              style={{
                background: 'linear-gradient(to bottom, #eef0f8, #f4f5fb)',
                borderColor: '#d2d8ef',
              }}
            >
              <TableHead className="pl-4 pr-0">
                <Checkbox
                  data-testid="contacts-select-all-checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onCheckedChange={toggleAll}
                  onClick={e => e.stopPropagation()}
                  aria-label="Select all"
                />
              </TableHead>
              <Col label="Name"    col="name"                    className="pl-3" />
              <Col label="Email"   col="email"                   className="" />
              <Col label="Created" col="updated_at"              className="hidden md:table-cell" />
              <Col label="Source"  col="attribution.utm_source"  className="hidden sm:table-cell" />
              <Col label="Visits"  col="visit_count"             className="text-right pr-6" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {showSkeletons ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i} style={{ borderColor: 'var(--stroke)' }}>
                  <TableCell className="pl-4 pr-0"><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell className="pl-3"><Skeleton className="h-4 w-4/5" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-4/5" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-3/4" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-3/4 rounded-full" /></TableCell>
                  <TableCell className="text-right pr-6"><Skeleton className="h-4 w-6 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : sliced.length === 0 ? (
              <TableRow style={{ borderColor: 'transparent' }}>
                <TableCell colSpan={7}>
                  <div data-testid="contacts-empty-state" className="flex flex-col items-center justify-center py-16 gap-4">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center border-2"
                      style={{ borderColor: 'var(--stroke)', backgroundColor: '#fafaf8' }}
                    >
                      <Users size={24} style={{ color: 'var(--text-dim)' }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                        {search ? 'No contacts match your search' : 'No contacts yet'}
                      </p>
                      <p className="text-xs max-w-xs" style={{ color: 'var(--text-dim)' }}>
                        {search ? 'Try a different search term.' : 'Add the tracking script to your page to start capturing leads.'}
                      </p>
                    </div>
                    {!search && onCopyScript && (
                      <Button
                        data-testid="contacts-empty-state-copy-script"
                        size="sm" onClick={onCopyScript}
                        className="gap-1.5 text-xs text-white"
                        style={{ backgroundColor: 'var(--brand-navy)' }}
                      >
                        <Copy size={12} /> Copy Script
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sliced.map(contact => {
                const src = contact?.attribution?.utm_source;
                const ss = srcStyle(src);
                const isSelected = selected.has(contact.contact_id);
                return (
                  <TableRow
                    data-testid="contacts-table-row"
                    key={contact.contact_id}
                    className={`contact-row border-b ${isSelected ? 'selected-row' : ''}`}
                    style={{
                      borderColor: 'var(--stroke)',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#fdf0ee' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--brand-red)' : '3px solid transparent',
                      transition: 'all 120ms ease',
                    }}
                    onClick={() => onSelectContact(contact.contact_id)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectContact(contact.contact_id); } }}
                    aria-label={`View ${contact.name || contact.email || 'Anonymous'}`}
                  >
                    <TableCell className="pl-4 pr-0" onClick={e => toggleOne(contact.contact_id, e)}>
                      <Checkbox
                        data-testid={`contact-checkbox-${contact.contact_id}`}
                        checked={isSelected}
                        onCheckedChange={() => {}}
                        onClick={e => toggleOne(contact.contact_id, e)}
                        aria-label={`Select ${contact.name || contact.email || 'contact'}`}
                      />
                    </TableCell>

                    <TableCell className="py-4 pl-3 overflow-hidden">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm font-semibold truncate max-w-[180px]"
                            style={{ color: contact.name ? 'var(--text)' : 'var(--text-dim)', fontStyle: contact.name ? 'normal' : 'italic' }}
                          >
                            {contact.name || 'Anonymous'}
                          </span>
                          {contact.tags?.map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: 'rgba(3,3,82,0.08)', color: '#030352', border: '1px solid rgba(3,3,82,0.15)' }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono, monospace' }}>
                          {contact.contact_id.substring(0, 8)}…
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-4 overflow-hidden">
                      <span className="text-sm truncate block" style={{ color: contact.email ? 'var(--text-muted)' : 'var(--text-dim)', fontStyle: contact.email ? 'normal' : 'italic' }}>
                        {contact.email || '—'}
                      </span>
                    </TableCell>

                    <TableCell className="py-3 hidden md:table-cell">
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(contact.updated_at)}
                        <span className="block" style={{ color: 'var(--text-dim)' }}>{formatTime(contact.updated_at)}</span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 hidden sm:table-cell">
                      {src ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium border"
                          style={{ backgroundColor: ss.bg, color: ss.text, borderColor: ss.border }}
                        >
                          {src}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </TableCell>

                    <TableCell className="py-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {contact.merged_children?.length > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border"
                            style={{ backgroundColor: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}
                          >
                            <GitMerge size={9} />{contact.merged_children.length}
                          </span>
                        )}
                        <span
                          className="text-xs font-mono font-semibold tabular-nums"
                          style={{ color: contact.visit_count > 0 ? 'var(--brand-navy)' : 'var(--text-dim)' }}
                        >
                          {contact.visit_count}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!showSkeletons && sorted.length > 0 && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          {/* Showing X of Y */}
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--text)' }}>{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)}</strong> of{' '}
              <strong style={{ color: 'var(--text)' }}>{sorted.length}</strong>
            </span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger
                data-testid="leads-filter-rows-per-page"
                className="h-7 text-xs w-28"
                style={{ borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map(n => (
                  <SelectItem key={n} value={String(n)} className="text-xs">Show {n} rows</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)} disabled={safePage === 1}
              className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs transition-colors disabled:opacity-30"
              style={{ borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
            ><ChevronsLeft size={13} /></button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
              className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs transition-colors disabled:opacity-30"
              style={{ borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
            ><ChevronLeft size={13} /></button>

            {pagesArr.map((p, i) =>
              p === '...'
                ? <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs" style={{ color: 'var(--text-dim)' }}>…</span>
                : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-7 h-7 rounded-lg border text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: safePage === p ? 'var(--brand-navy)' : '#ffffff',
                      color: safePage === p ? '#ffffff' : 'var(--text)',
                      borderColor: safePage === p ? 'var(--brand-navy)' : 'var(--stroke)',
                    }}
                  >{p}</button>
                )
            )}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs transition-colors disabled:opacity-30"
              style={{ borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
            ><ChevronRight size={13} /></button>
            <button
              onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
              className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs transition-colors disabled:opacity-30"
              style={{ borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
            ><ChevronsRight size={13} /></button>
          </div>

          {/* Go to page */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Go to page</span>
            <input
              type="number" min={1} max={totalPages}
              value={goInput}
              onChange={e => setGoInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const n = parseInt(goInput);
                  if (n >= 1 && n <= totalPages) { setPage(n); setGoInput(''); }
                }
              }}
              className="w-12 h-7 text-center text-xs border rounded-lg outline-none"
              style={{ borderColor: 'var(--stroke)', color: 'var(--text)', backgroundColor: '#fff' }}
              placeholder="1"
            />
          </div>
        </div>
      )}
    </div>
  );
};
