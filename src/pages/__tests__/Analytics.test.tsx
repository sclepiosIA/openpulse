import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/hooks/analytics/useAnalytics', () => ({
  useChurnPredictions: () => ({ data: [], isLoading: false }),
  useClientSegments: () => ({ data: [], isLoading: false }),
  useUpsellRecommendations: () => ({ data: [], isLoading: false }),
  useCAForecasts: () => ({ data: [], isLoading: false }),
  useProactiveAlerts: () => ({ data: [], isLoading: false }),
  useRegulatoryReports: () => ({ data: [], isLoading: false }),
  useAnalyticsKPIs: () => ({
    churnRiskCount: 2,
    segmentCount: 5,
    upsellOpportunities: 3,
    alertsPending: 1,
  }),
  useUpdateAlertStatus: () => ({ mutate: vi.fn() }),
  useUpdateUpsellStatus: () => ({ mutate: vi.fn() }),
}));

import Analytics from '../Analytics';

describe('Analytics page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <Analytics />
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
