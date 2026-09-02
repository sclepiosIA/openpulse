import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SimulatorDataExtractor } from '../SimulatorDataExtractor';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('SimulatorDataExtractor', () => {
  it('renders extract button', () => {
    render(
      <QueryClientProvider client={qc}>
        <SimulatorDataExtractor etablissementId="e1" />
      </QueryClientProvider>
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
