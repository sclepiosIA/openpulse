import React from 'react';

/**
 * Compose multiple React providers into a single wrapper to flatten the pyramid of doom.
 * 
 * Usage:
 * ```tsx
 * <AppProviders providers={[ProviderA, ProviderB, ProviderC]}>
 *   <Content />
 * </AppProviders>
 * ```
 * Equivalent to:
 * ```tsx
 * <ProviderA>
 *   <ProviderB>
 *     <ProviderC>
 *       <Content />
 *     </ProviderC>
 *   </ProviderB>
 * </ProviderA>
 * ```
 */

type ProviderComponent = React.ComponentType<{ children: React.ReactNode }>;

interface AppProvidersProps {
  providers: ProviderComponent[];
  children: React.ReactNode;
}

export function AppProviders({ providers, children }: AppProvidersProps) {
  return providers.reduceRight<React.ReactNode>(
    (acc, Provider) => <Provider>{acc}</Provider>,
    children
  ) as React.ReactElement;
}
