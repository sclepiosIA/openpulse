import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const chainable: any = new Proxy({}, {
  get: () => (..._args: any[]) => chainable,
});
chainable.maybeSingle = () => Promise.resolve({ data: null, error: null });
chainable.single = () => Promise.resolve({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => chainable,
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: () => ({
    select: () => ({
      eq: () => Promise.resolve({ data: [], error: null }),
    }),
  }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));

import { EmailSettings } from '../EmailSettings';
import { supabase } from '@/integrations/supabase/client';

describe('EmailSettings', () => {
  it('renders email configuration title', () => {
    render(<EmailSettings />);
    expect(screen.getByText('Comptes connectés')).toBeInTheDocument();
  });

  it('renders add account form', () => {
    render(<EmailSettings />);
    expect(screen.getByText(/Ajouter/)).toBeInTheDocument();
  });
});
