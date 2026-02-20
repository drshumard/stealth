import { useState } from 'react';
import { Copy, Check, Code2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const ScriptEmbedCard = () => {
  const [copied, setCopied] = useState(false);
  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
  const scriptTag = `<script src="${backendUrl}/api/shumard.js"></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptTag).then(() => {
      setCopied(true);
      toast.success('Script tag copied!', { description: 'Paste it in the <head> of your page.', duration: 3000 });
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div
      data-testid="script-embed-card"
      className="rounded-2xl border p-6"
      style={{ backgroundColor: '#fff8f7', borderColor: '#fecdc7' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Code2 size={16} style={{ color: 'var(--brand-red)' }} />
          <span className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)' }}>
            Tracking Script
          </span>
        </div>
        <Button
          data-testid="copy-script-snippet-button"
          size="sm" variant="outline"
          onClick={handleCopy}
          className="h-9 gap-2 px-4 text-sm font-semibold transition-colors duration-200"
          style={{
            backgroundColor: copied ? '#ecfdf5' : '#ffffff',
            borderColor:     copied ? '#a7f3d0' : 'var(--brand-red)',
            color:           copied ? '#065f46' : 'var(--brand-red)',
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      <div data-testid="tracking-script-snippet" className="script-snippet select-all">
        {scriptTag}
      </div>

      <div className="mt-4 flex items-start gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-red)' }} />
        <span>
          Paste inside the <code style={{ color: 'var(--brand-navy)', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>&lt;head&gt;</code> of your StealthWebinar registration page.
        </span>
      </div>
    </div>
  );
};
