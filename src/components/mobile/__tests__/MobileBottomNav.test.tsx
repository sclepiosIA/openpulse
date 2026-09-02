import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
}));

vi.mock('@/hooks/ui/useNavigationBadges', () => ({
  useNavigationBadges: () => ({
    emails: 3,
    pulse: 0,
    todos: 1,
    calendar: 0,
    more: 0,
  }),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' }, signOut: vi.fn() }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'u1', prenom: 'Jean', nom: 'Test', role: 'csm' } }),
}));

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => ({
    canViewAllEtablissements: true,
    canViewAllEmails: true,
    viewScope: 'all',
  }),
}));

vi.mock('@/assets/marque/logo.png', () => ({ default: '/croix.png' }));

import { MobileBottomNav } from '../MobileBottomNav';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('MobileBottomNav', () => {
  it('renders nav items', () => {
    render(
      <QueryClientProvider client={qc}>
        <MobileBottomNav />
      </QueryClientProvider>
    );
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Emails')).toBeInTheDocument();
  });

  it('renders email badge count', () => {
    render(
      <QueryClientProvider client={qc}>
        <MobileBottomNav />
      </QueryClientProvider>
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
