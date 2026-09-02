import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useIsSandboxProfile } from '@/hooks/auth/useIsSandboxProfile';

export function SandboxBanner() {
  const { user } = useAuth();
  const isSandbox = useIsSandboxProfile(user?.id);

  if (!isSandbox) return null;

  return (
    <div className="pointer-events-none sticky top-0 z-[100] bg-amber-500/90 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shadow-md">
      <AlertTriangle className="h-4 w-4" />
      Mode démo — aucune action destructive ne sera exécutée
    </div>
  );
}
