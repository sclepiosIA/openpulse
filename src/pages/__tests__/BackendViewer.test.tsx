import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';


// AuthProvider mock — hook uses useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/contexts/PageHeaderSlotContext', () => ({
  usePageHeaderSlot: () => ({ setSlot: vi.fn(), setHeaderContent: vi.fn() }),
}));
vi.mock('@/hooks/shared/useAppConfig', () => ({
  useAppConfig: () => ({ data: null, isLoading: false }),
}));
vi.mock('@/components/etablissement/StatsIframeViewer', () => ({
  StatsIframeViewer: () => <div data-testid="iframe-viewer" />,
}));

import BackendViewer from '../BackendViewer';

describe('BackendViewer page', () => {
  it('renders with valid view param', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/backend?view=hm-prod']}>
          <BackendViewer />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
