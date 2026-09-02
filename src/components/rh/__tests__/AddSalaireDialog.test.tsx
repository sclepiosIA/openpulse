import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddSalaireDialog } from '../AddSalaireDialog';

vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useProfilesWithRoles: () => ({
    data: [{ id: 'p1', prenom: 'Jean', nom: 'Dupont' }],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/hr/useRHSalaires', () => ({
  useRHSalaires: () => ({
    createSalaire: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('AddSalaireDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  it('renders dialog title', () => {
    render(
      <QueryClientProvider client={qc}>
        <AddSalaireDialog {...defaultProps} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Ajouter un salaire manuellement')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(
      <QueryClientProvider client={qc}>
        <AddSalaireDialog {...defaultProps} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Employé')).toBeInTheDocument();
    expect(screen.getByText('Mois')).toBeInTheDocument();
    expect(screen.getByText('Salaire brut')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(
      <QueryClientProvider client={qc}>
        <AddSalaireDialog {...defaultProps} />
      </QueryClientProvider>
    );
    expect(screen.getByRole('button', { name: /Créer le salaire/i })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <QueryClientProvider client={qc}>
        <AddSalaireDialog {...defaultProps} open={false} />
      </QueryClientProvider>
    );
    expect(screen.queryByText('Ajouter un salaire manuellement')).not.toBeInTheDocument();
  });
});
