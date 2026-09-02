import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskQuickAdd } from '../TaskQuickAdd';

vi.mock('@/hooks/tasks/useCreateTache', () => ({
  useCreateTache: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: () => ({ data: [{ id: 'c1', nom: 'Support' }] }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useActiveProfiles: () => ({ data: [{ id: 'u1', nom: 'Dupont', prenom: 'Jean' }] }),
}));

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: () => ({ data: [{ id: 'e1', nom: 'CHU Test' }] }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('TaskQuickAdd', () => {
  const wrap = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);

  it('renders add button when not alwaysOpen', () => {
    wrap(<TaskQuickAdd />);
    expect(screen.getByText(/Ajouter une tâche/i)).toBeInTheDocument();
  });

  it('opens form when clicking add button', () => {
    wrap(<TaskQuickAdd />);
    fireEvent.click(screen.getByText(/Ajouter une tâche/i));
    expect(screen.getByPlaceholderText(/titre de la tâche/i)).toBeInTheDocument();
  });

  it('renders form directly when alwaysOpen', () => {
    wrap(<TaskQuickAdd alwaysOpen />);
    expect(screen.getByPlaceholderText(/titre de la tâche/i)).toBeInTheDocument();
  });
});
