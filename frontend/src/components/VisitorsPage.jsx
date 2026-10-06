import { RefreshCw, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { ScriptEmbedCard } from '@/components/ScriptEmbedCard';
import { ContactsTable } from '@/components/ContactsTable';
import { PageIntro, SurfaceHead, count } from '@/workspace/ui';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function VisitorsPage({ contacts, loading, initialLoad, stats, onRefresh, onSelectContact, onDeleteContact, onBulkDelete }) {
  const handleCopyScript = () =>
    navigator.clipboard.writeText(`<script src="${BACKEND_URL}/api/shumard.js"></script>`)
      .then(() => toast.success('Script copied!'));

  // Visitors — design: the prototype's Visitors directory: the tracking script, then every tracked contact (the newest
  // 10,000 the API returns), searchable, with the table's paging and bulk delete.
  return <>
    <PageIntro eyebrow="Acquisition / Site activity" title="Visitors"
      description="Follow the path from first page view to an identified lead."
      actions={<button type="button" data-testid="visitors-copy-script-button" className="sp-primary-button" onClick={handleCopyScript}><Copy size={15} /> Copy script</button>} />
    <ScriptEmbedCard />
    <section className="sp-surface" aria-label="Visitors list">
      <SurfaceHead eyebrow="Directory" title="All visitors">
        <span className="sp-toolbar-end">
          <button type="button" className="sp-icon-button" onClick={onRefresh} aria-label="Refresh visitors"><RefreshCw size={15} /></button>
          <span className="sp-count">{count(stats?.total_contacts ?? contacts.length)} tracked</span>
        </span>
      </SurfaceHead>
      <ContactsTable
        contacts={contacts}
        loading={loading}
        initialLoad={initialLoad}
        onSelectContact={onSelectContact}
        onCopyScript={handleCopyScript}
        onBulkDelete={onBulkDelete}
      />
    </section>
  </>;
}
