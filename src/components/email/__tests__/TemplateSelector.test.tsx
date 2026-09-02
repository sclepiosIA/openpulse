import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const chainable: any = new Proxy({}, {
  get: () => (..._args: any[]) => chainable,
});
chainable.maybeSingle = () => Promise.resolve({ data: null, error: null });
chainable.single = () => Promise.resolve({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => chainable },
}));

import { TemplateSelector } from '../TemplateSelector';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('TemplateSelector', () => {
  it('renders insert button initially', () => {
    render(
      <QueryClientProvider client={qc}>
        <TemplateSelector onInsert={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Insérer un template')).toBeInTheDocument();
  });

  it('shows selector on button click', () => {
    render(
      <QueryClientProvider client={qc}>
        <TemplateSelector onInsert={vi.fn()} />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByText('Insérer un template'));
    expect(screen.getByText('Insérer')).toBeInTheDocument();
  });
});
