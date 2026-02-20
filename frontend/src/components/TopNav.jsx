import { useState } from 'react';
import { RefreshCw, Radio, Copy, Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

export const TopNav = ({ onRefresh, loading, contactCount, todayVisits }) => {
  const [copied, setCopied] = useState(false);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
  const scriptTag = `<script src="${backendUrl}/api/tracker.js"><\/script>`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptTag).then(() => {
      setCopied(true);
      toast.success('Script tag copied!', {
        description: 'Paste it in the <head> of your webinar page.',
        duration: 3000,
      });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <header
      data-testid="top-nav"
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: 'var(--bg-elev-1)',
        borderColor: 'var(--stroke)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-cyan)', color: 'var(--bg)' }}
            >
              <Zap size={16} strokeWidth={2.5} />
            </div>
            <div>
              <h1
                className="text-sm font-semibold tracking-tight"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
              >
                StealthTrack
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Lead Attribution</p>
            </div>
          </div>

          {/* Center stats */}
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center">
              <div
                className="text-lg font-semibold [font-variant-numeric:tabular-nums]"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
              >
                {contactCount}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Contacts</div>
            </div>
            <div
              className="w-px h-8"
              style={{ backgroundColor: 'var(--stroke)' }}
            />
            <div className="text-center">
              <div
                className="text-lg font-semibold [font-variant-numeric:tabular-nums]"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)' }}
              >
                {todayVisits}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Today's Events</div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Live status pill */}
            <div
              data-testid="live-status-pill"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: 'rgba(69, 209, 156, 0.1)',
                border: '1px solid rgba(69, 209, 156, 0.2)',
                color: 'var(--mint-success)',
              }}
            >
              <span
                data-testid="live-event-pulse"
                className="inline-block w-1.5 h-1.5 rounded-full pulse-dot"
                style={{ backgroundColor: 'var(--mint-success)' }}
              />
              Active
            </div>

            {/* Refresh */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-testid="refresh-contacts-button"
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={loading}
                    className="h-8 w-8 p-0"
                    style={{
                      backgroundColor: 'var(--bg-elev-2)',
                      borderColor: 'var(--stroke)',
                      color: 'var(--text-muted)',
                    }}
                    aria-label="Refresh contacts"
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh contacts</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Copy Script */}
            <Button
              data-testid="copy-script-button"
              size="sm"
              onClick={handleCopyScript}
              className="h-8 gap-1.5 text-xs font-medium transition-colors duration-200"
              style={{
                backgroundColor: copied ? 'var(--mint-success)' : 'var(--primary-cyan)',
                color: 'var(--bg)',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy Script'}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
