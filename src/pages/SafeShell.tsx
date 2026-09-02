import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { debug } from '@/lib/debug';

export default function SafeShell() {
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const title = 'OpenPulse – Safe Shell';
    document.title = title;
    const desc = 'Minimal safe shell to diagnose loading issues without heavy bundles.';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', desc);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const hardReset = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      localStorage.clear();
      sessionStorage.clear();
      const url = new URL(window.location.href);
      url.searchParams.set('no-sw', '1');
      window.location.replace(url.toString());
    } catch (e) {
       
      debug.error('Hard reset failed', e);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-12">
      <main className="w-full max-w-xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Safe Shell</h1>
          <p className="text-sm opacity-80 mt-1">Diagnostique minimal pour erreurs de chargement.</p>
        </header>
        <section className="space-y-3">
          <p className="text-sm">Etat réseau: <span className={online ? 'text-green-600' : 'text-red-600'}>{online ? 'en ligne' : 'hors ligne'}</span></p>
          <div className="flex gap-2">
            <button onClick={hardReset} className="px-3 py-2 rounded border">
              Hard reset (no-sw)
            </button>
            <Link to="/" className="px-3 py-2 rounded border inline-flex items-center">Retour à l'app</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
