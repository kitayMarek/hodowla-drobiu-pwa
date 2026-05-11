import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState =
  | { type: 'unavailable' }       // już zainstalowana lub desktop bez supportu
  | { type: 'android' }           // gotowy prompt natywny
  | { type: 'ios' }               // iOS – ręczna instrukcja
  | { type: 'installed' };        // właśnie zainstalowano

const DISMISSED_KEY = 'fermly_install_dismissed';

export function useInstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<InstallState>({ type: 'unavailable' });
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISSED_KEY));

  useEffect(() => {
    // Już działa jako standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as unknown as Record<string, unknown>).standalone === true);
    if (isStandalone) { setState({ type: 'installed' }); return; }

    // iOS Safari nie wspiera beforeinstallprompt
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream;
    if (isIOS) { setState({ type: 'ios' }); return; }

    // Android / Chrome / Edge – nasłuchuj na prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState({ type: 'android' });
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setState({ type: 'installed' });
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  /** Czy pokazać baner */
  const shouldShow =
    !dismissed &&
    (state.type === 'android' || state.type === 'ios');

  return { state, shouldShow, install, dismiss };
}
