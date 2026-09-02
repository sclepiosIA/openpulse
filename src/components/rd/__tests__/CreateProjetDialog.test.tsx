import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateProjetDialog } from '../CreateProjetDialog';

vi.mock('@/hooks/rd/useRD', () => ({
  useCreateRDProjet: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'p1' }),
    isPending: false,
  }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('CreateProjetDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
  };

  it('renders dialog title', () => {
    render(
      <QueryClientProvider client={qc}>
        <CreateProjetDialog {...defaultProps} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Nouveau projet R&D')).toBeInTheDocument();
  });

  it('renders nom input', () => {
    render(
      <QueryClientProvider client={qc}>
        <CreateProjetDialog {...defaultProps} />
      </QueryClientProvider>
    );
    expect(screen.getByLabelText('Nom du projet')).toBeInTheDocument();
  });

  it('renders description input', () => {
    render(
      <QueryClientProvider client={qc}>
        <CreateProjetDialog {...defaultProps} />
      </QueryClientProvider>
    );
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    render(
      <QueryClientProvider client={qc}>
        <CreateProjetDialog {...defaultProps} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Créer')).toBeInTheDocument();
    expect(screen.getByText('Annuler')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <QueryClientProvider client={qc}>
        <CreateProjetDialog {...defaultProps} open={false} />
      </QueryClientProvider>
    );
    expect(screen.queryByText('Nouveau projet R&D')).not.toBeInTheDocument();
  });
});
