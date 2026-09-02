import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mockChain = () => {
  const handler: any = new Proxy({}, {
    get: () => (..._args: any[]) => handler,
  });
  // Terminal methods
  handler.then = (resolve: any) => resolve({ data: [], error: null });
  return handler;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: () => ({
      on: function() { return this; },
      subscribe: () => ({ status: 'SUBSCRIBED' }),
      unsubscribe: vi.fn(),
    }),
    from: () => mockChain(),
    removeChannel: vi.fn(),
  },
}));
vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: () => ({
    select: () => ({
      eq: () => Promise.resolve({ data: [], error: null }),
    }),
  }),
}));
vi.mock('@/components/shared/DeferredProvider', () => ({
  useDeferredReady: () => true,
}));
vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'profile-123', prenom: 'Test', nom: 'User' }, isLoading: false }),
}));
vi.mock('@/hooks/shared/useUserEmailAccountIds', () => ({
  useUserEmailAccountIds: () => ({ accountIds: ['acc-1'], isLoading: false, hasAccounts: true }),
}));
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-123' }, loading: false }),
}));
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ data: [], isLoading: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
  };
});

import { RealtimeEmailProvider } from '../RealtimeEmailContext';
import { supabase } from '@/integrations/supabase/client';

describe('RealtimeEmailContext', () => {
  it('renders children without crashing', () => {
    render(
      <RealtimeEmailProvider>
        <div data-testid="child">Content</div>
      </RealtimeEmailProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
