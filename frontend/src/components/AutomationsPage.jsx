import { useState, useEffect, useCallback } from 'react';
import { Zap, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, CheckCircle, XCircle, Globe, Clock, ChevronRight, Activity, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { AutomationBuilder } from '@/components/AutomationBuilder';
import { AutomationRuns } from '@/components/AutomationRuns';
import { toast } from 'sonner';
import { AutomationBuilder } from '@/components/AutomationBuilder';

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

function AutomationCard({ auto, onEdit, onDelete, onToggle, onViewRuns }) {
  const filterCount = auto.filters?.length || 0;
  const mapCount    = auto.field_map?.length || 0;

  return (
    <div
      className="rounded-2xl border transition-all duration-150 overflow-hidden"
      style={{
        borderColor: auto.enabled ? '#c0c9e8' : 'var(--stroke)',
        backgroundColor: auto.enabled ? 'rgba(3,3,82,0.018)' : '#fafaf8',
        boxShadow: auto.enabled ? '0 2px 12px rgba(3,3,82,0.08)' : 'none',
      }}
    >
      {/* Top accent bar */}
      {auto.enabled && (
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #030352, #3a3d7c)' }} />
      )}

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{
                backgroundColor: auto.enabled ? 'rgba(3,3,82,0.10)' : '#f0ede8',
              }}
            >
              <Zap size={18} style={{ color: auto.enabled ? '#030352' : '#9898aa' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif' }}>
                {auto.name}
              </h3>
              <p className="text-xs font-mono mt-0.5 max-w-xs truncate" style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono, monospace' }}>
                {auto.webhook_url}
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold" style={{ color: auto.enabled ? '#030352' : 'var(--text-dim)' }}>
              {auto.enabled ? 'Active' : 'Paused'}
            </span>
            <Switch
              checked={auto.enabled}
              onCheckedChange={v => onToggle(auto.id, v)}
              data-testid={`automation-toggle-${auto.id}`}
            />
          </div>
        </div>

        {/* Meta chips */}
        <div className="flex items-center flex-wrap gap-2 mb-5">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(3,3,82,0.08)', color: '#030352' }}
          >
            <Activity size={11} /> New Lead trigger
          </span>
          {filterCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(163,24,0,0.08)', color: '#A31800' }}>
              {filterCount} filter{filterCount !== 1 ? 's' : ''}
            </span>
          )}
          {mapCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(3,3,82,0.05)', color: '#4a5568' }}>
              {mapCount} field{mapCount !== 1 ? 's' : ''} mapped
            </span>
          )}
        </div>

        {/* Stats row */}
        <div
          className="flex items-center justify-between py-3 px-4 rounded-xl mb-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
        >
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums" style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif' }}>
              {auto.trigger_count || 0}
            </div>
            <div className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>triggers</div>
          </div>
          <div className="w-px h-8" style={{ backgroundColor: 'var(--stroke)' }} />
          <div className="text-center">
            {auto.last_triggered_at ? (
              <>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{timeAgo(auto.last_triggered_at)}</div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>last fired</div>
              </>
            ) : (
              <div className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>never fired</div>
            )}
          </div>
          <div className="w-px h-8" style={{ backgroundColor: 'var(--stroke)' }} />
          <div className="text-center">
            <div
              className="inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: auto.enabled ? '#059669' : 'var(--text-dim)' }}
            >
              {auto.enabled
                ? <><CheckCircle size={13} /> Ready</>
                : <><XCircle size={13} /> Paused</>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewRuns(auto)}
            className="gap-1.5 h-9 px-3 text-sm font-semibold"
            style={{ borderColor: '#d2d8ef', color: '#030352' }}
            title="View run history"
          >
            <History size={13} />
            Runs
            {auto.trigger_count > 0 && (
              <span className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-full ml-0.5"
                style={{ backgroundColor: 'rgba(3,3,82,0.1)', color: '#030352' }}>
                {auto.trigger_count}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(auto)}
            className="flex-1 h-9 gap-2 text-sm font-semibold"
            style={{ borderColor: 'var(--brand-navy)', color: 'var(--brand-navy)' }}
          >
            <Pencil size={13} /> Edit
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 w-9 p-0"
                style={{ borderColor: '#fecdc7', color: 'var(--brand-red)' }}>
                <Trash2 size={14} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent style={{ backgroundColor: '#fff', borderColor: 'var(--stroke)' }}>
              <AlertDialogHeader>
                <AlertDialogTitle style={{ color: 'var(--brand-navy)' }}>Delete Automation?</AlertDialogTitle>
                <AlertDialogDescription style={{ color: 'var(--text-muted)' }}>
                  "{auto.name}" will be permanently deleted. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel style={{ borderColor: 'var(--stroke)' }}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(auto.id)}
                  style={{ backgroundColor: 'var(--brand-red)', color: '#fff', border: 'none' }}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onNew }) {
  return (
    <div
      className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-20 px-8 text-center"
      style={{ borderColor: '#d2d8ef', backgroundColor: 'rgba(3,3,82,0.02)' }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'linear-gradient(135deg, #e8ebf5, #f2f3f9)' }}
      >
        <Zap size={28} style={{ color: '#030352' }} />
      </div>
      <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)' }}>
        No automations yet
      </h3>
      <p className="text-sm font-medium max-w-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Automatically send lead data to your CRM, email platform, or any webhook when a contact is identified.
      </p>
      <Button
        onClick={onNew}
        className="gap-2 h-10 px-6 text-sm font-semibold text-white"
        style={{ backgroundColor: 'var(--brand-red)' }}
      >
        <Plus size={15} /> Create your first automation
      </Button>
    </div>
  );
}

