import { useState, useEffect, useCallback } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { TopNav } from '@/components/TopNav';
import AnalyticsPage from '@/components/AnalyticsPage';
import LeadsPage from '@/components/LeadsPage';
import VisitorsPage from '@/components/VisitorsPage';
import LogsPage from '@/components/LogsPage';
import AutomationsPage from '@/components/AutomationsPage';
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

  const handleRefresh       = () => { fetchContacts(); fetchStats(); };
  const handleSelectContact = (id) => setSearchParams({ contact: id });
  const handleCloseModal    = () => setSearchParams({});

  const handleDeleteContact = async (contactId) => {
    try {
      const res = await fetch(`${API}/contacts/${contactId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setContacts(prev => prev.filter(c => c.contact_id !== contactId));
      fetchStats();
      toast.success('Contact deleted');
    } catch { toast.error('Failed to delete contact'); }
  };

  const handleBulkDelete = async (ids) => {
    if (!ids?.length) return;
    try {
      const results = await Promise.allSettled(
        ids.map(id => fetch(`${API}/contacts/${id}`, { method: 'DELETE' }))
      );
      const ok = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
      setContacts(prev => prev.filter(c => !ids.includes(c.contact_id)));
      fetchStats();
      toast.success(`${ok} contact${ok !== 1 ? 's' : ''} deleted`);
    } catch { toast.error('Bulk delete failed'); }
  };

  const shared = { contacts, loading, initialLoad, stats, onRefresh: handleRefresh, onSelectContact: handleSelectContact, onDeleteContact: handleDeleteContact, onBulkDelete: handleBulkDelete };

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
        <TopNav stats={stats} />
        <Routes>
          <Route path="/"          element={<LeadsPage    {...shared} />} />
          <Route path="/visitors"  element={<VisitorsPage {...shared} />} />
          <Route path="/analytics" element={<AnalyticsPage stats={stats} contacts={contacts} />} />
          <Route path="/logs"      element={<LogsPage />} />
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
