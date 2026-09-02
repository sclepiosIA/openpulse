import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/components/documents/DocumentsPage', () => ({
  default: () => <div data-testid="documents-page">DocumentsPage</div>,
}));

import Documents from '../Documents';

describe('Documents page', () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders DocumentsPage component', () => {
    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Documents />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(getByTestId('documents-page')).toBeInTheDocument();
  });
});
