import { useState } from 'react';
import { Copy, Check, Code2 } from 'lucide-react';
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

  // The prototype's "Website tracking" integration note, with the snippet to copy.
  return (
    <div data-testid="script-embed-card" className="sp-integration sp-script-card">
      <span className="sp-integration-icon"><Code2 size={19} /></span>
      <div>
        <span className="sp-eyebrow">Integration</span><strong>Website tracking</strong>
        <p>The tracking script associates page visits with contact activity. Add it to your page &lt;head&gt;.</p>
      </div>
      <div className="sp-script-copy">
        <code data-testid="tracking-script-snippet" className="select-all">{scriptTag}</code>
        <button type="button" data-testid="copy-script-snippet-button" className="sp-secondary-button" data-copied={copied || undefined} onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
};
