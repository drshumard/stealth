import { lazy, Suspense } from 'react';
import { Activity, BarChart3, Blocks, FileText, Layers, Radio, Target, Users } from 'lucide-react';
import { PageIntro } from '@/workspace/ui';
import FilterBar from './FilterBar';
import { useAnalyticsState } from './lib';
import Overview from './tabs/Overview';

const Pages = lazy(() => import('./tabs/Pages'));
const Visitors = lazy(() => import('./tabs/Visitors'));
const Leads = lazy(() => import('./tabs/Leads'));
const Attribution = lazy(() => import('./tabs/Attribution'));
const Cohorts = lazy(() => import('./tabs/Cohorts'));
const Explorer = lazy(() => import('./tabs/Explorer'));
const Live = lazy(() => import('./tabs/Live'));

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3, C: Overview },
  { id: 'pages', label: 'Pages', icon: FileText, C: Pages },
  { id: 'visitors', label: 'Visitors', icon: Users, C: Visitors },
  { id: 'leads', label: 'Leads & abandonment', icon: Target, C: Leads },
  { id: 'attribution', label: 'Attribution', icon: Layers, C: Attribution },
  { id: 'cohorts', label: 'Cohorts', icon: Activity, C: Cohorts },
  { id: 'explorer', label: 'Report builder', icon: Blocks, C: Explorer },
  { id: 'live', label: 'Live', icon: Radio, C: Live },
];

// Analytics — the workspace's analysis suite over every visit, contact, registration and sale (backend/analytics.py).
export default function AnalyticsPage({ onSelectContact }) {
  const [state, update] = useAnalyticsState();
  const tab = TABS.find(t => t.id === state.tab) || TABS[0];
  const Tab = tab.C;
  return <>
    <PageIntro eyebrow="Insights / Performance" title="Analytics" description="Understand which sources bring people in, and where they move next." />
    <nav className="an-tabs" aria-label="Analytics sections">
      {TABS.map(t => (
        <button key={t.id} type="button" aria-current={t.id === tab.id ? 'page' : undefined}
          onClick={() => update({ tab: t.id === 'overview' ? null : t.id, pg: null })}>
          <t.icon size={15} />{t.label}
        </button>
      ))}
    </nav>
    {tab.id !== 'live' && <FilterBar state={state} update={update} />}
    <div className="an-body">
      <Suspense fallback={<div className="an-state an-loading"><span className="sp-skeleton" /><span className="sp-skeleton" /></div>}>
        <Tab state={state} update={update} drill={update} onSelectContact={onSelectContact} />
      </Suspense>
    </div>
  </>;
}
