import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowRight, Check, History, Pencil, Plus, Trash2, Workflow } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { AutomationRuns } from '@/components/AutomationRuns';
import { Metric, PageIntro, Status, SurfaceHead, count } from '@/workspace/ui';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function timeAgo(ts) {
  if (!ts) return null;
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const AUDIENCE = { new: 'New leads trigger', returning: 'Returning leads trigger', both: 'New & returning trigger' };

function AutomationCard({ auto, onEdit, onDelete, onToggle, onViewRuns }) {
  const filterCount = auto.filters?.length || 0;
  // Support both new actions[] and legacy field_map
  const actionCount = auto.actions?.length || (auto.webhook_url ? 1 : 0);
  const totalMapped = auto.actions?.reduce((s, a) => s + (a.field_map?.length || 0), 0)
                   || auto.field_map?.length || 0;
  // Display URL from first action or legacy webhook_url
  const displayUrl  = auto.actions?.[0]?.webhook_url || auto.webhook_url || '';

  return (
    <article className="sp-automation">
      <span className="sp-automation-icon"><Workflow size={20} /></span>
      <div className="sp-automation-main">
        <div className="sp-automation-title"><h3>{auto.name}</h3><Status tone={auto.enabled ? 'green' : 'quiet'}>{auto.enabled ? 'Active' : 'Paused'}</Status></div>
        <p data-testid={`automation-trigger-badge-${auto.id}`}>
          {AUDIENCE[auto.trigger_audience] || AUDIENCE.both} <ArrowRight size={13} /> <span className="sp-automation-url">{displayUrl || 'No webhook yet'}</span>
        </p>
        <div className="sp-automation-meta">
          {filterCount > 0 && <span>{filterCount} filter{filterCount !== 1 ? 's' : ''}</span>}
          {actionCount > 1 && <span>{actionCount} webhook steps</span>}
          {totalMapped > 0 && <span>{totalMapped} field{totalMapped !== 1 ? 's' : ''} mapped</span>}
          <span>{count(auto.trigger_count || 0)} runs</span>
          <span>{auto.last_triggered_at ? `Last fired ${timeAgo(auto.last_triggered_at)}` : 'Never fired'}</span>
        </div>
      </div>
      <div className="sp-automation-actions">
        <button type="button" className="sp-secondary-button" onClick={() => onViewRuns(auto)}>
          <History size={14} /> Runs{auto.trigger_count > 0 && <span className="sp-button-count">{count(auto.trigger_count)}</span>}
        </button>
        <button type="button" className="sp-secondary-button" onClick={() => onEdit(auto)}><Pencil size={14} /> Edit</button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button" className="sp-icon-button sp-danger-button" aria-label={`Delete ${auto.name}`}><Trash2 size={15} /></button>
          </AlertDialogTrigger>
          <AlertDialogContent className="sp-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Automation?</AlertDialogTitle>
              <AlertDialogDescription>"{auto.name}" will be permanently deleted.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="sp-secondary-button">Cancel</AlertDialogCancel>
              <AlertDialogAction className="sp-danger-solid" onClick={() => onDelete(auto.id)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <label className="sp-switch">
          <input type="checkbox" checked={!!auto.enabled} onChange={e => onToggle(auto.id, e.target.checked)}
            aria-label={`${auto.enabled ? 'Pause' : 'Activate'} ${auto.name}`} /><span />
        </label>
      </div>
    </article>
  );
}

function EmptyState({ onNew }) {
  return (
    <div className="sp-empty sp-empty-state">
      <span className="sp-empty-icon"><Workflow size={22} /></span>
      <strong>No automations yet</strong>
      <span>Automatically send lead data to your CRM, email platform, or any webhook when a contact is identified.</span>
      <button type="button" className="sp-primary-button" onClick={onNew}><Plus size={15} /> Create your first automation</button>
    </div>
  );
}

// Automations — design: the prototype's Automations page (workflow library), on the live automations API.
export default function AutomationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [runsAuto,    setRunsAuto]    = useState(null);

  const { data: automations = [], isLoading: loading } = useQuery({
    queryKey: ['automations'],
    queryFn: () => fetch(`${API}/automations`).then(r => {
      if (!r.ok) throw new Error('Failed');
      return r.json();
    }),
  });

  const handleDelete = async (id) => {
    try {
      await fetch(`${API}/automations/${id}`, { method: 'DELETE' });
      qc.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleToggle = async (id, enabled) => {
    try {
      const res = await fetch(`${API}/automations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ['automations'] });
      toast.success(enabled ? 'Automation activated' : 'Automation paused');
    } catch { toast.error('Failed to update'); }
  };

  const activeCount = automations.filter(a => a.enabled).length;

  const handleNewAutomation = () => navigate('/automations/new');
  const handleEditAutomation = (auto) => navigate(`/automations/builder/${auto.id}`);

  const totalRuns = automations.reduce((s, a) => s + (a.trigger_count || 0), 0);

  return <>
    <PageIntro eyebrow="Operations / Workflows" title="Automations"
      description="A simple view of what triggers, where data goes, and whether each workflow is working."
      actions={<button type="button" className="sp-primary-button" onClick={handleNewAutomation} data-testid="new-automation-button"><Plus size={17} /> New automation</button>} />
    <div className="sp-metrics sp-metrics-three">
      <Metric icon={Workflow} label="Active workflows" value={count(activeCount)} detail={`Of ${count(automations.length)} total`} />
      <Metric icon={Activity} label="Total runs" value={count(totalRuns)} detail="Across all workflows" tone="aqua" />
      <Metric icon={Check} label="Ready to send" value={count(activeCount)} detail="Switched on and listening" tone="green" />
    </div>
    <div className="sp-flow">
      <div><span>01</span><strong>Trigger</strong><small>A lead takes an action</small></div><ArrowRight size={17} />
      <div><span>02</span><strong>Conditions</strong><small>Check who qualifies</small></div><ArrowRight size={17} />
      <div><span>03</span><strong>Action</strong><small>Send or update data</small></div>
    </div>
    <section className="sp-surface">
      <SurfaceHead eyebrow="Workflow library" title="Your automations"><span className="sp-count">{count(automations.length)} workflows</span></SurfaceHead>
      {loading ? <div className="sp-empty">Loading automations…</div> : automations.length === 0 ? <EmptyState onNew={handleNewAutomation} /> : (
        <div className="sp-automation-list">
          {automations.map(auto => (
            <AutomationCard key={auto.id} auto={auto}
              onEdit={handleEditAutomation}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onViewRuns={a => setRunsAuto(a)}
            />
          ))}
        </div>
      )}
    </section>
    <AutomationRuns open={!!runsAuto} automation={runsAuto} onClose={() => setRunsAuto(null)} />
  </>;
}
