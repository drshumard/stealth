import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, ChevronUp, ChevronDown, Trash2, Save, Loader2,
  Clock, Filter, Globe, ShieldCheck, Zap, X,
  Activity, ArrowRight, AlertTriangle, Copy
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PageIntro } from '@/workspace/ui';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// ─────────────────────────── Constants ───────────────────────────
const STEP_TYPES = [
  { type: 'wait_for', label: 'Wait For', icon: ShieldCheck, tone: 'green',  desc: 'Wait for required fields' },
  { type: 'filter',   label: 'Filter',   icon: Filter,      tone: 'amber',  desc: 'Apply conditions' },
  { type: 'delay',    label: 'Delay',    icon: Clock,       tone: 'aqua',   desc: 'Wait then refetch' },
  { type: 'webhook',  label: 'Webhook',  icon: Globe,       tone: 'blue',   desc: 'Send to URL' },
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
  { value: 'fbc',          label: 'Facebook Click ID (fbc)' },
  { value: 'fbp',          label: 'Facebook Browser ID (fbp)' },
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

// A native select in the workspace style.
const Pick = ({ value, onChange, options, testId, label, className = '' }) => (
  <label className={`sp-select-wrap sp-field-select ${className}`}><span className="sr-only">{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)} data-testid={testId}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select><ChevronDown size={15} aria-hidden="true" /></label>
);

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
    <div className="sp-step-editor">
      <p className="sp-step-help">Automation pauses until <strong>all selected fields</strong> are present on the contact.</p>
      <div className="sp-chip-toggles">
        {['email', 'phone', 'name'].map(field => {
          const active = fields.includes(field);
          return (
            <button key={field} type="button" onClick={() => toggleField(field)} data-testid={`wait-for-field-${field}`} aria-pressed={active}>
              <span className="sp-chip-check">{active && '✓'}</span>
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </button>
          );
        })}
      </div>
      {fields.length === 0 && <p className="sp-field-error">⚠ Select at least one required field</p>}
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
    <div className="sp-step-editor">
      <p className="sp-step-help">Only contacts matching <strong>all conditions</strong> proceed to the next step.</p>
      {filters.length === 0 ? (
        <p className="sp-step-muted">No conditions — all contacts pass through.</p>
      ) : (
        <div className="sp-rule-list">
          {filters.map((f, idx) => {
            const needsValue = !['exists', 'not_exists'].includes(f.operator);
            return (
              <div key={f.id} className="sp-rule">
                {idx > 0 && <span className="sp-rule-and">AND</span>}
                <Pick value={f.field} onChange={v => updateFilter(f.id, { field: v })} options={FILTER_FIELDS} testId={`filter-field-${f.id}`} label="Field" />
                <Pick value={f.operator} onChange={v => updateFilter(f.id, { operator: v, value: '' })} options={OPERATORS} testId={`filter-operator-${f.id}`} label="Operator" />
                {needsValue && (
                  <input className="sp-input" value={f.value || ''} onChange={e => updateFilter(f.id, { value: e.target.value })}
                    placeholder="value" data-testid={`filter-value-${f.id}`} aria-label="Value" />
                )}
                <button type="button" className="sp-icon-button sp-row-remove" onClick={() => removeFilter(f.id)} data-testid={`filter-remove-${f.id}`} aria-label="Remove condition">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <button type="button" className="sp-add-link" onClick={addFilter} data-testid="add-filter-condition"><Plus size={13} /> Add condition</button>
    </div>
  );
}

/** Delay Step Editor */
function DelayEditor({ config, onChange }) {
  const seconds = config?.seconds ?? 60;

  return (
    <div className="sp-step-editor">
      <p className="sp-step-help">
        Wait the specified time, then <strong>refetch the contact's latest data</strong> before proceeding.
        Useful for capturing phone numbers that arrive shortly after email.
      </p>
      <div className="sp-delay">
        <label htmlFor="delay-seconds">Wait</label>
        <input id="delay-seconds" className="sp-input" type="number" min="0" max="86400" value={seconds}
          onChange={e => onChange({ ...config, seconds: Math.max(0, parseInt(e.target.value) || 0) })}
          data-testid="delay-seconds-input" />
        <span>seconds</span>
        <span className="sp-status" data-tone="quiet">{seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`}</span>
      </div>
    </div>
  );
}

/** Webhook Step Editor */
function WebhookEditor({ config, onChange }) {
  const url = config?.url || '';
  const name = config?.name || '';
  const fieldMap = config?.field_map || [];
  const excludeNulls = config?.exclude_nulls ?? true;  // Default to true

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
    <div className="sp-step-editor">
      <label className="sp-form-field">
        <span>Step Name <small>(optional)</small></span>
        <input className="sp-input" value={name} onChange={e => onChange({ ...config, name: e.target.value })}
          placeholder="e.g. Send to GoHighLevel" data-testid="webhook-name-input" />
      </label>
      <label className="sp-form-field">
        <span>Webhook URL <small className="sp-required">*</small></span>
        <input className="sp-input" value={url} onChange={e => onChange({ ...config, url: e.target.value })}
          placeholder="https://hooks.zapier.com/hooks/catch/..." data-testid="webhook-url-input" />
        {!url && <span className="sp-field-error">Webhook URL is required</span>}
      </label>

      {/* Exclude null fields option */}
      <label className="sp-check-row" htmlFor="exclude-nulls">
        <input type="checkbox" id="exclude-nulls" checked={excludeNulls}
          onChange={e => onChange({ ...config, exclude_nulls: e.target.checked })} data-testid="webhook-exclude-nulls" />
        <span><strong>Exclude null fields</strong> — Don't send fields that have no value</span>
      </label>

      <div className="sp-form-field">
        <span>Field Mapping <small>(optional)</small></span>
        <p className="sp-step-muted">Map Tether fields to custom webhook field names. Leave empty to send all fields with default names.</p>
        {fieldMap.length > 0 && (
          <div className="sp-rule-list">
            {fieldMap.map(m => (
              <div key={m.id} className="sp-rule sp-mapping">
                <Pick value={m.source} onChange={v => updateMapping(m.id, { source: v })} options={TETHER_FIELDS} testId={`mapping-source-${m.id}`} label="Tether field" />
                <ArrowRight size={14} className="sp-mapping-arrow" />
                <input className="sp-input" value={m.target || ''} onChange={e => updateMapping(m.id, { target: e.target.value })}
                  placeholder="webhook field name" data-testid={`mapping-target-${m.id}`} aria-label="Webhook field name" />
                <button type="button" className="sp-icon-button sp-row-remove" onClick={() => removeMapping(m.id)} data-testid={`mapping-remove-${m.id}`} aria-label="Remove mapping">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="sp-add-link" onClick={addMapping} data-testid="add-field-mapping"><Plus size={13} /> Add mapping</button>
      </div>
    </div>
  );
}

// ─────────────────────────── Step Card ───────────────────────────

function StepCard({ step, index, total, onUpdate, onRemove, onMoveUp, onMoveDown, onDuplicate }) {
  const typeInfo = STEP_TYPES.find(t => t.type === step.type) || STEP_TYPES[0];
  const Icon = typeInfo.icon;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const renderEditor = () => {
    switch (step.type) {
      case 'wait_for': return <WaitForEditor config={step.config} onChange={c => onUpdate({ ...step, config: c })} />;
      case 'filter':   return <FilterEditor config={step.config} onChange={c => onUpdate({ ...step, config: c })} />;
      case 'delay':    return <DelayEditor config={step.config} onChange={c => onUpdate({ ...step, config: c })} />;
      case 'webhook':  return <WebhookEditor config={step.config} onChange={c => onUpdate({ ...step, config: c })} />;
      default: return <p className="sp-step-muted">Unknown step type</p>;
    }
  };

  return (
    <>
      <section className="sp-step" data-testid={`step-card-${step.id}`}>
        <div className="sp-step-head">
          <span className="sp-step-number">{String(index + 1).padStart(2, '0')}</span>
          <span className="sp-metric-icon" data-tone={typeInfo.tone}><Icon size={17} /></span>
          <div className="sp-step-title"><strong>{typeInfo.label}</strong><small>{typeInfo.desc}</small></div>
          <div className="sp-step-tools">
            <button type="button" className="sp-icon-button" onClick={onMoveUp} disabled={index === 0} data-testid={`step-move-up-${step.id}`} title="Move up" aria-label="Move up"><ChevronUp size={16} /></button>
            <button type="button" className="sp-icon-button" onClick={onMoveDown} disabled={index === total - 1} data-testid={`step-move-down-${step.id}`} title="Move down" aria-label="Move down"><ChevronDown size={16} /></button>
            <button type="button" className="sp-icon-button" onClick={onDuplicate} data-testid={`step-duplicate-${step.id}`} title="Duplicate step" aria-label="Duplicate step"><Copy size={15} /></button>
            <button type="button" className="sp-icon-button sp-danger-button" onClick={() => setConfirmDelete(true)} data-testid={`step-remove-${step.id}`} title="Delete step" aria-label="Delete step"><Trash2 size={15} /></button>
          </div>
        </div>
        <div className="sp-step-body">{renderEditor()}</div>
      </section>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="sp-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Step?</AlertDialogTitle>
            <AlertDialogDescription>This {typeInfo.label} step will be removed from the automation.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="sp-secondary-button">Cancel</AlertDialogCancel>
            <AlertDialogAction className="sp-danger-solid" onClick={() => { onRemove(); setConfirmDelete(false); }}>Remove</AlertDialogAction>
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
        <button type="button" className="sp-secondary-button sp-add-step" data-testid="add-step-button"><Plus size={17} /> Add Step</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="sp-popover sp-step-menu">
        {STEP_TYPES.map(st => (
          <DropdownMenuItem key={st.type} onClick={() => onAdd(st.type)} data-testid={`add-step-${st.type}`} className="sp-step-menu-item">
            <span className="sp-metric-icon" data-tone={st.tone}><st.icon size={15} /></span>
            <span><strong>{st.label}</strong><small>{st.desc}</small></span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────── Main Page ───────────────────────────
// Automation builder — design: the prototype's workflow sketch (trigger → conditions → action), as a page with the live
// step editor.
export default function AutomationBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !id || id === 'new';

  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [triggerAudience, setTriggerAudience] = useState('both');
  const [steps, setSteps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

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
      setTriggerAudience(automation.trigger_audience || 'both');
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
              exclude_nulls: true, // Default for converted legacy automations
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
    if (initialized || isNew) setHasChanges(true);
  }, [name, enabled, triggerAudience, steps, automation, initialized, isNew]);

  // Reset hasChanges for new automations after initial render
  useEffect(() => {
    if (isNew) {
      // Don't mark as changed until user actually makes a change
      const timer = setTimeout(() => setHasChanges(false), 100);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  // Keep a ref in sync with hasChanges so the navigation blocker always reads
  // the freshest value (and can be flipped synchronously before navigating).
  const hasChangesRef = useRef(false);
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);

  // Browser beforeunload warning (tab close / refresh / external navigation)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Native route blocking (Data Router) — intercepts ALL in-app navigation,
  // including sidebar links, back/forward buttons, and programmatic navigate().
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasChangesRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  // Show the unsaved-changes dialog whenever a navigation gets blocked
  useEffect(() => {
    if (blocker.state === 'blocked') setShowUnsavedDialog(true);
  }, [blocker.state]);

  // Handle leaving after unsaved changes dialog
  const handleLeaveWithoutSaving = useCallback(() => {
    setShowUnsavedDialog(false);
    setHasChanges(false);
    hasChangesRef.current = false;
    if (blocker.state === 'blocked') blocker.proceed();
  }, [blocker]);

  // Handle staying on page
  const handleStay = useCallback(() => {
    setShowUnsavedDialog(false);
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  // Add a step
  const addStep = (type) => {
    const defaultConfig = {
      wait_for: { fields: ['email'] },
      filter: { filters: [] },
      delay: { seconds: 60 },
      webhook: { name: '', url: '', field_map: [], exclude_nulls: true },
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
    setSteps(prev => {
      const newSteps = [...prev];
      [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
      return newSteps;
    });
  };

  // Duplicate a step
  const duplicateStep = (index) => {
    const stepToDuplicate = steps[index];
    const duplicatedStep = {
      ...JSON.parse(JSON.stringify(stepToDuplicate)), // Deep clone
      id: uuid4(), // New unique ID
    };
    // If webhook step, append "(copy)" to name if it has one
    if (duplicatedStep.type === 'webhook' && duplicatedStep.config?.name) {
      duplicatedStep.config.name = `${duplicatedStep.config.name} (copy)`;
    }
    setSteps(prev => {
      const newSteps = [...prev];
      newSteps.splice(index + 1, 0, duplicatedStep);
      return newSteps;
    });
    toast.success('Step duplicated');
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
        trigger_audience: triggerAudience,
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

      setHasChanges(false); // Reset changes flag before navigation
      hasChangesRef.current = false; // Sync ref immediately so the blocker lets the redirect through
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
    return <div className="sp-drawer-loading sp-builder-loading">{[1, 2, 3].map(i => <span key={i} className="sp-skeleton" />)}</div>;
  }

  // Error state
  if (!isNew && isError) {
    return <>
      <button type="button" className="sp-back" onClick={() => navigate('/automations')}><ArrowLeft size={16} /> Back to Automations</button>
      <div className="sp-surface sp-empty sp-empty-state">
        <span className="sp-empty-icon"><AlertTriangle size={22} /></span>
        <strong>Failed to load automation</strong>
        <span>{error?.message || 'An unexpected error occurred'}</span>
        <button type="button" className="sp-primary-button" onClick={() => navigate('/automations')}>Return to Automations</button>
      </div>
    </>;
  }

  return (
    <div className="sp-builder-page">
      {/* Unsaved changes dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={(open) => { if (!open) handleStay(); }}>
        <AlertDialogContent className="sp-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this automation. Are you sure you want to leave? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="sp-secondary-button" onClick={handleStay}>Stay</AlertDialogCancel>
            <AlertDialogAction className="sp-danger-solid" onClick={handleLeaveWithoutSaving} data-testid="leave-without-saving-btn">
              Leave Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <button type="button" className="sp-back" onClick={() => navigate('/automations')} data-testid="back-to-automations"><ArrowLeft size={16} /> Back to Automations</button>
      <PageIntro eyebrow={`Operations / Workflows / ${isNew ? 'New automation' : 'Edit automation'}`} title={isNew ? 'New automation' : 'Edit automation'}
        description="Sketch the path from a customer signal to the next action."
        actions={<label className="sp-switch-row">
          <span className="sp-status" data-tone={enabled ? 'green' : 'quiet'}>{enabled ? 'Active' : 'Paused'}</span>
          <span className="sp-switch"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
            data-testid="automation-enabled-toggle" aria-label={enabled ? 'Pause automation' : 'Activate automation'} /><span /></span>
        </label>} />

      <section className="sp-surface sp-builder-name">
        <label className="sp-form-field">
          <span>Workflow name {hasChanges && <small className="sp-unsaved">• Unsaved changes</small>}</span>
          <input className="sp-input sp-input-large" value={name} onChange={e => setName(e.target.value)} placeholder="Automation name..." data-testid="automation-name-input" />
        </label>
      </section>

      {/* Trigger indicator */}
      <section className="sp-step sp-trigger">
        <div className="sp-step-head">
          <span className="sp-step-number">00</span>
          <span className="sp-metric-icon"><Activity size={17} /></span>
          <div className="sp-step-title"><strong>Trigger: Lead Identified</strong>
            <small>
              {triggerAudience === 'new' && "Fires only the first time a contact's email or phone is captured"}
              {triggerAudience === 'returning' && 'Fires when a known contact is re-identified via a new ad click or re-signup'}
              {triggerAudience === 'both' && 'Fires for first-time contacts and known contacts returning via a new ad click'}
            </small>
          </div>
          <div className="sp-step-tools">
            <span className="sp-step-muted">Fire for</span>
            <Pick value={triggerAudience} onChange={setTriggerAudience} testId="trigger-audience-select" label="Fire for"
              options={[{ value: 'both', label: 'New & returning contacts' }, { value: 'new', label: 'New contacts only' }, { value: 'returning', label: 'Returning contacts only' }]} />
          </div>
        </div>
      </section>

      {/* Steps with animation */}
      <div className="sp-steps">
        <AnimatePresence mode="popLayout">
          {steps.map((step, idx) => (
            <motion.div
              key={step.id}
              layout
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
              className="sp-step-wrap"
            >
              <StepCard
                step={step}
                index={idx}
                total={steps.length}
                onUpdate={updated => updateStep(step.id, updated)}
                onRemove={() => removeStep(step.id)}
                onMoveUp={() => moveStep(idx, -1)}
                onMoveDown={() => moveStep(idx, 1)}
                onDuplicate={() => duplicateStep(idx)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add step button */}
      <div className="sp-add-step-row"><AddStepMenu onAdd={addStep} /></div>

      {/* Empty state hint */}
      {steps.length === 0 && (
        <div className="sp-flow sp-builder-hint">
          <span className="sp-empty-icon"><Zap size={20} /></span>
          <div><strong>Build your automation pipeline</strong>
            <small>Add steps to control when and how leads are sent to your webhook. Start with a <b>Wait For</b> step to ensure required fields are captured, add <b>Filters</b> to target specific leads, and configure <b>Webhook</b> steps to send data to your CRM or other services.</small>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="sp-builder-foot">
        <button type="button" className="sp-secondary-button" onClick={() => navigate('/automations')} data-testid="cancel-button">Cancel</button>
        <button type="button" className="sp-primary-button" onClick={handleSave} disabled={saving} data-testid="save-automation-button">
          {saving ? <Loader2 size={16} className="sp-spin" /> : <Save size={16} />}
          {isNew ? 'Create Automation' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
