import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/hooks/production/useProduction', () => ({
  useProduction: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/crm/useCustomerHealth', () => ({
  useCustomerHealth: () => ({ healthScores: {} }),
  getHealthLabel: () => 'Bon',
  getHealthIcon: () => null,
}));
vi.mock('@/hooks/crm/useCustomerHealthMetrics', () => ({
  useBulkHealthMetrics: () => ({ data: {} }),
}));
vi.mock('@/hooks/csm/useCsmSante', () => ({
  useCsmSante: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/csm/useCsmKpisTrimestriels', () => ({
  useCsmKpisTrimestriels: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/csm/useCsmKpisMensuels', () => ({
  useCsmKpisMensuels: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/csm/useCsmFacturation', () => ({
  useCsmFacturation: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/email/useLastEmailByEtablissement', () => ({
  useLastEmailByEtablissement: () => ({ data: {} }),
}));
vi.mock('@/hooks/production/useProductionStats', () => ({
  useProductionStats: () => ({
    totalClients: 0,
    activeCount: 0,
    recentlyLaunched: 0,
    averageHealthScore: 0,
    trends: { recentlyLaunched: 0, caGrowth: 0 },
    renewals: { next30Days: [], next90Days: [], expired: [] },
    healthDistribution: { good: 0, warning: 0, critical: 0 },
    caAnnuel: 0,
    caMensuel: 0,
  }),
}));
vi.mock('@/hooks/production/useProductionFilters', () => ({
  useProductionFilters: () => ({
    filters: {},
    setFilters: vi.fn(),
    filteredData: [],
    sortConfig: { field: 'nom', direction: 'asc' },
    setSortConfig: vi.fn(),
  }),
}));
vi.mock('@/hooks/profile/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: {},
    setPreference: vi.fn(),
    getPreference: vi.fn().mockReturnValue(undefined),
  }),
}));
vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: () => ({ data: [] }),
}));
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));
vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn(), setOpen: vi.fn() }),
}));

// GlobalSearchDialog uses JarvisUnifiedContext — mock to avoid provider boilerplate.
vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JarvisUnifiedProvider: ({ children }: any) => children,
  useJarvisUnified: () => ({
    setIsPanelOpen: vi.fn(),
    isPanelOpen: false,
    sendMessage: vi.fn(),
  }),
}));

import Production from '../Production';

describe('Production page', () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Production />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
