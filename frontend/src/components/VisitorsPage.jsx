import { RefreshCw, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ScriptEmbedCard } from '@/components/ScriptEmbedCard';
import { ContactsTable } from '@/components/ContactsTable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function VisitorsPage({ contacts, loading, initialLoad, stats, onRefresh, onSelectContact, onDeleteContact, onBulkDelete }) {
  const handleCopyScript = () => {
    navigator.clipboard.writeText(`<script src="${BACKEND_URL}/api/shumard.js"></script>`)
      .then(() => toast.success('Script copied!', { description: 'Paste in your page <head>' }));
  };

  return (
    <div className="p-6 md:p-8">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}>Visitors</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {contacts.length} total visitor{contacts.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant="outline" size="sm"
            className="gap-1.5 h-9 text-sm"
            style={{ borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
          >
            <Download size={14} /> Export
          </Button>
          <Button
            data-testid="visitors-copy-script-button"
            size="sm"
            className="gap-1.5 h-9 text-sm text-white"
            style={{ backgroundColor: 'var(--primary-orange)' }}
            onClick={handleCopyScript}
          >
            <Copy size={14} /> Copy Script
          </Button>
        </div>
      </div>

      {/* Embed card */}
      <div className="mb-6">
        <ScriptEmbedCard />
      </div>

      {/* Table card */}
      <div className="rounded-2xl border" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-soft)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--stroke)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)', fontFamily: 'Space Grotesk, sans-serif' }}>All Visitors</span>
          <Button variant="ghost" size="sm" onClick={onRefresh} className="h-8 w-8 p-0" style={{ color: 'var(--text-dim)' }}>
            <RefreshCw size={13} />
          </Button>
        </div>
        <div className="p-4 pt-3">
          <ContactsTable
            contacts={contacts}
            loading={loading}
            initialLoad={initialLoad}
            onSelectContact={onSelectContact}
            onCopyScript={handleCopyScript}
            onBulkDelete={onBulkDelete}
          />
        </div>
      </div>
    </div>
  );
}
