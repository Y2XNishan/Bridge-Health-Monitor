import { useState, useEffect } from 'react';
import { Smartphone } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if user dismissed it previously
    const isDismissed = localStorage.getItem('pwa_install_dismissed') === 'true';
    if (isDismissed) return;

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (window.innerWidth < 768) {
        setVisible(true);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setVisible(false);
      } else if (deferredPrompt) {
        setVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('resize', handleResize);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setVisible(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    }
    setDeferredPrompt(null);
  };

  const handleDismissClick = () => {
    setVisible(false);
    localStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-in">
      <div 
        className="rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <Smartphone size={24} color="#0F6E56" className="shrink-0" />
          <div>
            <p className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Install Bridge Health Monitor</p>
            <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
              Add Bridge Health Monitor to your home screen for quick structural telemetry monitoring.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <button
            onClick={handleDismissClick}
            className="px-3 py-1.5 text-xs font-semibold transition-colors hover:text-slate-900"
            style={{ color: 'var(--text-secondary)' }}
          >
            Later
          </button>
          <button
            onClick={handleInstallClick}
            className="px-4 py-2 text-xs font-semibold rounded-lg transition-colors hover:opacity-90"
            style={{ background: '#1C1F26', color: '#ffffff' }}
          >
            Install now
          </button>
        </div>
      </div>
    </div>
  );
}
