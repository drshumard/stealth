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
      toast.success('Script tag copied!', { description: 'Paste it in the <head> of your webinar page.', duration: 3000 });
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div
      data-testid="script-embed-card"
      className="rounded-2xl border p-5"
      style={{ backgroundColor: '#fffbf5', borderColor: '#fed7aa' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Code2 size={15} style={{ color: 'var(--primary-orange)' }} />
          <span className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}>
            Tracking Script
          </span>
        </div>
        <Button
          data-testid="copy-script-snippet-button"
          size="sm" variant="outline"
          onClick={handleCopy}
          className="h-7 gap-1.5 text-xs transition-colors duration-200"
          style={{
            backgroundColor: copied ? '#ecfdf5' : '#ffffff',
            borderColor:     copied ? '#a7f3d0' : '#fed7aa',
            color:           copied ? '#065f46' : 'var(--primary-orange)',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      <div data-testid="tracking-script-snippet" className="script-snippet select-all">
        {scriptTag}
      </div>

      <div className="mt-3 flex items-start gap-2 text-xs" style={{ color: 'var(--text-dim)' }}>
        <Info size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--primary-orange)' }} />
        <span>
          Paste inside the <code style={{ color: 'var(--primary-orange)', fontFamily: 'IBM Plex Mono, monospace' }}>&lt;head&gt;</code> of your StealthWebinar registration page.
        </span>
      </div>
    </div>
  );
};
