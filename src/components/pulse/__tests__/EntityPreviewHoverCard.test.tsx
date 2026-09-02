import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { nom: 'CHU Lyon', ville: 'Lyon', statut: 'Production', progression: 80, engagement_score: 75 }, error: null }),
          gte: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}));

import { EntityPreviewHoverCard } from '../EntityPreviewHoverCard';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('EntityPreviewHoverCard', () => {
  it('renders children trigger', () => {
    render(
      <QueryClientProvider client={qc}>
        <EntityPreviewHoverCard entityType="etablissement" entityId="e1">
          <span>CHU Lyon</span>
        </EntityPreviewHoverCard>
      </QueryClientProvider>
    );
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
  });
});
