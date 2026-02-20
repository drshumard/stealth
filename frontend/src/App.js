import { useState, useEffect, useCallback } from 'react';
import '@/App.css';
import { BrowserRouter, useNavigate, useSearchParams } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TopNav } from '@/components/TopNav';
import { ScriptEmbedCard } from '@/components/ScriptEmbedCard';
import { ContactsTable } from '@/components/ContactsTable';
import { ContactDetailModal } from '@/components/ContactDetailModal';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function Dashboard() {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState({ total_contacts: 0, total_visits: 0, today_visits: 0 });
  const [initialLoad, setInitialLoad] = useState(true); // true only until first fetch completes
  const [loading, setLoading] = useState(false); // background refresh indicator
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedContactId = searchParams.get('contact');
  const modalOpen = !!selectedContactId;

  const fetchContacts = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/contacts`);
      if (!res.ok) throw new Error('Failed to fetch contacts');
      const data = await res.json();
      setContacts(data);
      if (showToast) toast.success('Contacts refreshed');
    } catch (e) {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
      setInitialLoad(false); // first load done — never show skeletons again
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/stats`);
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchStats();
    const interval = setInterval(() => {
      fetchContacts();
      fetchStats();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchContacts, fetchStats]);

  const handleRefresh = () => {
    fetchContacts(true);
    fetchStats();
  };

  const handleSelectContact = (contactId) => {
    setSearchParams({ contact: contactId });
  };

  const handleCloseModal = () => {
    setSearchParams({});
  };

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
    if (!contactIds || contactIds.length === 0) return;
    try {
      // Fire all deletes in parallel
      const results = await Promise.allSettled(
        contactIds.map(id => fetch(`${API}/contacts/${id}`, { method: 'DELETE' }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
      const failed = contactIds.length - succeeded;
      // Optimistic: remove all targeted from state
      setContacts(prev => prev.filter(c => !contactIds.includes(c.contact_id)));
      fetchStats();
      if (failed === 0) {
        toast.success(`${succeeded} contact${succeeded !== 1 ? 's' : ''} deleted`);
      } else {
        toast.warning(`${succeeded} deleted, ${failed} failed`);
      }
    } catch {
      toast.error('Bulk delete failed');
    }
  };

  const handleCopyScript = () => {
    const scriptTag = `<script src="${BACKEND_URL}/api/shumard.js"></script>`;
    navigator.clipboard.writeText(scriptTag).then(() => {
      toast.success('Script tag copied!', {
        description: 'Paste it in the <head> of your webinar page.',
        duration: 3000,
      });
    });
  };

  return (
    <div className="App ambient-glow noise-overlay" style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
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

      <TopNav
        onRefresh={handleRefresh}
        loading={loading}
        contactCount={stats.total_contacts}
        todayVisits={stats.today_visits}
      />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <ScriptEmbedCard />

        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2
              className="text-base font-semibold"
              style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
            >
              Contacts
            </h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{
                backgroundColor: 'rgba(21,184,200,0.1)',
                color: 'var(--primary-cyan)',
                border: '1px solid rgba(21,184,200,0.2)',
              }}
            >
              {contacts.length}
            </span>
          </div>
          <ContactsTable
            contacts={contacts}
            loading={loading}
            initialLoad={initialLoad}
            onSelectContact={handleSelectContact}
            onCopyScript={handleCopyScript}
            onBulkDelete={handleBulkDelete}
          />
        </div>
      </main>

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
      <Dashboard />
    </BrowserRouter>
  );
}
