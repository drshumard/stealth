import { RefreshCw, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ScriptEmbedCard } from '@/components/ScriptEmbedCard';
import { ContactsTable } from '@/components/ContactsTable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function VisitorsPage({ contacts, loading, initialLoad, stats, onRefresh, onSelectContact, onDeleteContact, onBulkDelete }) {
  const handleCopyScript = () =>
    navigator.clipboard.writeText(`<script src="${BACKEND_URL}/api/shumard.js"></script>`)
      .then(() => toast.success('Script copied!'));

  return (
    <div className="p-8 md:p-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>
            Visitors
          </h1>
          <p className="text-base mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>
            {contacts.length} total visitor{contacts.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <Button variant="outline" size="sm" className="gap-2 h-10 px-5 text-sm font-semibold"
            style={{ borderColor: 'var(--brand-navy)', color: 'var(--brand-navy)' }}>
            <Download size={14} /> Export
          </Button>
          <Button
            data-testid="visitors-copy-script-button"
            size="sm" className="gap-2 h-10 px-5 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-red)' }}
            onClick={handleCopyScript}
          >
            <Copy size={14} /> Copy Script
          </Button>
        </div>
      </div>

      <div className="mb-6"><ScriptEmbedCard /></div>

      <div className="rounded-2xl border" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-soft)' }}>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--stroke)' }}>
          <span className="text-base font-bold" style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif' }}>All Visitors</span>
          <Button variant="ghost" size="sm" onClick={onRefresh} className="h-9 w-9 p-0 rounded-lg" style={{ color: 'var(--text-dim)' }}>
            <RefreshCw size={14} />
          </Button>
        </div>
        <div className="px-6 py-4">
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
