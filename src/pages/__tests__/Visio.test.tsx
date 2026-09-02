import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@test.com' } }),
}));
vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'u1', prenom: 'Test', nom: 'User' } }),
}));
vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}));
vi.mock('@/components/visio/VisioRoom', () => ({
  VisioRoom: () => <div data-testid="visio-room" />,
}));
vi.mock('@/components/visio/VisioLobby', () => ({
  VisioLobby: () => <div data-testid="visio-lobby" />,
}));

import Visio from '../Visio';

describe('Visio page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/visio/test-room']}>
          <Routes>
            <Route path="/visio/:roomCode" element={<Visio />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
