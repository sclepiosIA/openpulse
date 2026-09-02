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
    channel: () => ({
      on: function() { return this; },
      subscribe: () => ({ status: 'SUBSCRIBED' }),
      unsubscribe: vi.fn(),
    }),
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
    removeChannel: vi.fn(),
  },
}));
vi.mock('@/components/shared/DeferredProvider', () => ({
  useDeferredReady: () => true,
}));

import { JarvisProactiveAlertsProvider, useJarvisProactiveAlertsContext } from '../JarvisProactiveAlertsContext';
import { supabase } from '@/integrations/supabase/client';

function TestConsumer() {
  const { alerts, unreadCount, isLoading } = useJarvisProactiveAlertsContext();
  return (
    <div>
      <span data-testid="alerts">{alerts.length}</span>
      <span data-testid="unread">{unreadCount}</span>
      <span data-testid="loading">{String(isLoading)}</span>
    </div>
  );
}

describe('JarvisProactiveAlertsContext', () => {
  it('provides safe defaults outside provider', () => {
    render(<TestConsumer />);
    expect(screen.getByTestId('alerts').textContent).toBe('0');
    expect(screen.getByTestId('unread').textContent).toBe('0');
  });

  it('renders children within provider', () => {
    render(
      <JarvisProactiveAlertsProvider>
        <div data-testid="child">Content</div>
      </JarvisProactiveAlertsProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
