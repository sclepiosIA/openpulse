import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => ({ isAdmin: true, role: 'admin' }),
}));
vi.mock('@/components/shared/UniversalSearchBar', () => ({
  UniversalSearchBar: () => <div data-testid="search-bar" />,
}));
vi.mock('@/components/shared/KeyboardShortcutsHelp', () => ({
  KeyboardShortcutsHelp: () => null,
}));
vi.mock('@/components/people/AddUserDialog', () => ({
  AddUserDialog: () => null,
}));

import { PeopleHeader } from '../PeopleHeader';

describe('PeopleHeader', () => {
  it('renders title', () => {
    render(
      <MemoryRouter>
        <PeopleHeader title="People" context="rh" showShortcuts={false} setShowShortcuts={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('People')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <MemoryRouter>
        <PeopleHeader title="T" subtitle="Sous-titre" context="rh" showShortcuts={false} setShowShortcuts={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Sous-titre')).toBeInTheDocument();
  });

  it('shows add user button for admin', () => {
    render(
      <MemoryRouter>
        <PeopleHeader title="T" context="rh" showShortcuts={false} setShowShortcuts={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Ajouter un utilisateur')).toBeInTheDocument();
  });

  it('renders search bar', () => {
    render(
      <MemoryRouter>
        <PeopleHeader title="T" context="rh" showShortcuts={false} setShowShortcuts={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
  });
});
