import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmailFilterManager } from '../EmailFilterManager';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/hooks/email/useEmailFilters', () => ({
  useEmailFilters: () => ({
    filters: [],
    isLoading: false,
    createFilter: vi.fn(),
    deleteFilter: vi.fn(),
    toggleFilter: vi.fn(),
    isCreating: false,
  }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);

describe('EmailFilterManager', () => {
  it('renders filter manager title', () => {
    wrap(<EmailFilterManager />);
    expect(screen.getByText('Règles de filtrage automatique')).toBeInTheDocument();
  });

  it('renders new rule button', () => {
    wrap(<EmailFilterManager />);
    expect(screen.getByText('Nouvelle règle')).toBeInTheDocument();
  });
});
