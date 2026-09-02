import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/contexts/EmailFiltersContext', () => ({
  useEmailFiltersContext: () => ({
    globalFilters: { search: '' },
    updateGlobalFilter: vi.fn(),
  }),
}));

import { PWAMailHeader } from '../PWAMailHeader';

const accounts = [
  { id: 'a1', email_address: 'test@example.com' },
  { id: 'a2', email_address: 'other@example.com' },
];

describe('PWAMailHeader', () => {
  it('renders current account email', () => {
    render(
      <PWAMailHeader
        accountId="a1"
        emailAccounts={accounts}
        onAccountChange={vi.fn()}
        onSync={vi.fn()}
        onCompose={vi.fn()}
        isSyncing={false}
      />
    );
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders all accounts label', () => {
    render(
      <PWAMailHeader
        accountId="all"
        emailAccounts={accounts}
        onAccountChange={vi.fn()}
        onSync={vi.fn()}
        onCompose={vi.fn()}
        isSyncing={false}
      />
    );
    expect(screen.getByText('Tous les comptes (2)')).toBeInTheDocument();
  });
});
