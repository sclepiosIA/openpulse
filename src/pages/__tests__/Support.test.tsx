import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock heavy dependencies
vi.mock('@/hooks/support/useSupportTickets', () => ({
  useSupportTickets: () => ({
    data: [
      { id: '1', statut: 'ouvert', priorite: 'haute', titre: 'Bug critique' },
      { id: '2', statut: 'en_cours', priorite: 'normale', titre: 'Question' },
      { id: '3', statut: 'resolu', priorite: 'critique', titre: 'Urgent' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/components/support/SupportKPIs', () => ({
  SupportKPIs: () => React.createElement('div', { 'data-testid': 'support-kpis' }, 'KPIs'),
}));
vi.mock('@/components/support/SupportTicketList', () => ({
  SupportTicketList: () => React.createElement('div', { 'data-testid': 'ticket-list' }, 'Tickets'),
}));
vi.mock('@/components/support/SupportTicketDetail', () => ({
  SupportTicketDetail: () => React.createElement('div', null, 'Detail'),
}));
vi.mock('@/components/support/CreateTicketDialog', () => ({
  CreateTicketDialog: () => null,
}));
vi.mock('@/components/support/EmailSyncHealth', () => ({
  EmailSyncHealth: () => null,
}));
vi.mock('@/components/support/SupportMobileHeader', () => ({
  SupportMobileHeader: () => null,
}));
vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ title }: any) => React.createElement('h1', null, title),
}));
vi.mock('@/components/search/GlobalSearchDialog', () => ({
  GlobalSearchDialog: () => null,
}));
vi.mock('@/components/shared/CollapsibleKPISection', () => ({
  CollapsibleKPISection: ({ children }: any) => React.createElement('div', null, children),
  KPIToggleButton: () => null,
}));
vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ setDrawerContent: vi.fn(), closeDrawer: vi.fn() }),
  MobileDrawerProvider: ({ children }: any) => children,
}));

// AuthProvider mock — pre-existing AuthProvider/Router failure.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'u1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

import Support from '@/pages/Support';

describe('Support Page', () => {
  it('should render support page with title', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Support)));
    expect(screen.getByText('Support Client')).toBeInTheDocument();
  });

  it('should render KPIs section', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Support)));
    expect(screen.getByTestId('support-kpis')).toBeInTheDocument();
  });

  it('should render ticket list', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Support)));
    expect(screen.getByTestId('ticket-list')).toBeInTheDocument();
  });
});
