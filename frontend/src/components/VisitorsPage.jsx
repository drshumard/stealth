import { RefreshCw, Copy, Download, Globe } from 'lucide-react';
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
      {/* Tinted page header */}
      <div
        className="rounded-2xl px-8 py-7 mb-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #e8ebf5 0%, #f2f3f9 50%, #f9f8f5 100%)',
          border: '1.5px solid #d2d8ef',
        }}
      >
        <Globe size={140} className="absolute -right-6 -bottom-6 opacity-[0.05] pointer-events-none" color="#030352" aria-hidden />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)', letterSpacing: '-0.02em' }}>Visitors</h1>
            <p className="text-base mt-1 font-semibold" style={{ color: 'var(--brand-navy)', opacity: 0.6 }}>
              {contacts.length} total visitor{contacts.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2 h-10 px-5 text-sm font-semibold"
              style={{ borderColor: 'var(--brand-navy)', color: 'var(--brand-navy)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
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
      </div>

      <div className="mb-6"><ScriptEmbedCard /></div>

      <div className="rounded-2xl border" style={{ borderColor: 'var(--stroke)', backgroundColor: '#ffffff', boxShadow: '0 4px 20px rgba(3,3,82,0.06)' }}>
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: 'var(--stroke)', background: 'linear-gradient(to bottom, #f7f6f2, #ffffff)' }}
        >
          <span className="text-base font-bold" style={{ color: 'var(--brand-navy)', fontFamily: 'Space Grotesk, sans-serif' }}>All Visitors</span>
          <Button variant="ghost" size="sm" onClick={onRefresh} className="h-9 w-9 p-0 rounded-lg" style={{ color: 'var(--text-dim)' }}>
            <RefreshCw size={14} />
          </Button>
        </div>
        <div className="px-6 py-5">
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
