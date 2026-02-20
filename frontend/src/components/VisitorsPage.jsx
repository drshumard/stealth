import { RefreshCw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScriptEmbedCard } from '@/components/ScriptEmbedCard';
import { ContactsTable } from '@/components/ContactsTable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function VisitorsPage({
  contacts, loading, initialLoad, stats,
  onRefresh, onSelectContact, onDeleteContact, onBulkDelete,
}) {
  const handleCopyScript = () => {
    const tag = `<script src="${BACKEND_URL}/api/shumard.js"></script>`;
    navigator.clipboard.writeText(tag).then(() =>
      toast.success('Script tag copied!', { description: 'Paste it in the <head> of your page.', duration: 3000 })
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--stroke)' }}
      >
        <div className="flex items-center gap-2">
          <h1
            className="text-sm font-semibold"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
          >
            Visitors
          </h1>
          <Badge
            variant="secondary"
            className="text-xs font-mono px-2"
            style={{
              backgroundColor: 'rgba(21,184,200,0.1)',
              color: 'var(--primary-cyan)',
              border: '1px solid rgba(21,184,200,0.2)',
            }}
          >
            {stats.total_contacts}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            data-testid="refresh-button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="h-7 w-7 p-0"
            style={{ backgroundColor: 'var(--bg-elev-2)', borderColor: 'var(--stroke)', color: 'var(--text-muted)' }}
          >
            <RefreshCw size={13} />
          </Button>
          <Button
            data-testid="visitors-copy-script-button"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleCopyScript}
            style={{ backgroundColor: 'var(--primary-cyan)', color: 'var(--bg)' }}
          >
            <Copy size={12} />
            Copy Script
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
        <ScriptEmbedCard />
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
  );
}
