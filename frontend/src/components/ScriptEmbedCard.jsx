import { useState } from 'react';
import { Copy, Check, Code2 } from 'lucide-react';
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
      className="rounded-2xl p-6 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top left, #fce8e4 0%, #fdf4f2 50%, #fff8f7 100%)',
        border: '1.5px solid #f0c0b8',
      }}
    >
      {/* Decorative background code symbol */}
      <div
        className="absolute -right-3 top-1/2 -translate-y-1/2 text-8xl font-mono font-bold opacity-[0.05] pointer-events-none select-none"
        style={{ color: '#A31800' }}
        aria-hidden
      >
        {'{}'}
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(163,24,0,0.12)' }}>
              <Code2 size={18} style={{ color: 'var(--brand-red)' }} />
            </div>
            <div>
              <span className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--brand-navy)' }}>Tracking Script</span>
              <p className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>Add to your page &lt;head&gt;</p>
            </div>
          </div>
          <Button
            data-testid="copy-script-snippet-button"
            size="sm" variant="outline"
            onClick={handleCopy}
            className="h-9 gap-2 px-4 text-sm font-semibold transition-colors duration-200"
            style={{
              backgroundColor: copied ? '#ecfdf5' : 'rgba(255,255,255,0.8)',
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
      </div>
    </div>
  );
};
