import '@/App.css';
import { useState } from 'react';
import {
  createBrowserRouter, RouterProvider, Outlet,
  useSearchParams, useOutletContext,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { TimezoneProvider } from '@/components/TimezoneContext';
import { TopNav } from '@/components/TopNav';
import AnalyticsPage from '@/components/AnalyticsPage';
import LeadsPage from '@/components/LeadsPage';
import VisitorsPage from '@/components/VisitorsPage';
import LogsPage from '@/components/LogsPage';
import AutomationsPage from '@/components/AutomationsPage';
import AutomationBuilderPage from '@/components/AutomationBuilderPage';
import SalesPage from '@/components/SalesPage';
import StealthPage from '@/components/StealthPage';
import LoginPage from '@/components/LoginPage';
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
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('tether_auth'));

  const handleLogin  = (token) => { localStorage.setItem('tether_auth', token); setAuthToken(token); };
  const handleLogout = ()      => { localStorage.removeItem('tether_auth'); setAuthToken(null); };


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
  // Show login page if not authenticated — all hooks already called above
  if (!authToken) return <LoginPage onLogin={handleLogin} />;

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
  };

  return (
    <div className="app-canvas">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            color: '#111827',
            fontFamily: 'Work Sans, sans-serif',
            boxShadow: '0 4px 12px rgba(17,24,39,0.1)',
          },
        }}
      />
      <div className="main-card">
        <TopNav stats={stats} onLogout={handleLogout} />
        {/* Child routes render here and receive the shared context */}
        <Outlet context={shared} />
      </div>

      <ContactDetailModal
        contactId={selectedContactId}
        defaultTab={selectedTab}
        open={modalOpen}
        onClose={handleCloseModal}
        onDelete={handleDeleteContact}
      />
    </div>
  );
}

// ── Thin route wrappers ───────────────────────────────────────
// They read the shared context from the AppShell layout route and
// spread it into the existing page components, so page components
// stay completely unchanged by the Data Router migration.

function LeadsRoute() {
  const shared = useOutletContext();
  return <LeadsPage {...shared} />;
}

function StealthRoute() {
  const { onSelectContact } = useOutletContext();
  return <StealthPage onSelectContact={onSelectContact} />;
}

function SalesRoute() {
  const { onSelectContact } = useOutletContext();
  return <SalesPage onSelectContact={(id) => onSelectContact(id, 'sales')} />;
}

function VisitorsRoute() {
  const shared = useOutletContext();
  return <VisitorsPage {...shared} />;
}

function AnalyticsRoute() {
  const { stats, contacts } = useOutletContext();
  return <AnalyticsPage stats={stats} contacts={contacts} />;
}

// ── Data Router ───────────────────────────────────────────────
// createBrowserRouter enables data-router-only features such as
// useBlocker (used by the automation builder to guard against
// navigating away with unsaved changes).

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/',                        element: <LeadsRoute /> },
      { path: '/stealth',                 element: <StealthRoute /> },
      { path: '/sales',                   element: <SalesRoute /> },
      { path: '/visitors',                element: <VisitorsRoute /> },
      { path: '/automations',             element: <AutomationsPage /> },
      { path: '/automations/new',         element: <AutomationBuilderPage /> },
      { path: '/automations/builder/:id', element: <AutomationBuilderPage /> },
      { path: '/analytics',               element: <AnalyticsRoute /> },
      { path: '/logs',                    element: <LogsPage /> },
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
