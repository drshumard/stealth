import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, DollarSign, Globe2, ShieldCheck, Users } from 'lucide-react';
import { useTimezone } from '@/components/TimezoneContext';
import { SHOW_SALES } from '@/analytics/lib';
import { Metric, SurfaceHead, count, money } from './ui';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;
const getJson = url => fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.json(); });

// Overview (home) — design: the prototype's Overview, on live data. Totals and sources are counted by the backend over
// every record (/api/stats, /api/stats/sources — the list endpoints stop at the newest 500/1,000/10,000); recent
// signals merge the newest page visits, registrations and sales.
export default function OverviewPage({ stats, onSelectContact }) {
  const navigate = useNavigate();
  const { formatTime, formatDate } = useTimezone();
  const opts = { refetchInterval: 15_000 };
  const { data: visits = [] } = useQuery({ queryKey: ['overview-visits'], queryFn: () => getJson(`${API}/logs?limit=5`), ...opts });
  const { data: regs = [] } = useQuery({ queryKey: ['overview-registrations'], queryFn: () => getJson(`${API}/stealth?limit=5`), ...opts });
  const { data: sales = [] } = useQuery({ queryKey: ['overview-sales'], queryFn: () => getJson(`${API}/sales?limit=5`), ...opts });
  const { data: sourceRows = [] } = useQuery({ queryKey: ['overview-sources'], queryFn: () => getJson(`${API}/stats/sources?limit=5`), refetchInterval: 60_000 });

  const signals = useMemo(() => [
    ...visits.map(v => ({ key: `v-${v.timestamp}-${v.session_id}`, type: 'visit', at: v.timestamp, contactId: v.contact_id,
      actor: v.contact_name || v.contact_email || 'Anonymous visitor', detail: `Visited ${v.page_title || v.url}` })),
    ...regs.map(r => ({ key: `r-${r.id}`, type: 'registration', at: r.registered_at, contactId: r.contact_id,
      actor: r.name || r.email, detail: 'Registered for the webinar' })),
    ...sales.map(s => ({ key: `s-${s.id}`, type: 'sale', at: s.created_at, contactId: s.contact_id,
      actor: s.contact_name || s.contact_email || s.email, detail: `Paid ${money(s.amount, s.currency)}${s.product ? ` · ${s.product}` : ''}` })),
  ].filter(s => s.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5), [visits, regs, sales]);

  const max = sourceRows[0]?.contacts || 1;
  const sources = sourceRows.map(r => ({ name: r.source, leads: r.contacts, percent: Math.round((r.contacts / max) * 100) }));

  // Today's signals show their time; older ones their date (both in the display timezone).
  const today = formatDate(new Date());
  const when = at => (formatDate(at) === today ? formatTime(at) : formatDate(at));

  return <>
    <div className="sp-hero">
      <div className="sp-hero-copy">
        <div className="sp-hero-tags"><span>STEALTH / OVERVIEW</span></div>
        <h1>Every signal, <em>in one place.</em></h1>
        <p>Follow the path from first visit to webinar registration, lead, and sale without losing the human story behind each number.</p>
        <button className="sp-hero-action" onClick={() => navigate('/stealth')}>Explore registrations <ArrowRight size={17} /></button>
      </div>
      <div className="sp-hero-panel">
        <span className="sp-panel-label">JOURNEY SNAPSHOT</span>
        <div><span>01</span><strong>Visitor tracked</strong><Check size={17} /></div>
        <div><span>02</span><strong>Lead identified</strong><Check size={17} /></div>
        <div><span>03</span><strong>Webinar registered</strong><Check size={17} /></div>
        <div><span>04</span><strong>Sale connected</strong><ArrowUpRight size={17} /></div>
      </div>
    </div>
    <div className={`sp-metrics${SHOW_SALES ? '' : ' sp-metrics-three'}`}>
      <Metric icon={Globe2} label="Tracked visits" value={count(stats.total_visits)} detail="Across connected pages" />
      <Metric icon={Users} label="Identified leads" value={count(stats.total_identified)} detail="Known people" tone="aqua" />
      <Metric icon={ShieldCheck} label="Registrations" value={count(stats.total_registrations)} detail="StealthWebinar" tone="amber" />
      {SHOW_SALES && <Metric icon={DollarSign} label="Connected sales" value={stats.total_revenue == null ? '—' : money(stats.total_revenue)}
        detail={stats.total_sales == null ? 'Revenue' : `${count(stats.total_sales)} sales`} tone="green" />}
    </div>
    <div className="sp-overview-grid">
      <section className="sp-surface">
        <SurfaceHead eyebrow="Live journey" title="Recent signals"><Link to="/logs" className="sp-text-link">View activity <ArrowUpRight size={15} /></Link></SurfaceHead>
        <div className="sp-timeline">
          {signals.length ? signals.map(s => (
            <button key={s.key} className="sp-timeline-row" onClick={() => s.contactId && onSelectContact(s.contactId, s.type === 'sale' ? 'sales' : 'overview')} disabled={!s.contactId}>
              <span className="sp-timeline-dot" data-tone={s.type} />
              <span><strong>{s.actor}</strong><small>{s.detail}</small></span>
              <time dateTime={s.at}>{when(s.at)}</time>
            </button>
          )) : <div className="sp-empty">No signals yet.</div>}
        </div>
      </section>
      <section className="sp-surface">
        <SurfaceHead eyebrow="Attribution" title="Where leads begin"><Link to="/analytics" className="sp-text-link">Explore <ArrowUpRight size={15} /></Link></SurfaceHead>
        <div className="sp-sources">
          {sources.length ? sources.map(s => (
            <div className="sp-source-row" key={s.name}>
              <div><strong>{s.name}</strong><span>{count(s.leads)} leads</span></div>
              <div className="sp-source-track"><span style={{ width: `${s.percent}%` }} /></div>
            </div>
          )) : <div className="sp-empty">No tracked sources yet.</div>}
        </div>
        <div className="sp-sources-foot"><ArrowDownRight size={16} /> Clearer attribution from visit through purchase</div>
      </section>
    </div>
  </>;
}
