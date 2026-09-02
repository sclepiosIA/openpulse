import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setSandboxFlag } from '@/lib/sandboxGuard';

/**
 * Chantier #4 (audit 2026-06-02) — couche services/ : encapsulation de
 * la lecture du flag `profiles.is_sandbox` pour éviter l'import direct
 * du client Supabase dans les composants de présentation.
 */
export function useIsSandboxProfile(userId: string | undefined): boolean {
  const [isSandbox, setIsSandbox] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setSandboxFlag(false);
      setIsSandbox(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_sandbox' as never)
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      const v = !!(data as { is_sandbox?: boolean } | null)?.is_sandbox;
      setSandboxFlag(v);
      setIsSandbox(v);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return isSandbox;
}
