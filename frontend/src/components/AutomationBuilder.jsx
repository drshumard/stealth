import { useState, useEffect } from 'react';
import {
  Activity, Globe, Zap, Plus, X, ArrowRight, ShieldCheck,
  FlaskConical, Save, Loader2, CheckCircle2, AlertTriangle, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const FILTER_FIELDS = [
  { value: 'email',       label: 'Email' },
  { value: 'phone',       label: 'Phone' },
  { value: 'name',        label: 'Name' },
  { value: 'utm_source',  label: 'UTM Source' },
  { value: 'utm_campaign',label: 'UTM Campaign' },
  { value: 'utm_medium',  label: 'UTM Medium' },
  { value: 'fbclid',      label: 'Facebook Click ID' },
  { value: 'gclid',       label: 'Google Click ID' },
  { value: 'campaign_id', label: 'Campaign ID' },
  { value: 'adset_id',    label: 'Ad Set ID' },
  { value: 'client_ip',   label: 'IP Address' },
];

const OPERATORS = [
  { value: 'exists',     label: 'exists' },
  { value: 'not_exists', label: 'does not exist' },
  { value: 'equals',     label: '= equals' },
  { value: 'not_equals', label: '≠ not equals' },
  { value: 'contains',   label: '~ contains' },
];

const TETHER_FIELDS = [
  { value: 'email',        label: 'Email' },
  { value: 'name',         label: 'Full Name' },
  { value: 'first_name',   label: 'First Name' },
  { value: 'last_name',    label: 'Last Name' },
  { value: 'phone',        label: 'Phone' },
  { value: 'contact_id',   label: 'Contact ID' },
  { value: 'client_ip',    label: 'IP Address' },
  { value: 'created_at',   label: 'First Seen' },
  { value: 'updated_at',   label: 'Last Updated' },
  { value: 'utm_source',   label: 'UTM Source' },
  { value: 'utm_medium',   label: 'UTM Medium' },
  { value: 'utm_campaign', label: 'UTM Campaign' },
  { value: 'utm_term',     label: 'UTM Term' },
  { value: 'utm_content',  label: 'UTM Content' },
  { value: 'utm_id',       label: 'UTM ID' },
  { value: 'campaign_id',  label: 'Campaign ID' },
  { value: 'adset_id',     label: 'Ad Set ID' },
  { value: 'ad_id',        label: 'Ad ID' },
  { value: 'fbclid',       label: 'Facebook Click ID' },
];

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ── Step wrapper ── */
function StepCard({ number, icon: Icon, title, accent, children, badge }) {
  return (
    <div className="relative pl-10">
      {/* Vertical connector */}
      <div
        className="absolute left-4 top-10 bottom-0 w-0.5 last:hidden"
        style={{ backgroundColor: '#e0e3ee' }}
      />
      {/* Step badge */}
      <div
        className="absolute left-0 top-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white z-10"
        style={{ backgroundColor: accent }}
      >
        {number}
      </div>

      <div
        className="rounded-2xl border mb-6 overflow-hidden"
        style={{ borderColor: `${accent}30`, backgroundColor: '#ffffff', boxShadow: `0 2px 12px ${accent}0d` }}
      >
        {/* Step header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: `linear-gradient(135deg, ${accent}10 0%, ${accent}05 100%)`, borderBottom: `1px solid ${accent}20` }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${accent}18` }}
          >
            <Icon size={17} style={{ color: accent }} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ color: accent, fontFamily: 'Space Grotesk, sans-serif' }}>{title}</div>
          </div>
          {badge && (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${accent}18`, color: accent }}
            >
              {badge}
            </span>
          )}
        </div>

        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ── Filter row ── */
function FilterRow({ filter, onChange, onRemove }) {
  const needsValue = !['exists', 'not_exists'].includes(filter.operator);
  return (
    <div className="flex items-center gap-2 mb-2">
      <Select value={filter.field} onValueChange={v => onChange({ ...filter, field: v })}>
        <SelectTrigger className="h-9 text-sm w-36" style={{ borderColor: 'var(--stroke)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FILTER_FIELDS.map(f => <SelectItem key={f.value} value={f.value} className="text-sm">{f.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filter.operator} onValueChange={v => onChange({ ...filter, operator: v, value: '' })}>
        <SelectTrigger className="h-9 text-sm w-36" style={{ borderColor: 'var(--stroke)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS.map(o => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {needsValue && (
        <Input
          value={filter.value || ''}
          onChange={e => onChange({ ...filter, value: e.target.value })}
          placeholder="value"
          className="h-9 text-sm flex-1"
          style={{ borderColor: 'var(--stroke)' }}
        />
      )}

      <button
        onClick={onRemove}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: 'var(--text-dim)', backgroundColor: '#f8f6f2' }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

/* ── Mapping row ── */
function MappingRow({ mapping, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Select value={mapping.source} onValueChange={v => onChange({ ...mapping, source: v })}>
        <SelectTrigger className="h-9 text-sm w-44" style={{ borderColor: '#c0c9e8', backgroundColor: '#f0f2fc' }}>
          <SelectValue placeholder="Tether field" />
        </SelectTrigger>
        <SelectContent>
          {TETHER_FIELDS.map(f => <SelectItem key={f.value} value={f.value} className="text-sm">{f.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <ArrowRight size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />

      <Input
        value={mapping.target || ''}
        onChange={e => onChange({ ...mapping, target: e.target.value })}
        placeholder="webhook field name"
        className="h-9 text-sm flex-1"
        style={{ borderColor: '#f0c0b8', backgroundColor: '#fff8f7' }}
      />

      <button
        onClick={onRemove}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: 'var(--text-dim)', backgroundColor: '#f8f6f2' }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function AutomationBuilder({ open, automation, onClose, onSave }) {
  const isEdit = !!automation;

  const [name,           setName]           = useState('');
  const [enabled,        setEnabled]        = useState(true);
  const [requiredFields, setRequiredFields] = useState(['email']);
  // actions: array of { id, name, webhookUrl, fieldMap }
  const [actions,        setActions]        = useState([{ id: uuid4(), name: '', webhookUrl: '', fieldMap: [] }]);
  const [filters,        setFilters]        = useState([]);
  const [testResult,     setTestResult]     = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [testing,        setTesting]        = useState(false);
  const [savedId,        setSavedId]        = useState(null);

  useEffect(() => {
    if (open) {
      if (automation) {
        setName(automation.name || '');
        setEnabled(automation.enabled ?? true);
        setRequiredFields(automation.required_fields || ['email']);
        setFilters(automation.filters || []);
        setSavedId(automation.id || null);
        // Build actions array from either new `actions` or legacy `webhook_url`
        if (automation.actions?.length) {
          setActions(automation.actions.map(a => ({
            id:         a.id || uuid4(),
            name:       a.name || '',
            webhookUrl: a.webhook_url || '',
            fieldMap:   a.field_map || [],
          })));
        } else if (automation.webhook_url) {
          setActions([{
            id:         uuid4(),
            name:       '',
            webhookUrl: automation.webhook_url || '',
            fieldMap:   automation.field_map   || [],
          }]);
        } else {
          setActions([{ id: uuid4(), name: '', webhookUrl: '', fieldMap: [] }]);
        }
      } else {
        setName(''); setEnabled(true);
        setRequiredFields(['email']);
        setFilters([]);
        setActions([{ id: uuid4(), name: '', webhookUrl: '', fieldMap: [] }]);
        setSavedId(null);
      }
      setTestResult(null);
    }
  }, [open, automation]);

  const toggleRequiredField = (field) => setRequiredFields(prev =>
    prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
  );

  const addFilter = () => setFilters(prev => [...prev, { id: uuid4(), field: 'utm_source', operator: 'equals', value: '' }]);
  const updateFilter = (id, upd) => setFilters(prev => prev.map(f => f.id === id ? upd : f));
  const removeFilter = (id) => setFilters(prev => prev.filter(f => f.id !== id));

  const addAction    = () => setActions(prev => [...prev, { id: uuid4(), name: '', webhookUrl: '', fieldMap: [] }]);
  const removeAction = (id) => setActions(prev => prev.filter(a => a.id !== id));
  const updateAction = (id, patch) => setActions(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));

  const addActionMapping    = (aId) => updateAction(aId, { fieldMap: [...(actions.find(a=>a.id===aId)?.fieldMap||[]), { id: uuid4(), source: 'email', target: '' }] });
  const removeActionMapping = (aId, mId) => updateAction(aId, { fieldMap: actions.find(a=>a.id===aId)?.fieldMap.filter(m=>m.id!==mId)||[] });
  const updateActionMapping = (aId, mId, patch) => updateAction(aId, { fieldMap: actions.find(a=>a.id===aId)?.fieldMap.map(m=>m.id===mId?{...m,...patch}:m)||[] });

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Give your automation a name');
    const validActions = actions.filter(a => a.webhookUrl.trim());
    if (!validActions.length) return toast.error('Add at least one webhook URL');
    if (requiredFields.length === 0) return toast.error('Select at least one required field');
    try {
      setSaving(true);
      const body = {
        name: name.trim(),
        enabled,
        required_fields: requiredFields,
        actions: validActions.map(a => ({
          id:          a.id,
          name:        a.name.trim() || null,
          webhook_url: a.webhookUrl.trim(),
          field_map:   a.fieldMap,
        })),
        filters,
        // Keep legacy fields empty — new model uses actions[]
        webhook_url: null,
        field_map:   [],
      };
      const method = (isEdit && savedId) ? 'PUT' : 'POST';
      const url    = (isEdit && savedId) ? `${API}/automations/${savedId}` : `${API}/automations`;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      setSavedId(saved.id);
      toast.success(isEdit ? 'Automation updated!' : 'Automation created!');
      onSave(saved);
    } catch (e) {
      toast.error(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const id = savedId;
    if (!id) { toast.error('Save the automation first to test it'); return; }
    const firstAction = actions.find(a => a.webhookUrl.trim());
    if (!firstAction) return toast.error('Add a webhook URL first');
    try {
      setTesting(true);
      setTestResult(null);
      const res = await fetch(`${API}/automations/${id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
      if (data.success) toast.success(`Test sent → HTTP ${data.http_status} (${data.duration_ms}ms)`);
      else toast.error(data.error ? `Error: ${data.error}` : `HTTP ${data.http_status}`);
    } catch (e) {
      toast.error('Test request failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:w-[600px] lg:w-[680px] p-0 flex flex-col"
        style={{ backgroundColor: '#f9f8f5', borderColor: 'var(--stroke)', maxWidth: '680px' }}
      >
        {/* Header */}
        <div
          className="px-7 pt-6 pb-5 border-b shrink-0"
          style={{
            background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 60%, #f9f8f5 100%)',
            borderColor: '#d2d8ef',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mt-0.5" style={{ backgroundColor: 'rgba(3,3,82,0.12)' }}>
                <Zap size={20} style={{ color: '#030352' }} />
              </div>
              <div>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Automation name…"
                  className="text-xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 shadow-none"
                  style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}
                />
                <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--brand-navy)', opacity: 0.55 }}>
                  {isEdit ? 'Edit automation' : 'New automation'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: enabled ? '#030352' : 'var(--text-dim)' }}>
                  {enabled ? 'Active' : 'Paused'}
                </span>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable builder */}
        <div className="flex-1 overflow-y-auto px-7 py-6">

          {/* Step 1: Trigger */}
          <StepCard number="1" icon={Activity} title="Trigger — New Lead Identified" accent="#030352">
            <div className="rounded-xl p-4"
              style={{ background: 'linear-gradient(135deg, #eef0f8, #f4f5fb)', border: '1px solid #c0c9e8' }}>
              <p className="text-sm font-semibold mb-1" style={{ color: '#030352' }}>When a contact is identified</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Fires whenever a contact's <strong>email</strong> or <strong>phone</strong> is first captured — from a form submission, field blur, or registration event.
              </p>
            </div>
          </StepCard>

          {/* Step 2: Required Fields */}
          <StepCard
            number="2" icon={ShieldCheck} title="Wait For — Required fields before firing" accent="#059669"
            badge={`${requiredFields.length} required`}
          >
            <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
              The automation only fires once <strong>all selected fields</strong> are present on the contact. If phone is missing at email capture, it waits and retries automatically when phone is received.
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { field: 'email', label: 'Email',  note: 'always recommended' },
                { field: 'phone', label: 'Phone',  note: 'wait for phone too' },
                { field: 'name',  label: 'Name',   note: 'optional' },
              ].map(({ field, label, note }) => {
                const active = requiredFields.includes(field);
                return (
                  <button
                    key={field}
                    onClick={() => toggleRequiredField(field)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-150 text-sm font-semibold"
                    style={{
                      backgroundColor: active ? '#ecfdf5' : '#f8f7f4',
                      borderColor:     active ? '#059669' : 'var(--stroke)',
                      color:           active ? '#065f46' : 'var(--text-muted)',
                    }}
                  >
                    <span className={`w-4 h-4 rounded flex items-center justify-center text-xs border transition-all`}
                      style={{ backgroundColor: active ? '#059669' : 'transparent', borderColor: active ? '#059669' : 'var(--stroke)', color: '#fff' }}>
                      {active && '✓'}
                    </span>
                    {label}
                    <span className="text-xs font-normal" style={{ color: active ? '#059669' : 'var(--text-dim)', opacity: 0.7 }}>({note})</span>
                  </button>
                );
              })}
            </div>
            {requiredFields.length === 0 && (
              <p className="text-xs mt-2" style={{ color: '#dc2626' }}>⚠ Select at least one required field</p>
            )}
          </StepCard>

          {/* Step 3: Filters */}
          <StepCard
            number="3" icon={Zap} title="Filter — Only send matching leads" accent="#A31800"
            badge={filters.length > 0 ? `${filters.length} condition${filters.length !== 1 ? 's' : ''}` : 'Optional'}
          >
            {filters.length === 0 ? (
              <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>No filters — all identified leads will trigger this automation.</p>
            ) : (
              <div className="mb-3">
                {filters.map(f => (
                  <FilterRow key={f.id} filter={f} onChange={upd => updateFilter(f.id, upd)} onRemove={() => removeFilter(f.id)} />
                ))}
              </div>
            )}
            <button
              onClick={addFilter}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
              style={{ color: '#A31800', backgroundColor: 'rgba(163,24,0,0.06)', border: '1.5px dashed rgba(163,24,0,0.25)' }}
            >
              <Plus size={13} /> Add condition
            </button>
          </StepCard>

          {/* Step 4: Webhook Actions */}
          <StepCard
            number="4" icon={Globe} title="Actions — Webhook destinations" accent="#059669"
            badge={`${actions.filter(a=>a.webhookUrl.trim()).length} step${actions.filter(a=>a.webhookUrl.trim()).length !== 1 ? 's' : ''}`}
          >
            <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
              Add one or more webhook steps. All steps fire simultaneously when the automation triggers.
            </p>

            <div className="space-y-4">
              {actions.map((action, idx) => (
                <div key={action.id} className="rounded-xl border overflow-hidden"
                  style={{ borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' }}>
                  {/* Action header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: '#059669' }}>{idx + 1}</span>
                    <Input
                      value={action.name}
                      onChange={e => updateAction(action.id, { name: e.target.value })}
                      placeholder={`Step ${idx + 1} name (optional, e.g. "Send to GoHighLevel")`}
                      className="h-8 text-sm border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none flex-1"
                      style={{ color: '#065f46', fontFamily: 'Work Sans, sans-serif' }}
                    />
                    {actions.length > 1 && (
                      <button onClick={() => removeAction(action.id)}
                        className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                        style={{ color: '#dc2626', backgroundColor: 'rgba(220,38,38,0.08)' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Webhook URL */}
                  <div className="px-4 pt-3 pb-2">
                    <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: '#059669', opacity: 0.75 }}>Webhook URL</label>
                    <Input
                      value={action.webhookUrl}
                      onChange={e => updateAction(action.id, { webhookUrl: e.target.value })}
                      placeholder="https://hooks.zapier.com/hooks/catch/…"
                      className="h-9 text-sm font-mono"
                      style={{ borderColor: '#a7f3d0', backgroundColor: '#ffffff', fontFamily: 'IBM Plex Mono, monospace' }}
                    />
                  </div>

                  {/* Per-action field mapping */}
                  <div className="px-4 pb-3">
                    <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: '#059669', opacity: 0.75 }}>
                      Field Mapping <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional override)</span>
                    </label>
                    {action.fieldMap.map(m => (
                      <MappingRow key={m.id} mapping={m}
                        onChange={upd => updateActionMapping(action.id, m.id, upd)}
                        onRemove={() => removeActionMapping(action.id, m.id)} />
                    ))}
                    <button onClick={() => addActionMapping(action.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors mt-1"
                      style={{ color: '#059669', backgroundColor: 'rgba(5,150,105,0.06)', border: '1px dashed rgba(5,150,105,0.25)' }}>
                      <Plus size={11} /> Add mapping
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addAction}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition-colors mt-3 w-full justify-center"
              style={{ color: '#059669', backgroundColor: 'rgba(5,150,105,0.06)', border: '1.5px dashed rgba(5,150,105,0.20)' }}>
              <Plus size={13} /> Add another webhook step
            </button>
          </StepCard>

          {/* Test result */}
          {testResult && (
            <div
              className="rounded-2xl border overflow-hidden mb-4"
              style={{
                backgroundColor: testResult.success ? '#ecfdf5' : '#fef2f2',
                borderColor:     testResult.success ? '#a7f3d0' : '#fecaca',
              }}
            >
              {/* Result header */}
              <div className="flex items-center gap-3 px-4 py-3 flex-wrap" style={{ borderBottom: `1px solid ${testResult.success ? '#a7f3d0' : '#fecaca'}` }}>
                {testResult.success
                  ? <CheckCircle2 size={16} style={{ color: '#059669' }} />
                  : <AlertTriangle size={16} style={{ color: '#dc2626' }} />}
                <span className="text-sm font-bold flex-1" style={{ color: testResult.success ? '#065f46' : '#991b1b' }}>
                  {testResult.success
                    ? `Webhook received \u2714`
                    : testResult.http_status === null
                      ? 'Connection failed'
                      : `Failed \u2014 HTTP ${testResult.http_status}`}
                </span>
                {testResult.http_status && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: testResult.success ? '#d1fae5' : '#fee2e2', color: testResult.success ? '#065f46' : '#991b1b' }}>
                    HTTP {testResult.http_status}
                  </span>
                )}
                {testResult.duration_ms !== undefined && (
                  <span className="text-xs" style={{ color: testResult.success ? '#065f46' : '#991b1b', opacity: 0.7 }}>
                    {testResult.duration_ms}ms
                  </span>
                )}
              </div>

              {/* n8n-specific hint for 404 "not registered" errors */}
              {!testResult.success && testResult.response_hint && (
                <div className="px-4 py-3 flex items-start gap-2" style={{ backgroundColor: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                  <div>
                    <p className="text-xs font-bold mb-0.5" style={{ color: '#92400e' }}>Webhook hint</p>
                    <p className="text-xs" style={{ color: '#78350f' }}>{testResult.response_hint}</p>
                  </div>
                </div>
              )}

              {/* Error message (timeout etc.) */}
              {testResult.error && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #fecaca' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: '#991b1b' }}>Error</p>
                  <code className="text-xs" style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#991b1b' }}>{testResult.error}</code>
                </div>
              )}

              {/* Two columns: payload + response */}
              <div className="grid grid-cols-2 gap-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="p-4" style={{ borderRight: '1px solid rgba(0,0,0,0.06)' }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#030352', opacity: 0.65 }}>
                    Payload Sent
                  </p>
                  <pre
                    className="text-xs overflow-auto rounded-lg p-2.5 max-h-40"
                    style={{ backgroundColor: 'rgba(3,3,82,0.05)', fontFamily: 'IBM Plex Mono, monospace', color: '#030352', lineHeight: 1.5 }}
                  >
                    {JSON.stringify(testResult.payload, null, 2)}
                  </pre>
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: testResult.success ? '#065f46' : '#991b1b', opacity: 0.75 }}>
                    Response
                  </p>
                  {testResult.response_body ? (
                    <pre
                      className="text-xs overflow-auto rounded-lg p-2.5 max-h-40"
                      style={{ backgroundColor: testResult.success ? 'rgba(5,150,105,0.08)' : 'rgba(239,68,68,0.06)', fontFamily: 'IBM Plex Mono, monospace', color: testResult.success ? '#065f46' : '#991b1b', lineHeight: 1.5 }}
                    >
                      {(() => { try { return JSON.stringify(JSON.parse(testResult.response_body), null, 2); } catch { return testResult.response_body; } })()}
                    </pre>
                  ) : testResult.success ? (
                    <div className="rounded-lg p-3 text-xs font-medium" style={{ backgroundColor: 'rgba(5,150,105,0.08)', color: '#065f46' }}>
                      <p className="font-bold mb-1">Webhook acknowledged \u2714</p>
                      <p className="opacity-80">No response body -- this is normal for n8n and most webhook services. Check your n8n execution view to confirm the data was received.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg p-3 text-xs font-medium" style={{ backgroundColor: 'rgba(0,0,0,0.04)', color: 'var(--text-dim)' }}>
                      No response body
                    </div>
                  )}
                </div>
              </div>

              {/* n8n test webhook one-shot reminder */}
              {!testResult.success && testResult.http_status === null && (
                <div className="px-4 py-3 flex items-start gap-2 text-xs" style={{ borderTop: '1px solid #fecaca', color: '#78350f', backgroundColor: '#fffbeb' }}>
                  <span className="font-bold shrink-0">Tip:</span>
                  <span>For n8n test webhooks: open your n8n workflow, click <strong>Execute Workflow</strong> to activate it, then immediately click Test here. n8n test webhooks only listen for one request at a time.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="px-7 py-5 border-t flex items-center gap-3 shrink-0"
          style={{ borderColor: '#d2d8ef', backgroundColor: '#ffffff' }}
        >
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !savedId}
            className="gap-2 h-10 px-5 text-sm font-semibold"
            style={{ borderColor: '#059669', color: '#059669', opacity: (!savedId ? 0.5 : 1) }}
            title={!savedId ? 'Save first to test' : 'Send a test webhook'}
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
            Test
          </Button>

          <div className="flex-1" />

          <Button
            variant="outline"
            onClick={onClose}
            className="h-10 px-5 text-sm font-semibold"
            style={{ borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
          >
            Cancel
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 h-10 px-6 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-red)' }}
            data-testid="save-automation-button"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isEdit ? 'Update' : 'Create Automation'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
