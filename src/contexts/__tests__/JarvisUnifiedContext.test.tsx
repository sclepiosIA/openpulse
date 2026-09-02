import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
}));
vi.mock('@/contexts/JarvisConversationContext', () => ({
  JarvisConversationProvider: ({ children }: any) => <>{children}</>,
}));

import { JarvisUnifiedProvider, useJarvisUnifiedOptional, JARVIS_COLORS, JARVIS_ANIMATIONS } from '../JarvisUnifiedContext';
import { supabase } from '@/integrations/supabase/client';

function TestConsumer() {
  const ctx = useJarvisUnifiedOptional();
  return <span data-testid="has-ctx">{ctx ? 'yes' : 'no'}</span>;
}

describe('JarvisUnifiedContext', () => {
  it('provides context within provider', () => {
    render(
      <JarvisUnifiedProvider><TestConsumer /></JarvisUnifiedProvider>
    );
    expect(screen.getByTestId('has-ctx').textContent).toBe('yes');
  });

  it('optional hook returns null outside provider', () => {
    render(<TestConsumer />);
    expect(screen.getByTestId('has-ctx').textContent).toBe('no');
  });

  it('exports JARVIS_COLORS with all alert types', () => {
    expect(JARVIS_COLORS.urgent).toBeDefined();
    expect(JARVIS_COLORS.risk).toBeDefined();
    expect(JARVIS_COLORS.opportunity).toBeDefined();
  });

  it('exports JARVIS_ANIMATIONS', () => {
    expect(JARVIS_ANIMATIONS.fadeIn).toBeDefined();
    expect(JARVIS_ANIMATIONS.slideUp).toBeDefined();
  });
});
