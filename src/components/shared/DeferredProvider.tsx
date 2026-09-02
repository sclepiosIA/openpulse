import { useState, useEffect, createContext, useContext, type ReactNode, type ComponentType } from 'react';

/**
 * Context that tells deferred providers whether they are "ready" to start
 * their heavy work (subscriptions, fetches, etc.).
 * 
 * Providers wrapped with `createDeferredProvider` are always mounted in the
 * React tree (stable structure = no unmount/remount cascade), but their
 * internal effects should gate on `useDeferredReady()` returning `true`.
 */
const DeferredReadyContext = createContext(true);

export function useDeferredReady(): boolean {
  return useContext(DeferredReadyContext);
}

interface DeferredProviderProps {
  children: ReactNode;
  /** Delay in ms before the provider becomes "ready" (default: 3000) */
  delay?: number;
}

/**
 * Wraps a provider so it is always rendered (stable React tree),
 * but injects a DeferredReadyContext that starts as `false` and
 * flips to `true` after `delay` ms.
 *
 * Consuming providers should call `useDeferredReady()` and skip
 * expensive effects until it returns `true`.
 */
export function createDeferredProvider(
  Provider: ComponentType<{ children: ReactNode }>,
  defaultDelay = 3000
) {
  return function DeferredProvider({ children, delay = defaultDelay }: DeferredProviderProps) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => setReady(true), delay);
      return () => clearTimeout(timer);
    }, [delay]);

    // Always render Provider to keep React tree stable (no unmount/remount)
    return (
      <DeferredReadyContext.Provider value={ready}>
        <Provider>{children}</Provider>
      </DeferredReadyContext.Provider>
    );
  };
}
