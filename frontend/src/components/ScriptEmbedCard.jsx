import { useState } from 'react';
import { Copy, Check, Code2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export const ScriptEmbedCard = () => {
  const [copied, setCopied] = useState(false);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
  const scriptTag = `<script src="${backendUrl}/api/tracker.js"></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptTag).then(() => {
      setCopied(true);
      toast.success('Script tag copied!', {
        description: 'Paste it in the <head> of your webinar page.',
        duration: 3000,
      });
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <Card
      data-testid="script-embed-card"
      className="border"
      style={{
        backgroundColor: 'var(--bg-elev-1)',
        borderColor: 'var(--stroke)',
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 size={16} style={{ color: 'var(--primary-cyan)' }} />
            <CardTitle
              className="text-sm font-semibold"
              style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
            >
              Tracking Script
            </CardTitle>
          </div>
          <Button
            data-testid="copy-script-snippet-button"
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="h-7 gap-1.5 text-xs transition-colors duration-200"
            style={{
              backgroundColor: copied ? 'rgba(69,209,156,0.15)' : 'var(--bg-elev-2)',
              borderColor: copied ? 'var(--mint-success)' : 'var(--stroke)',
              color: copied ? 'var(--mint-success)' : 'var(--text-muted)',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          data-testid="tracking-script-snippet"
          className="script-snippet select-all"
        >
          {scriptTag}
        </div>
        <div
          className="mt-3 flex items-start gap-2 text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          <Info size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--amber-warn)' }} />
          <span>
            Paste this tag inside the <code style={{ color: 'var(--primary-cyan)', fontFamily: 'IBM Plex Mono, monospace' }}>&lt;head&gt;</code> of your StealthWebinar registration page.
            The script auto-initialises, captures form submissions, and tracks all page visits in real time.
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
