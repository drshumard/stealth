import { useState, useEffect, useCallback } from 'react';
import '@/App.css';
import { Toaster } from '@/components/ui/sonner';
import { TopNav } from '@/components/TopNav';
import { ScriptEmbedCard } from '@/components/ScriptEmbedCard';
import { ContactsTable } from '@/components/ContactsTable';
import { ContactDetailModal } from '@/components/ContactDetailModal';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function App() {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState({ total_contacts: 0, total_visits: 0, today_visits: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

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

    // Poll every 15s for live feel
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
    setSelectedContactId(contactId);
    setModalOpen(true);
  };

  const handleCopyScript = () => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const scriptTag = `<script src="${backendUrl}/api/tracker.js"></script>`;
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

      {/* Top Nav */}
      <TopNav
        onRefresh={handleRefresh}
        loading={loading}
        contactCount={stats.total_contacts}
        todayVisits={stats.today_visits}
      />

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Script Embed Card */}
        <ScriptEmbedCard />

        {/* Contacts Section */}
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
            onSelectContact={handleSelectContact}
            onCopyScript={handleCopyScript}
          />
        </div>
      </main>

      {/* Contact Detail Modal */}
      <ContactDetailModal
        contactId={selectedContactId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
