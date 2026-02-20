import { useState, useEffect, useCallback } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Sidebar } from '@/components/Sidebar';
import AnalyticsPage from '@/components/AnalyticsPage';
import LeadsPage from '@/components/LeadsPage';
import LogsPage from '@/components/LogsPage';
import { ContactDetailModal } from '@/components/ContactDetailModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function AppShell() {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState({ total_contacts: 0, total_visits: 0, today_visits: 0 });
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedContactId = searchParams.get('contact');
  const modalOpen = !!selectedContactId;

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/contacts`);
      if (!res.ok) throw new Error('Failed');
      setContacts(await res.json());
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/stats`);
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchStats();
    const t = setInterval(() => { fetchContacts(); fetchStats(); }, 15000);
    return () => clearInterval(t);
  }, [fetchContacts, fetchStats]);

  const handleRefresh = () => { fetchContacts(); fetchStats(); };
  const handleSelectContact = (id) => setSearchParams({ contact: id });
  const handleCloseModal   = () => setSearchParams({});

  const handleDeleteContact = async (contactId) => {
    try {
      const res = await fetch(`${API}/contacts/${contactId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setContacts(prev => prev.filter(c => c.contact_id !== contactId));
      fetchStats();
      toast.success('Contact deleted');
    } catch {
      toast.error('Failed to delete contact');
    }
  };

  const handleBulkDelete = async (contactIds) => {
    if (!contactIds?.length) return;
    try {
      const results = await Promise.allSettled(
        contactIds.map(id => fetch(`${API}/contacts/${id}`, { method: 'DELETE' }))
      );
      const ok = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
      setContacts(prev => prev.filter(c => !contactIds.includes(c.contact_id)));
      fetchStats();
      toast.success(`${ok} contact${ok !== 1 ? 's' : ''} deleted`);
    } catch {
      toast.error('Bulk delete failed');
    }
  };

  return (
    <div
      className="flex h-screen overflow-hidden noise-overlay"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            backgroundColor: 'var(--bg-elev-2)',
            border: '1px solid var(--stroke)',
            color: 'var(--text)',
            fontFamily: 'Work Sans, sans-serif',
          },
        }}
      />

      <Sidebar />

      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route
            path="/"
            element={
              <LeadsPage
                contacts={contacts}
                loading={loading}
                initialLoad={initialLoad}
                stats={stats}
                onRefresh={handleRefresh}
                onSelectContact={handleSelectContact}
                onDeleteContact={handleDeleteContact}
                onBulkDelete={handleBulkDelete}
              />
            }
          />
          <Route
            path="/analytics"
            element={<AnalyticsPage stats={stats} contacts={contacts} />}
          />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </div>

      <ContactDetailModal
        contactId={selectedContactId}
        open={modalOpen}
        onClose={handleCloseModal}
        onDelete={handleDeleteContact}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
