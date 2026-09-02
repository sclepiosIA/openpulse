import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { StartDMButton } from '../StartDMButton';

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'u1', nom: 'Dupont', prenom: 'Jean' } }),
}));

vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  usePulseConversations: () => ({ data: [] }),
  useCreatePulseConversation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('StartDMButton', () => {
  const wrap = (ui: React.ReactElement) =>
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    );

  it('renders DM button with aria label', () => {
    wrap(<StartDMButton onlineUsers={[]} onConversationCreated={vi.fn()} />);
    expect(screen.getByLabelText('Nouveau message direct')).toBeInTheDocument();
  });

  it('renders as icon button', () => {
    wrap(<StartDMButton onlineUsers={[]} onConversationCreated={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
  });
});
