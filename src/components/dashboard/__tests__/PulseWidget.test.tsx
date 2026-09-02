import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PulseWidget } from '../PulseWidget';

vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  usePulseConversations: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/pulse/usePulseUnreadCount', () => ({
  usePulseUnreadCount: () => ({ data: { total: 0 } }),
}));

vi.mock('@/hooks/pulse/usePulseWidgetSummaries', () => ({
  usePulseWidgetSummaries: () => ({
    getSummary: vi.fn(),
    isLoading: false,
    generateSummary: vi.fn(),
  }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'u1', prenom: 'Jean' } }),
}));

describe('PulseWidget', () => {
  const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

  it('renders Pulse title', () => {
    wrap(<PulseWidget />);
    expect(screen.getByText('Pulse')).toBeInTheDocument();
  });

  it('shows empty state when no conversations', () => {
    wrap(<PulseWidget />);
    expect(screen.getByText('Aucune conversation')).toBeInTheDocument();
  });
});
