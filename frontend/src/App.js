import '@/App.css';
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { TopNav } from '@/components/TopNav';
import AnalyticsPage from '@/components/AnalyticsPage';
import LeadsPage from '@/components/LeadsPage';
import VisitorsPage from '@/components/VisitorsPage';
import LogsPage from '@/components/LogsPage';
import AutomationsPage from '@/components/AutomationsPage';
import SalesPage from '@/components/SalesPage';
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

  // Show login page if not authenticated
  if (!authToken) {
    return <LoginPage onLogin={handleLogin} />;
  }

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
  });

  // ── Stats ──────────────────────────────────────────────────
  const { data: stats = { total_contacts: 0, total_visits: 0, today_visits: 0 } } = useQuery({
    queryKey: ['stats'],
    queryFn:  () => fetch(`${API}/stats`).then(r => {
      if (!r.ok) throw new Error('Failed to load stats');
      return r.json();
    }),
    refetchInterval: 15_000,
  });

  // ── Actions ────────────────────────────────────────────────
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
        <Routes>
          <Route path="/"            element={<LeadsPage    {...shared} />} />
          <Route path="/sales"       element={<SalesPage onSelectContact={(id) => handleSelectContact(id, 'sales')} />} />
          <Route path="/visitors"    element={<VisitorsPage {...shared} />} />
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/analytics"   element={<AnalyticsPage stats={stats} contacts={contacts} />} />
          <Route path="/logs"        element={<LogsPage />} />
        </Routes>
      </div>

      <ContactDetailModal
        key={selectedContactId}
        contactId={selectedContactId}
        defaultTab={selectedTab}
        open={modalOpen}
        onClose={handleCloseModal}
        onDelete={handleDeleteContact}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
