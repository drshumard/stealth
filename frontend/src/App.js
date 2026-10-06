import '@/App.css';
import { useState } from 'react';
import {
  createBrowserRouter, RouterProvider, Outlet,
  useLocation, useSearchParams, useOutletContext,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { TimezoneProvider } from '@/components/TimezoneContext';
import WorkspaceShell from '@/workspace/WorkspaceShell';
import OverviewPage from '@/workspace/OverviewPage';
import AnalyticsPage from '@/analytics/AnalyticsPage';
import LeadsPage from '@/components/LeadsPage';
import VisitorsPage from '@/components/VisitorsPage';
import LogsPage from '@/components/LogsPage';
import AutomationsPage from '@/components/AutomationsPage';
import AutomationBuilderPage from '@/components/AutomationBuilderPage';
import SalesPage from '@/components/SalesPage';
import StealthPage from '@/components/StealthPage';
import LoginPage from '@/components/LoginPage';
import ResetPasswordPage from '@/components/ResetPasswordPage';
import UsersPage from '@/workspace/UsersPage';
import { TOKEN_KEY, authJson } from '@/workspace/auth';
import { ContactDetailModal } from '@/components/ContactDetailModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppShell() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  const handleLogin  = (token) => { localStorage.setItem(TOKEN_KEY, token); setAuthToken(token); };
  const handleLogout = () => {
    authJson('/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    qc.removeQueries({ queryKey: ['me'] });
  };

  // The server checks the session; a missing, expired or revoked token signs out.
  const me = useQuery({
    queryKey: ['me', authToken],
    queryFn: () => authJson('/auth/me'),
    enabled: !!authToken,
    retry: false,
    staleTime: 300_000,
  });
  const sessionRejected = me.error?.status === 401;
  const user = me.data?.user;


  const selectedContactId = searchParams.get('contact');
  const selectedTab       = searchParams.get('tab') || 'overview';
  const modalOpen         = !!selectedContactId;

  // ── Contacts list ──────────────────────────────────────────
  const {
    data:      contacts  = [],
    isLoading: initialLoad,
    isFetching: loading,
  } = useQuery({
    queryKey: ['contacts'],
    queryFn:  () => fetch(`${API}/contacts`).then(r => {
      if (!r.ok) throw new Error('Failed to load contacts');
      return r.json();
    }),
    refetchInterval: 15_000,
    enabled: !!authToken,
  });

  // ── Stats ──────────────────────────────────────────────────
  const { data: stats = { total_contacts: 0, total_visits: 0, today_visits: 0 } } = useQuery({
    queryKey: ['stats'],
    queryFn:  () => fetch(`${API}/stats`).then(r => {
      if (!r.ok) throw new Error('Failed to load stats');
      return r.json();
    }),
    refetchInterval: 15_000,
    enabled: !!authToken,
  });

  // ── Actions ────────────────────────────────────────────────
  // Public: the link from a password-reset / invite email.
  if (pathname === '/reset-password') return <ResetPasswordPage />;
  // Show login page if not authenticated — all hooks already called above
  if (!authToken || sessionRejected) {
    if (sessionRejected) localStorage.removeItem(TOKEN_KEY);
    return <LoginPage onLogin={handleLogin} />;
  }
  if (!user) {   // checking the session
    return me.isError ? (
      <div className="sp-app sp-login"><main className="sp-login-main"><div className="sp-login-card">
        <h2>Can’t reach Stealth</h2><p>{me.error?.message || 'The server did not respond.'}</p>
        <button type="button" className="sp-primary-button sp-login-submit" onClick={() => me.refetch()}>Try again</button>
      </div></main></div>
    ) : null;
  }

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['contacts'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const handleSelectContact = (id, tab = 'overview') => setSearchParams({ contact: id, tab });
  const handleCloseModal    = () => setSearchParams({});

  const handleDeleteContact = async (contactId) => {
    try {
      const res = await fetch(`${API}/contacts/${contactId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Contact deleted');
    } catch {
      toast.error('Failed to delete contact');
    }
  };

  const handleBulkDelete = async (ids) => {
    if (!ids?.length) return;
    try {
      const results = await Promise.allSettled(
        ids.map(id => fetch(`${API}/contacts/${id}`, { method: 'DELETE' }))
      );
      const ok = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(`${ok} contact${ok !== 1 ? 's' : ''} deleted`);
    } catch {
      toast.error('Bulk delete failed');
    }
  };

  const shared = {
    contacts, loading, initialLoad, stats,
    onRefresh:       handleRefresh,
    onSelectContact: handleSelectContact,
    onDeleteContact: handleDeleteContact,
    onBulkDelete:    handleBulkDelete,
    user,
    mailConfigured: !!me.data?.mail_configured,
  };

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            backgroundColor: '#ffffff',
            border: '1px solid #dfe5ee',
            borderRadius: '4px',
            color: '#243047',
            fontFamily: "'Stealth Inter', Inter, 'Helvetica Neue', Arial, sans-serif",
            boxShadow: '0 12px 30px rgba(19,36,68,0.12)',
          },
        }}
      />
      <WorkspaceShell onLogout={handleLogout} user={user}>
        {/* Child routes render here and receive the shared context */}
        <Outlet context={shared} />
      </WorkspaceShell>

      <ContactDetailModal
        contactId={selectedContactId}
        defaultTab={selectedTab}
        open={modalOpen}
        onClose={handleCloseModal}
        onDelete={handleDeleteContact}
      />
    </>
  );
}

// ── Thin route wrappers ───────────────────────────────────────
// They read the shared context from the AppShell layout route and
// spread it into the existing page components, so page components
// stay completely unchanged by the Data Router migration.

function OverviewRoute() {
  const { stats, onSelectContact } = useOutletContext();
  return <OverviewPage stats={stats} onSelectContact={onSelectContact} />;
}

function LeadsRoute() {
  const shared = useOutletContext();
  return <LeadsPage {...shared} />;
}

function StealthRoute() {
  const { onSelectContact, stats } = useOutletContext();
  return <StealthPage onSelectContact={onSelectContact} totalRegistrations={stats.total_registrations} />;
}

function SalesRoute() {
  const { onSelectContact, stats } = useOutletContext();
  return <SalesPage onSelectContact={(id) => onSelectContact(id, 'sales')} stats={stats} />;
}

function VisitorsRoute() {
  const shared = useOutletContext();
  return <VisitorsPage {...shared} />;
}

function LogsRoute() {
  const { onSelectContact } = useOutletContext();
  return <LogsPage onSelectContact={onSelectContact} />;
}

function UsersRoute() {
  const { user } = useOutletContext();
  return <UsersPage me={user} />;
}

function AnalyticsRoute() {
  const { onSelectContact } = useOutletContext();
  return <AnalyticsPage onSelectContact={onSelectContact} />;
}

// ── Data Router ───────────────────────────────────────────────
// createBrowserRouter enables data-router-only features such as
// useBlocker (used by the automation builder to guard against
// navigating away with unsaved changes).

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/',                        element: <OverviewRoute /> },
      { path: '/leads',                   element: <LeadsRoute /> },
      { path: '/stealth',                 element: <StealthRoute /> },
      { path: '/sales',                   element: <SalesRoute /> },
      { path: '/visitors',                element: <VisitorsRoute /> },
      { path: '/automations',             element: <AutomationsPage /> },
      { path: '/automations/new',         element: <AutomationBuilderPage /> },
      { path: '/automations/builder/:id', element: <AutomationBuilderPage /> },
      { path: '/analytics',               element: <AnalyticsRoute /> },
      { path: '/logs',                    element: <LogsRoute /> },
      { path: '/users',                   element: <UsersRoute /> },
      { path: '/reset-password',          element: null },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TimezoneProvider>
        <RouterProvider router={router} />
      </TimezoneProvider>
    </QueryClientProvider>
  );
}