export default function AutomationsPage() {
  const [automations, setAutomations]  = useState([]);
  const [loading, setLoading]          = useState(true);
  const [builderOpen, setBuilderOpen]  = useState(false);
  const [editingAuto, setEditingAuto]  = useState(null);
  const [runsAuto,    setRunsAuto]     = useState(null);

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch(`${API}/automations`);
      if (!res.ok) throw new Error();
      setAutomations(await res.json());
    } catch { toast.error('Failed to load automations'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

  const handleDelete = async (id) => {
    try {
      await fetch(`${API}/automations/${id}`, { method: 'DELETE' });
      setAutomations(prev => prev.filter(a => a.id !== id));
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
      const updated = await res.json();
      setAutomations(prev => prev.map(a => a.id === id ? updated : a));
      toast.success(enabled ? 'Automation activated' : 'Automation paused');
    } catch { toast.error('Failed to update'); }
  };

  const handleSave = (saved) => {
    setAutomations(prev => {
      const idx = prev.findIndex(a => a.id === saved.id);
      return idx >= 0 ? prev.map(a => a.id === saved.id ? saved : a) : [saved, ...prev];
    });
    setBuilderOpen(false);
    setEditingAuto(null);
  };

  const handleNew = () => { setEditingAuto(null); setBuilderOpen(true); };
  const handleEdit = (auto) => { setEditingAuto(auto); setBuilderOpen(true); };
  const handleViewRuns = (auto) => { setRunsAuto(auto); };

  const activeCount = automations.filter(a => a.enabled).length;

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
        <Zap size={140} className="absolute -right-6 -bottom-6 opacity-[0.05] pointer-events-none" color="#030352" aria-hidden />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>Automations</h1>
            <p className="text-base mt-1 font-semibold" style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>
              {activeCount} active · {automations.length} total
            </p>
          </div>
          <Button
            onClick={handleNew}
            className="gap-2 h-10 px-6 text-sm font-semibold text-white mt-1"
            style={{ backgroundColor: 'var(--brand-red)' }}
            data-testid="new-automation-button"
          >
            <Plus size={15} /> New Automation
          </Button>
        </div>
      </div>

      {/* How it works strip */}
      <div
        className="rounded-2xl px-6 py-4 mb-8 flex items-center gap-6 overflow-x-auto"
        style={{ background: 'linear-gradient(135deg, #f2f3f9, #fdf2f0)', border: '1.5px solid #d2d8ef' }}
      >
        {[
          { icon: Activity, label: 'Trigger', desc: 'Lead identified', color: '#030352' },
          { icon: null, label: '→', desc: '', color: '#9898aa' },
          { icon: Zap, label: 'Filter', desc: 'Apply conditions', color: '#A31800' },
          { icon: null, label: '→', desc: '', color: '#9898aa' },
          { icon: Globe, label: 'Map Fields', desc: 'Transform data', color: '#030352' },
          { icon: null, label: '→', desc: '', color: '#9898aa' },
          { icon: CheckCircle, label: 'Webhook POST', desc: 'Send to your URL', color: '#059669' },
        ].map((step, i) => (
          step.icon ? (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${step.color}18` }}>
                <step.icon size={15} style={{ color: step.color }} />
              </div>
              <div>
                <div className="text-xs font-bold" style={{ color: step.color }}>{step.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{step.desc}</div>
              </div>
            </div>
          ) : (
            <ChevronRight key={i} size={16} style={{ color: step.color }} className="shrink-0" />
          )
        ))}
      </div>

      {/* Automation cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-2xl" style={{ backgroundColor: '#f0ede8' }} />)}
        </div>
      ) : automations.length === 0 ? (
        <EmptyState onNew={handleNew} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {automations.map(auto => (
            <AutomationCard
              key={auto.id}
              auto={auto}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Builder sheet */}
      <AutomationBuilder
        open={builderOpen}
        automation={editingAuto}
        onClose={() => { setBuilderOpen(false); setEditingAuto(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
