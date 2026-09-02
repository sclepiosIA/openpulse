/**
 * CallContext — état global du module téléphonie.
 *
 * Gère l'état partagé du widget d'appel flottant (cible, ouverture/fermeture,
 * appel courant) sans coupler les composants entre eux. Le moteur SIP réel
 * est porté par useSipClient (instancié uniquement par CallWidget).
 */
import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import type { CallTarget } from '@/types/calls';

interface CallContextValue {
  isOpen: boolean;
  pendingTarget: CallTarget | null;
  startCall: (target: CallTarget) => void;
  closeWidget: () => void;
  consumeTarget: () => CallTarget | null;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<CallTarget | null>(null);

  const startCall = useCallback((target: CallTarget) => {
    setPendingTarget(target);
    setIsOpen(true);
  }, []);

  const closeWidget = useCallback(() => {
    setIsOpen(false);
    setPendingTarget(null);
  }, []);

  const consumeTarget = useCallback(() => {
    const t = pendingTarget;
    setPendingTarget(null);
    return t;
  }, [pendingTarget]);

  const value = useMemo<CallContextValue>(
    () => ({ isOpen, pendingTarget, startCall, closeWidget, consumeTarget }),
    [isOpen, pendingTarget, startCall, closeWidget, consumeTarget],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCallContext(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) {
    // Fallback safe pour éviter de crasher si le provider n'est pas monté
    // (ex: pages publiques /m/, /formation, etc.)
    return {
      isOpen: false,
      pendingTarget: null,
      startCall: () => {
        console.warn('[CallContext] startCall called outside provider — ignored');
      },
      closeWidget: () => {},
      consumeTarget: () => null,
    };
  }
  return ctx;
}
