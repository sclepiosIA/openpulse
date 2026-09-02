import { useState, useEffect } from 'react';
import { debug } from '@/lib/debug';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AppInstallPromptProps {
  appName: string;
  appIcon: string;
  themeColor?: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Component that displays a PWA installation prompt.
 * Shows automatically when the browser fires the beforeinstallprompt event,
 * or can be triggered manually via URL parameter ?install=true
 */
export function AppInstallPrompt({ appName, appIcon, themeColor = '#3B82F6' }: AppInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if user navigated with ?install=true
      const params = new URLSearchParams(window.location.search);
      if (params.get('install') === 'true') {
        setShowPrompt(true);
        // Clean URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } else {
        // Show prompt after a short delay
        setTimeout(() => setShowPrompt(true), 2000);
      }
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      toast.success(`${appName} installée avec succès !`);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check URL param on mount even without beforeinstallprompt
    const params = new URLSearchParams(window.location.search);
    if (params.get('install') === 'true') {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [appName]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Show iOS instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        toast.info(
          "Pour installer sur iOS : Appuyez sur le bouton Partager puis 'Sur l'écran d'accueil'",
          { duration: 8000 }
        );
      } else {
        toast.info(
          "Utilisez le menu de votre navigateur pour installer l'application",
          { duration: 5000 }
        );
      }
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success(`${appName} sera ajoutée à votre écran d'accueil`);
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      debug.error('Installation error:', error);
      toast.error("Erreur lors de l'installation");
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  // Don't show if already installed or prompt not ready
  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div 
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300",
        "md:left-auto md:right-4 md:max-w-sm"
      )}
    >
      <div 
        className="p-4 rounded-xl shadow-lg border bg-background"
        style={{ borderColor: themeColor + '40' }}
      >
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
          aria-label="Fermer"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
        
        <div className="flex items-center gap-4">
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: themeColor + '20' }}
          >
            <img 
              src={appIcon} 
              alt={appName} 
              className="w-10 h-10 object-contain"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              Installer {appName}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Accès rapide depuis l'écran d'accueil
            </p>
          </div>
        </div>
        
        <Button 
          onClick={handleInstall}
          className="w-full mt-4"
          style={{ backgroundColor: themeColor }}
        >
          <Download className="h-4 w-4 mr-2" />
          Installer
        </Button>
      </div>
    </div>
  );
}
