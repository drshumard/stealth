import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, ChevronUp, ChevronDown, Trash2, Save, Loader2,
  Clock, Filter, Globe, ShieldCheck, Zap, GripVertical, X,
  Activity, ArrowRight, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// ─────────────────────────── Constants ───────────────────────────
const STEP_TYPES = [
  { type: 'wait_for', label: 'Wait For', icon: ShieldCheck, color: '#059669', desc: 'Wait for required fields' },
  { type: 'filter',   label: 'Filter',   icon: Filter,      color: '#A31800', desc: 'Apply conditions' },
  { type: 'delay',    label: 'Delay',    icon: Clock,       color: '#7c3aed', desc: 'Wait then refetch' },
  { type: 'webhook',  label: 'Webhook',  icon: Globe,       color: '#0284c7', desc: 'Send to URL' },
];

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
  { value: 'tags',        label: 'Tags' },
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
  { value: 'user_agent',   label: 'User Agent (FB CAPI)' },
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

// ─────────────────────────── Step Editors ───────────────────────────

/** Wait For Step Editor */
function WaitForEditor({ config, onChange }) {
  const fields = config?.fields || ['email'];
  const toggleField = (field) => {
    const newFields = fields.includes(field)
      ? fields.filter(f => f !== field)
      : [...fields, field];
    onChange({ ...config, fields: newFields });
  };

  return (
    <div>
      <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
        Automation pauses until <strong>all selected fields</strong> are present on the contact.
      </p>
      <div className="flex flex-wrap gap-2">
        {['email', 'phone', 'name'].map(field => {
          const active = fields.includes(field);
          return (
            <button
              key={field}
              onClick={() => toggleField(field)}
              data-testid={`wait-for-field-${field}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-150 text-sm font-semibold"
              style={{
                backgroundColor: active ? '#ecfdf5' : '#f8f7f4',
                borderColor:     active ? '#059669' : 'var(--stroke)',
                color:           active ? '#065f46' : 'var(--text-muted)',
              }}
            >
              <span className="w-4 h-4 rounded flex items-center justify-center text-xs border transition-all"
                style={{ backgroundColor: active ? '#059669' : 'transparent', borderColor: active ? '#059669' : 'var(--stroke)', color: '#fff' }}>
                {active && '✓'}
              </span>
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </button>
          );
        })}
      </div>
      {fields.length === 0 && (
        <p className="text-xs mt-2" style={{ color: '#dc2626' }}>⚠ Select at least one required field</p>
      )}
    </div>
  );
}

/** Filter Step Editor */
function FilterEditor({ config, onChange }) {
  const filters = config?.filters || [];

  const addFilter = () => {
    onChange({
      ...config,
      filters: [...filters, { id: uuid4(), field: 'utm_source', operator: 'equals', value: '' }]
    });
  };

  const updateFilter = (id, patch) => {
    onChange({
      ...config,
      filters: filters.map(f => f.id === id ? { ...f, ...patch } : f)
    });
  };

  const removeFilter = (id) => {
    onChange({
      ...config,
      filters: filters.filter(f => f.id !== id)
    });
  };

  return (
    <div>
      <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
        Only contacts matching <strong>all conditions</strong> proceed to the next step.
      </p>
      {filters.length === 0 ? (
        <p className="text-sm mb-3 italic" style={{ color: 'var(--text-dim)' }}>No conditions — all contacts pass through.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {filters.map((f, idx) => {
            const needsValue = !['exists', 'not_exists'].includes(f.operator);
            return (
              <div key={f.id} className="flex items-center gap-2 flex-wrap">
                {idx > 0 && <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: '#f0ede8', color: 'var(--text-dim)' }}>AND</span>}
                <Select value={f.field} onValueChange={v => updateFilter(f.id, { field: v })}>
                  <SelectTrigger className="h-9 text-sm w-36" style={{ borderColor: 'var(--stroke)' }} data-testid={`filter-field-${f.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_FIELDS.map(ff => <SelectItem key={ff.value} value={ff.value} className="text-sm">{ff.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={f.operator} onValueChange={v => updateFilter(f.id, { operator: v, value: '' })}>
                  <SelectTrigger className="h-9 text-sm w-36" style={{ borderColor: 'var(--stroke)' }} data-testid={`filter-operator-${f.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map(o => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {needsValue && (
                  <Input
                    value={f.value || ''}
                    onChange={e => updateFilter(f.id, { value: e.target.value })}
                    placeholder="value"
                    className="h-9 text-sm flex-1 min-w-[120px]"
                    style={{ borderColor: 'var(--stroke)' }}
                    data-testid={`filter-value-${f.id}`}
                  />
                )}
                <button
                  onClick={() => removeFilter(f.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50"
                  style={{ color: '#dc2626' }}
                  data-testid={`filter-remove-${f.id}`}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <button
        onClick={addFilter}
        className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
        style={{ color: '#A31800', backgroundColor: 'rgba(163,24,0,0.06)', border: '1.5px dashed rgba(163,24,0,0.25)' }}
        data-testid="add-filter-condition"
      >
        <Plus size={13} /> Add condition
      </button>
    </div>
  );
}

/** Delay Step Editor */
function DelayEditor({ config, onChange }) {
  const seconds = config?.seconds ?? 60;

  return (
    <div>
      <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>
        Wait the specified time, then <strong>refetch the contact's latest data</strong> before proceeding.
        Useful for capturing phone numbers that arrive shortly after email.
      </p>
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Wait</label>
        <Input
          type="number"
          min="0"
          max="86400"
          value={seconds}
          onChange={e => onChange({ ...config, seconds: Math.max(0, parseInt(e.target.value) || 0) })}
          className="h-10 text-sm w-24"
          style={{ borderColor: 'var(--stroke)' }}
          data-testid="delay-seconds-input"
        />
        <span className="text-sm" style={{ color: 'var(--text-dim)' }}>seconds</span>
        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#f0f0ff', color: '#7c3aed' }}>
          {seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`}
        </span>
      </div>
    </div>
  );
}

/** Webhook Step Editor */
function WebhookEditor({ config, onChange }) {
  const url = config?.url || '';
  const name = config?.name || '';
  const fieldMap = config?.field_map || [];

  const addMapping = () => {
    onChange({
      ...config,
      field_map: [...fieldMap, { id: uuid4(), source: 'email', target: '' }]
    });
  };

  const updateMapping = (id, patch) => {
    onChange({
      ...config,
      field_map: fieldMap.map(m => m.id === id ? { ...m, ...patch } : m)
    });
  };

  const removeMapping = (id) => {
    onChange({
      ...config,
      field_map: fieldMap.filter(m => m.id !== id)
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: '#0284c7', opacity: 0.75 }}>
          Step Name <span className="font-normal">(optional)</span>
        </label>
        <Input
          value={name}
          onChange={e => onChange({ ...config, name: e.target.value })}
          placeholder="e.g. Send to GoHighLevel"
          className="h-10 text-sm"
          style={{ borderColor: 'var(--stroke)' }}
          data-testid="webhook-name-input"
        />
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: '#0284c7', opacity: 0.75 }}>
          Webhook URL <span className="text-red-500">*</span>
        </label>
        <Input
          value={url}
          onChange={e => onChange({ ...config, url: e.target.value })}
          placeholder="https://hooks.zapier.com/hooks/catch/..."
          className="h-10 text-sm font-mono"
          style={{ borderColor: url ? 'var(--stroke)' : '#fecaca', fontFamily: 'IBM Plex Mono, monospace' }}
          data-testid="webhook-url-input"
        />
        {!url && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Webhook URL is required</p>}
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: '#0284c7', opacity: 0.75 }}>
          Field Mapping <span className="font-normal">(optional)</span>
        </label>
        <p className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>
          Map Tether fields to custom webhook field names. Leave empty to send all fields with default names.
        </p>
        {fieldMap.length > 0 && (
          <div className="space-y-2 mb-3">
            {fieldMap.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <Select value={m.source} onValueChange={v => updateMapping(m.id, { source: v })}>
                  <SelectTrigger className="h-9 text-sm w-44" style={{ borderColor: '#c0c9e8', backgroundColor: '#f0f2fc' }} data-testid={`mapping-source-${m.id}`}>
                    <SelectValue placeholder="Tether field" />
                  </SelectTrigger>
                  <SelectContent>
                    {TETHER_FIELDS.map(f => <SelectItem key={f.value} value={f.value} className="text-sm">{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <ArrowRight size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                <Input
                  value={m.target || ''}
                  onChange={e => updateMapping(m.id, { target: e.target.value })}
                  placeholder="webhook field name"
                  className="h-9 text-sm flex-1"
                  style={{ borderColor: '#f0c0b8', backgroundColor: '#fff8f7' }}
                  data-testid={`mapping-target-${m.id}`}
                />
                <button
                  onClick={() => removeMapping(m.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50"
                  style={{ color: '#dc2626' }}
                  data-testid={`mapping-remove-${m.id}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={addMapping}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
          style={{ color: '#0284c7', backgroundColor: 'rgba(2,132,199,0.06)', border: '1px dashed rgba(2,132,199,0.25)' }}
          data-testid="add-field-mapping"
        >
          <Plus size={11} /> Add mapping
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── Step Card ───────────────────────────

function StepCard({ step, index, total, onUpdate, onRemove, onMoveUp, onMoveDown }) {
  const typeInfo = STEP_TYPES.find(t => t.type === step.type) || STEP_TYPES[0];
  const Icon = typeInfo.icon;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const renderEditor = () => {
    switch (step.type) {
      case 'wait_for': return <WaitForEditor config={step.config} onChange={c => onUpdate({ ...step, config: c })} />;
      case 'filter':   return <FilterEditor config={step.config} onChange={c => onUpdate({ ...step, config: c })} />;
      case 'delay':    return <DelayEditor config={step.config} onChange={c => onUpdate({ ...step, config: c })} />;
      case 'webhook':  return <WebhookEditor config={step.config} onChange={c => onUpdate({ ...step, config: c })} />;
      default: return <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Unknown step type</p>;
    }
  };

  return (
    <>
      <div
        className="rounded-2xl border overflow-hidden transition-all"
        style={{ borderColor: `${typeInfo.color}30`, backgroundColor: '#ffffff', boxShadow: `0 2px 12px ${typeInfo.color}0d` }}
        data-testid={`step-card-${step.id}`}
      >
        {/* Step header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: `linear-gradient(135deg, ${typeInfo.color}10 0%, ${typeInfo.color}05 100%)`, borderBottom: `1px solid ${typeInfo.color}20` }}
        >
          {/* Step number */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: typeInfo.color }}
          >
            {index + 1}
          </div>

          {/* Icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${typeInfo.color}18` }}
          >
            <Icon size={17} style={{ color: typeInfo.color }} />
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold" style={{ color: typeInfo.color, fontFamily: 'Space Grotesk, sans-serif' }}>
              {typeInfo.label}
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
              {typeInfo.desc}
            </div>
          </div>

          {/* Reorder buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onMoveUp}
              disabled={index === 0}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
              style={{ color: 'var(--text-muted)' }}
              data-testid={`step-move-up-${step.id}`}
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={index === total - 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
              style={{ color: 'var(--text-muted)' }}
              data-testid={`step-move-down-${step.id}`}
            >
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Delete */}
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50"
            style={{ color: '#dc2626' }}
            data-testid={`step-remove-${step.id}`}
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Step content */}
        <div className="px-5 py-5">
          {renderEditor()}
        </div>
      </div>

      {/* Connector line */}
      {index < total - 1 && (
        <div className="flex justify-center py-2">
          <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: '#d2d8ef' }} />
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent style={{ backgroundColor: '#fff', borderColor: 'var(--stroke)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--brand-navy)' }}>Remove Step?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--text-muted)' }}>
              This {typeInfo.label} step will be removed from the automation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ borderColor: 'var(--stroke)' }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onRemove(); setConfirmDelete(false); }}
              style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none' }}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────── Add Step Menu ───────────────────────────

function AddStepMenu({ onAdd }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-14 gap-3 text-base font-semibold border-2 border-dashed"
          style={{ borderColor: '#c0c9e8', color: '#030352', backgroundColor: 'rgba(3,3,82,0.02)' }}
          data-testid="add-step-button"
        >
          <Plus size={18} /> Add Step
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64" style={{ backgroundColor: '#fff', borderColor: 'var(--stroke)' }}>
        {STEP_TYPES.map(st => (
          <DropdownMenuItem
            key={st.type}
            onClick={() => onAdd(st.type)}
            className="flex items-center gap-3 py-3 px-4 cursor-pointer"
            data-testid={`add-step-${st.type}`}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${st.color}18` }}>
              <st.icon size={15} style={{ color: st.color }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--brand-navy)' }}>{st.label}</div>
              <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{st.desc}</div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────── Main Page ───────────────────────────

export default function AutomationBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !id || id === 'new';

  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [steps, setSteps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch existing automation for edit mode
  const { data: automation, isLoading, isError, error } = useQuery({
    queryKey: ['automation', id],
    queryFn: () => fetch(`${API}/automations/${id}`).then(r => {
      if (!r.ok) {
        if (r.status === 404) throw new Error('Automation not found');
        throw new Error('Failed to load automation');
      }
      return r.json();
    }),
    enabled: !isNew,
    retry: 1,
  });

  // Hydrate form when automation loads
  useEffect(() => {
    if (automation) {
      setName(automation.name || '');
      setEnabled(automation.enabled ?? true);
      // If automation has steps[], use them directly
      if (automation.steps?.length) {
        setSteps(automation.steps);
      } else {
        // Convert legacy fields to steps
        const legacySteps = [];
        // required_fields → wait_for step
        if (automation.required_fields?.length) {
          legacySteps.push({
            id: uuid4(),
            type: 'wait_for',
            config: { fields: automation.required_fields }
          });
        }
        // filters → filter step
        if (automation.filters?.length) {
          legacySteps.push({
            id: uuid4(),
            type: 'filter',
            config: { filters: automation.filters }
          });
        }
        // actions → webhook steps (with optional delay)
        const actions = automation.actions?.length
          ? automation.actions
          : automation.webhook_url
            ? [{ id: uuid4(), webhook_url: automation.webhook_url, field_map: automation.field_map || [] }]
            : [];
        actions.forEach(action => {
          if (action.delay_seconds > 0) {
            legacySteps.push({
              id: uuid4(),
              type: 'delay',
              config: { seconds: action.delay_seconds }
            });
          }
          legacySteps.push({
            id: uuid4(),
            type: 'webhook',
            config: {
              name: action.name || '',
              url: action.webhook_url || '',
              field_map: action.field_map || [],
            }
          });
        });
        setSteps(legacySteps.length ? legacySteps : []);
      }
      setHasChanges(false);
    }
  }, [automation]);

  // Track changes (only after initial load)
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (automation && !initialized) {
      setInitialized(true);
      return;
    }
    if (initialized) setHasChanges(true);
  }, [name, enabled, steps, automation, initialized]);

  // Add a step
  const addStep = (type) => {
    const defaultConfig = {
      wait_for: { fields: ['email'] },
      filter: { filters: [] },
      delay: { seconds: 60 },
      webhook: { name: '', url: '', field_map: [] },
    };
    setSteps(prev => [...prev, { id: uuid4(), type, config: defaultConfig[type] }]);
  };

  // Update a step
  const updateStep = (stepId, updated) => {
    setSteps(prev => prev.map(s => s.id === stepId ? updated : s));
  };

  // Remove a step
  const removeStep = (stepId) => {
    setSteps(prev => prev.filter(s => s.id !== stepId));
  };

  // Move step up/down
  const moveStep = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps);
  };

  // Validate before save
  const validate = () => {
    if (!name.trim()) {
      toast.error('Please give your automation a name');
      return false;
    }
    if (steps.length === 0) {
      toast.error('Add at least one step to your automation');
      return false;
    }
    // Check for at least one webhook step with URL
    const webhookSteps = steps.filter(s => s.type === 'webhook');
    if (webhookSteps.length === 0) {
      toast.error('Add at least one Webhook step');
      return false;
    }
    // Validate each webhook URL
    for (const ws of webhookSteps) {
      const url = ws.config?.url?.trim() || '';
      if (!url) {
        toast.error('All Webhook steps must have a URL');
        return false;
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        toast.error('Webhook URLs must start with http:// or https://');
        return false;
      }
    }
    // Check wait_for has at least one field
    const waitFor = steps.find(s => s.type === 'wait_for');
    if (waitFor && (!waitFor.config?.fields?.length)) {
      toast.error('Wait For step must have at least one field selected');
      return false;
    }
    // Check filter values are not empty when required
    for (const step of steps) {
      if (step.type === 'filter') {
        const filters = step.config?.filters || [];
        for (const f of filters) {
          const needsValue = !['exists', 'not_exists'].includes(f.operator);
          if (needsValue && !f.value?.trim()) {
            toast.error('Filter conditions with equals/contains require a value');
            return false;
          }
        }
      }
    }
    return true;
  };

  // Save automation
  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        enabled,
        steps: steps,
        // Clear legacy fields when using steps
        required_fields: [],
        filters: [],
        actions: [],
        webhook_url: null,
        field_map: [],
      };

      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? `${API}/automations` : `${API}/automations/${id}`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success(isNew ? 'Automation created!' : 'Automation saved!');
      qc.invalidateQueries({ queryKey: ['automations'] });
      navigate('/automations');
    } catch (e) {
      toast.error(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (!isNew && isLoading) {
    return (
      <div className="p-8 md:p-10 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64 mb-6" style={{ backgroundColor: '#f0ede8' }} />
        <Skeleton className="h-40 w-full mb-4" style={{ backgroundColor: '#f0ede8' }} />
        <Skeleton className="h-40 w-full" style={{ backgroundColor: '#f0ede8' }} />
      </div>
    );
  }

  // Error state
  if (!isNew && isError) {
    return (
      <div className="p-8 md:p-10 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/automations')}
          className="flex items-center gap-2 text-sm font-semibold mb-4 transition-colors hover:opacity-80"
          style={{ color: 'var(--brand-navy)' }}
        >
          <ArrowLeft size={16} /> Back to Automations
        </button>
        <div className="rounded-2xl border-2 border-dashed p-8 text-center" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>
          <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: '#dc2626' }} />
          <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#991b1b' }}>
            Failed to load automation
          </h3>
          <p className="text-sm" style={{ color: '#b91c1c' }}>
            {error?.message || 'An unexpected error occurred'}
          </p>
          <Button
            onClick={() => navigate('/automations')}
            className="mt-4 h-10 px-6 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-red)' }}
          >
            Return to Automations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/automations')}
          className="flex items-center gap-2 text-sm font-semibold mb-4 transition-colors hover:opacity-80"
          style={{ color: 'var(--brand-navy)' }}
          data-testid="back-to-automations"
        >
          <ArrowLeft size={16} /> Back to Automations
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Automation name..."
              className="text-3xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 shadow-none"
              style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}
              data-testid="automation-name-input"
            />
            <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-dim)' }}>
              {isNew ? 'New automation' : 'Edit automation'}
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: enabled ? '#059669' : 'var(--text-dim)' }}>
                {enabled ? 'Active' : 'Paused'}
              </span>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                data-testid="automation-enabled-toggle"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Trigger indicator */}
      <div
        className="rounded-2xl border mb-6 overflow-hidden"
        style={{ borderColor: '#c0c9e8', backgroundColor: 'rgba(3,3,82,0.02)' }}
      >
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: 'linear-gradient(135deg, rgba(3,3,82,0.08) 0%, rgba(3,3,82,0.04) 100%)' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(3,3,82,0.12)' }}>
            <Activity size={17} style={{ color: '#030352' }} />
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: '#030352', fontFamily: 'Space Grotesk, sans-serif' }}>Trigger: New Lead Identified</div>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Fires when a contact's email or phone is first captured</div>
          </div>
        </div>
      </div>

      {/* Connector */}
      {steps.length > 0 && (
        <div className="flex justify-center py-2">
          <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: '#d2d8ef' }} />
        </div>
      )}

      {/* Steps */}
      <div className="space-y-0">
        {steps.map((step, idx) => (
          <StepCard
            key={step.id}
            step={step}
            index={idx}
            total={steps.length}
            onUpdate={updated => updateStep(step.id, updated)}
            onRemove={() => removeStep(step.id)}
            onMoveUp={() => moveStep(idx, -1)}
            onMoveDown={() => moveStep(idx, 1)}
          />
        ))}
      </div>

      {/* Add step button */}
      <div className="mt-6">
        <AddStepMenu onAdd={addStep} />
      </div>

      {/* Empty state hint */}
      {steps.length === 0 && (
        <div className="mt-8 rounded-2xl border-2 border-dashed p-8 text-center" style={{ borderColor: '#d2d8ef', backgroundColor: 'rgba(3,3,82,0.02)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(3,3,82,0.08)' }}>
            <Zap size={24} style={{ color: '#030352' }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)' }}>
            Build your automation pipeline
          </h3>
          <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
            Add steps to control when and how leads are sent to your webhook. Start with a <strong>Wait For</strong> step to ensure required fields are captured, add <strong>Filters</strong> to target specific leads, and configure <strong>Webhook</strong> steps to send data to your CRM or other services.
          </p>
        </div>
      )}

      {/* Footer actions */}
      <div
        className="fixed bottom-0 left-0 right-0 px-8 py-4 border-t flex items-center justify-end gap-3 z-50"
        style={{ backgroundColor: '#fff', borderColor: '#d2d8ef' }}
      >
        <Button
          variant="outline"
          onClick={() => navigate('/automations')}
          className="h-11 px-6 text-sm font-semibold"
          style={{ borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
          data-testid="cancel-button"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 h-11 px-8 text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--brand-red)' }}
          data-testid="save-automation-button"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isNew ? 'Create Automation' : 'Save Changes'}
        </Button>
      </div>

      {/* Bottom padding for fixed footer */}
      <div className="h-24" />
    </div>
  );
}
