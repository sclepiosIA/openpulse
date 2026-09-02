import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const chainable: any = new Proxy({}, {
  get: () => (..._args: any[]) => chainable,
});
chainable.maybeSingle = () => Promise.resolve({ data: null, error: null });
chainable.single = () => Promise.resolve({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => chainable, functions: { invoke: vi.fn() } },
}));

import { ClauseAIToolbar } from '../ClauseAIToolbar';
import { supabase } from '@/integrations/supabase/client';

describe('ClauseAIToolbar', () => {
  it('renders AI action buttons', () => {
    render(
      <ClauseAIToolbar
        content="<p>Clause test</p>"
        clauseTitle="Clause 1"
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Simplifier')).toBeInTheDocument();
    expect(screen.getByText('Formaliser')).toBeInTheDocument();
    expect(screen.getByText('Développer')).toBeInTheDocument();
  });

  it('renders assistant title', () => {
    render(
      <ClauseAIToolbar
        content="<p>Test</p>"
        clauseTitle="Clause"
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Assistant IA')).toBeInTheDocument();
  });
});
