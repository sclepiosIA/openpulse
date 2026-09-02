import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateEpicDialog } from '../CreateEpicDialog';

vi.mock('@/hooks/rd/useRD', () => ({
  useCreateRDEpic: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);

describe('CreateEpicDialog', () => {
  it('renders nothing when closed', () => {
    wrap(<CreateEpicDialog open={false} onOpenChange={vi.fn()} projetId="p1" />);
    expect(screen.queryByText('Nouvel Epic')).not.toBeInTheDocument();
  });

  it('renders dialog title when open', () => {
    wrap(<CreateEpicDialog open={true} onOpenChange={vi.fn()} projetId="p1" />);
    expect(screen.getByText('Nouvel Epic')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    wrap(<CreateEpicDialog open={true} onOpenChange={vi.fn()} projetId="p1" />);
    expect(screen.getByLabelText('Titre')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Couleur')).toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    wrap(<CreateEpicDialog open={true} onOpenChange={vi.fn()} projetId="p1" />);
    expect(screen.getByText('Créer')).toBeInTheDocument();
    expect(screen.getByText('Annuler')).toBeInTheDocument();
  });
});
