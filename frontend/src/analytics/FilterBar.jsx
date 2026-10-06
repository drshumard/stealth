import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Check, Filter, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API, FILTER_KEYS, FILTER_LABELS, FIRST_DAY, PRESETS, bucketLabel, fmtCompact, getJson } from './lib';
import { Select } from './charts';

const GRANS = [{ value: '', label: 'Auto' }, { value: 'hour', label: 'Hourly' }, { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }];

// The analytics toolbar: period, comparison, granularity, filters and saved views. Everything writes to the URL.
export default function FilterBar({ state, update }) {
  const rangeText = `${bucketLabel(state.since, 'day', true)} – ${bucketLabel(state.until, 'day', true)}`;
  return (
    <div className="an-filterbar">
      <div className="an-filter-row">
        <Select label="Date range" value={state.preset} className="an-range-select"
          onChange={v => update(v === 'custom' ? { range: 'custom', since: state.since, until: state.until } : { range: v === '30d' ? null : v, since: null, until: null })}
          options={PRESETS.map(p => ({ value: p.id, label: p.label }))} />
        {state.preset === 'custom' && (
          <span className="an-dates">
            <input type="date" aria-label="From" value={state.since} min={FIRST_DAY} max={state.until} onChange={e => e.target.value && update({ since: e.target.value })} />
            <span>→</span>
            <input type="date" aria-label="To" value={state.until} min={state.since} max={state.today} onChange={e => e.target.value && update({ until: e.target.value })} />
          </span>
        )}
        <span className="an-range-text"><strong>{rangeText}</strong><small>{state.days} day{state.days !== 1 ? 's' : ''}
          {state.compare && <> · vs {bucketLabel(state.prev.since, 'day')} – {bucketLabel(state.prev.until, 'day', true)}</>}</small></span>
        <span className="an-filter-spacer" />
        <label className="an-toggle"><input type="checkbox" checked={state.compare} onChange={e => update({ compare: e.target.checked ? null : '0' })} /><span />Compare</label>
        <Select label="Granularity" value={state.gran} onChange={v => update({ gran: v })} options={GRANS} />
        <SavedViews state={state} update={update} />
      </div>
      <div className="an-filter-row an-chips">
        <Filter size={14} className="an-chips-icon" />
        {Object.entries(state.filters).flatMap(([k, v]) => v.split(',').map(val => (
          <span key={`${k}:${val}`} className="an-chip"><small>{FILTER_LABELS[k]}</small>{val}
            <button type="button" aria-label={`Remove ${FILTER_LABELS[k]} ${val}`} onClick={() => {
              const rest = v.split(',').filter(x => x !== val);
              update({ [k]: rest.join(',') || null });
            }}><X size={12} /></button></span>
        )))}
        <AddFilter state={state} update={update} />
        {Object.keys(state.filters).length > 0 && (
          <button type="button" className="sp-clear an-reset" onClick={() => update(Object.fromEntries(FILTER_KEYS.map(k => [k, null])))}>
            <RotateCcw size={12} /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

function AddFilter({ state, update }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('source');
  const [q, setQ] = useState('');
  const dims = useQuery({ queryKey: ['analytics-dims'], queryFn: () => getJson(`${API}/dimensions`), staleTime: 600_000, enabled: open });
  const current = (state.filters[key] || '').split(',').filter(Boolean);
  const options = useMemo(() => (dims.data?.[key] || []).filter(o => !q || String(o.value).toLowerCase().includes(q.toLowerCase())), [dims.data, key, q]);
  const toggle = value => {
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    update({ [key]: next.join(',') || null });
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="an-add-filter"><Plus size={13} /> Add filter</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="sp-popover an-filter-pop">
        <div className="an-filter-pop-tabs">
          {FILTER_KEYS.map(k => <button key={k} type="button" aria-pressed={k === key} onClick={() => { setKey(k); setQ(''); }}>{FILTER_LABELS[k]}</button>)}
        </div>
        <label className="an-filter-search"><Search size={14} /><input autoFocus value={q} onChange={e => setQ(e.target.value)}
          placeholder={`Search ${FILTER_LABELS[key].toLowerCase()}…`} aria-label="Search values" /></label>
        <div className="an-filter-options">
          {dims.isLoading ? <div className="an-state">Loading values…</div> : options.length === 0 ? (
            <div className="an-state">{q ? <>No match. <button type="button" className="sp-clear" onClick={() => toggle(q.trim())}>Filter by “{q.trim()}”</button></> : 'No values.'}</div>
          ) : options.map(o => (
            <button key={o.value} type="button" aria-pressed={current.includes(String(o.value))} onClick={() => toggle(String(o.value))}>
              <span className="an-check">{current.includes(String(o.value)) && <Check size={11} />}</span>
              <span title={o.value}>{o.value}</span><small>{fmtCompact(o.count)}</small>
            </button>
          ))}
        </div>
        <p className="an-filter-hint">{key === 'page' || key === 'host' ? 'Page filters limit visits, and limit people to those who visited.' : 'Counts are contacts, all time. Pick several to combine them (OR).'}</p>
      </PopoverContent>
    </Popover>
  );
}

function SavedViews({ state, update }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const views = useQuery({ queryKey: ['analytics-views'], queryFn: () => getJson(`${API}/views`), enabled: open });
  const params = Object.fromEntries([...state.params.entries()]);
  const save = async () => {
    if (!name.trim()) return;
    const r = await fetch(`${API}/views`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), params }) });
    if (!r.ok) return toast.error('Could not save the view');
    setName('');
    qc.invalidateQueries({ queryKey: ['analytics-views'] });
    toast.success('View saved');
  };
  const remove = async id => {
    const r = await fetch(`${API}/views/${id}`, { method: 'DELETE' });
    if (!r.ok) return toast.error('Could not delete the view');
    qc.invalidateQueries({ queryKey: ['analytics-views'] });
  };
  const apply = v => {
    const all = new Set([...state.params.keys(), ...Object.keys(v.params)]);
    update(Object.fromEntries([...all].map(k => [k, v.params[k] ?? null])));
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="sp-secondary-button an-small-button"><Bookmark size={14} /> Views</button>
      </PopoverTrigger>
      <PopoverContent align="end" className="sp-popover an-views-pop">
        <span className="sp-eyebrow">Saved views</span>
        <div className="an-views-list">
          {views.isLoading ? <div className="an-state">Loading…</div> : (views.data || []).length === 0 ? <div className="an-state">No saved views yet.</div> :
            views.data.map(v => (
              <div key={v.id} className="an-view-row">
                <button type="button" onClick={() => apply(v)}><strong>{v.name}</strong><small>{v.params.tab || 'overview'} · {v.params.range || (v.params.since ? 'custom' : '30d')}</small></button>
                <button type="button" className="an-view-delete" aria-label={`Delete ${v.name}`} onClick={() => remove(v.id)}><Trash2 size={13} /></button>
              </div>
            ))}
        </div>
        <form className="an-view-save" onSubmit={e => { e.preventDefault(); save(); }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name this view…" maxLength={80} aria-label="View name" />
          <button type="submit" className="sp-primary-button an-small-button" disabled={!name.trim()}>Save</button>
        </form>
        <p className="an-filter-hint">Saves the tab, period, filters and chart settings for everyone in the workspace.</p>
      </PopoverContent>
    </Popover>
  );
}
