import { useState, useEffect, useMemo } from 'react';
import {
  Search, Users, Copy, GitMerge, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, Trash2, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DateStamp, Status } from '@/workspace/ui';

// Contacts table (Leads, Visitors) — the prototype's record table, plus this table's own search, sorting, paging and
// bulk delete. Dates follow the display timezone.

/* ── Sort icon ── */
const SortIcon = ({ col, sort }) => {
  if (sort.col !== col) return <ArrowUpDown size={12} className="sp-sort-idle" />;
  return sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
};

const COLS = '40px minmax(0,2fr) minmax(0,1.5fr) minmax(0,1fr) minmax(0,.9fr) 70px';

const PAGE_SIZES = [8, 10, 20, 50];

export const ContactsTable = ({
  contacts,
  loading,
  initialLoad,
  onSelectContact,
  onCopyScript,
  onBulkDelete,
  hideSearch,
  onSelectionChange,   // optional: (selectedIds: Set<string>) => void
}) => {
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(new Set());
  const [sort,     setSort]     = useState({ col: 'updated_at', dir: 'desc' });
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => { setSelected(new Set()); }, [contacts]);

  // Notify parent whenever selection changes
  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selected);
  }, [selected, onSelectionChange]);
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

  const Col = ({ label, col: colKey }) => (
    <div role="columnheader" aria-sort={sort.col === colKey ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sp-sort" onClick={() => toggleSort(colKey)}>{label}<SortIcon col={colKey} sort={sort} /></button>
    </div>
  );

  const showSkeletons = loading && initialLoad;

  return (
    <div className="sp-contacts">
      {!hideSearch && (
        <div className="sp-toolbar">
          <label className="sp-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search contacts</span>
            <input data-testid="contacts-table-search-input" placeholder="Search by name, email or phone…"
              value={search} onChange={e => setSearch(e.target.value)} /></label>
          <span className="sp-count">{filtered.length.toLocaleString('en-US')} {search ? 'matching' : 'newest loaded'}</span>
        </div>
      )}

      {selectedCount > 0 && (
        <div data-testid="bulk-action-bar" className="sp-bulk">
          <span><strong>{selectedCount} selected</strong>
            <button type="button" className="sp-clear" onClick={() => setSelected(new Set())}>Clear</button></span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" data-testid="leads-bulk-delete-button" className="sp-secondary-button sp-danger-button">
                <Trash2 size={14} /> Delete {selectedCount}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="sp-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedCount} contact{selectedCount !== 1 ? 's' : ''}?</AlertDialogTitle>
                <AlertDialogDescription>This permanently removes them and all their visit history.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="sp-secondary-button">Cancel</AlertDialogCancel>
                <AlertDialogAction data-testid="bulk-delete-confirm-button" onClick={handleBulkDelete} className="sp-danger-solid">
                  Delete {selectedCount}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <div role="table" aria-label="Contacts" data-testid="contacts-table" className="sp-table">
        <div role="row" className="sp-table-head" style={{ gridTemplateColumns: COLS }}>
          <div role="columnheader" className="sp-check">
            <Checkbox data-testid="contacts-select-all-checkbox" checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onCheckedChange={toggleAll} onClick={e => e.stopPropagation()} aria-label="Select all" />
          </div>
          <Col label="Name" col="name" />
          <Col label="Email" col="email" />
          <Col label="Created" col="updated_at" />
          <Col label="Source" col="attribution.utm_source" />
          <Col label="Visits" col="visit_count" />
        </div>

        {showSkeletons ? (
          Array.from({ length: pageSize }).map((_, i) => (
            <div key={i} role="row" className="sp-table-row sp-skeleton-row" style={{ gridTemplateColumns: COLS }}>
              {Array.from({ length: 6 }).map((__, j) => <div key={j} role="cell"><span className="sp-skeleton" /></div>)}
            </div>
          ))
        ) : sliced.length === 0 ? (
          <div data-testid="contacts-empty-state" className="sp-empty sp-empty-state">
            <span className="sp-empty-icon"><Users size={22} /></span>
            <strong>{search ? 'No contacts match your search' : 'No contacts yet'}</strong>
            <span>{search ? 'Try a different search term.' : 'Add the tracking script to your page to start capturing leads.'}</span>
            {!search && onCopyScript && (
              <button type="button" data-testid="contacts-empty-state-copy-script" className="sp-primary-button" onClick={onCopyScript}>
                <Copy size={14} /> Copy script
              </button>
            )}
          </div>
        ) : (
          sliced.map(contact => {
            const src = contact?.attribution?.utm_source;
            const isSelected = selected.has(contact.contact_id);
            const label = contact.name || contact.email || 'Anonymous';
            return (
              <div role="row" data-testid="contacts-table-row" key={contact.contact_id} tabIndex={0}
                className="sp-table-row" data-selected={isSelected || undefined} style={{ gridTemplateColumns: COLS }}
                onClick={() => onSelectContact(contact.contact_id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectContact(contact.contact_id); } }}
                aria-label={`View ${label}`}>
                <div role="cell" className="sp-check" onClick={e => toggleOne(contact.contact_id, e)}>
                  <Checkbox data-testid={`contact-checkbox-${contact.contact_id}`} checked={isSelected}
                    onCheckedChange={() => {}} onClick={e => toggleOne(contact.contact_id, e)} aria-label={`Select ${label}`} />
                </div>
                <div role="cell" className="sp-table-cell sp-primary" data-label="Name">
                  <span className="sp-name-line"><strong>{contact.name || 'Anonymous'}</strong>
                    {contact.tags?.map(tag => <Status key={tag} tone="blue">{tag}</Status>)}</span>
                  <span>{contact.contact_id.substring(0, 8)}…</span>
                </div>
                <div role="cell" className="sp-table-cell" data-label="Email">{contact.email || '—'}</div>
                <div role="cell" className="sp-table-cell" data-label="Created"><DateStamp value={contact.updated_at} /></div>
                <div role="cell" className="sp-table-cell" data-label="Source">{src ? <Status tone="blue">{src}</Status> : '—'}</div>
                <div role="cell" className="sp-table-cell" data-label="Visits">
                  <span className="sp-visits">
                    {contact.merged_children?.length > 0 && (
                      <span className="sp-merged" title={`${contact.merged_children.length} merged contact${contact.merged_children.length !== 1 ? 's' : ''}`}>
                        <GitMerge size={10} />{contact.merged_children.length}
                      </span>
                    )}
                    <strong className="sp-number">{contact.visit_count}</strong>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!showSkeletons && sorted.length > 0 && (
        <div className="sp-table-foot sp-pager">
          <span className="sp-pager-info">
            Showing <strong>{((safePage - 1) * pageSize + 1).toLocaleString('en-US')}–{Math.min(safePage * pageSize, sorted.length).toLocaleString('en-US')}</strong> of <strong>{sorted.length.toLocaleString('en-US')}</strong>
            <label className="sp-select-wrap sp-select-small"><span className="sr-only">Rows per page</span>
              <select data-testid="leads-filter-rows-per-page" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZES.map(n => <option key={n} value={n}>Show {n} rows</option>)}
              </select></label>
          </span>
          <span className="sp-pages">
            <button type="button" onClick={() => setPage(1)} disabled={safePage === 1} aria-label="First page"><ChevronsLeft size={14} /></button>
            <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} aria-label="Previous page"><ChevronLeft size={14} /></button>
            {pagesArr.map((p, i) => (p === '...'
              ? <span key={`ellipsis-${i}`} className="sp-ellipsis">…</span>
              : <button type="button" key={p} onClick={() => setPage(p)} aria-current={safePage === p ? 'page' : undefined}>{p}</button>))}
            <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} aria-label="Next page"><ChevronRight size={14} /></button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={safePage === totalPages} aria-label="Last page"><ChevronsRight size={14} /></button>
          </span>
          <label className="sp-goto">Go to page
            <input type="number" min={1} max={totalPages} value={goInput} placeholder="1"
              onChange={e => setGoInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const n = parseInt(goInput);
                  if (n >= 1 && n <= totalPages) { setPage(n); setGoInput(''); }
                }
              }} /></label>
        </div>
      )}
    </div>
  );
};
