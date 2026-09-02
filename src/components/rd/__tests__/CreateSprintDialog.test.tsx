import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateSprintDialog } from '../CreateSprintDialog';

vi.mock('@/hooks/rd/useRD', () => ({
  useCreateRDSprint: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);

describe('CreateSprintDialog', () => {
  it('renders nothing when closed', () => {
    wrap(<CreateSprintDialog open={false} onOpenChange={vi.fn()} projetId="p1" nextSprintNumber={3} />);
    expect(screen.queryByText('Nouveau Sprint')).not.toBeInTheDocument();
  });

  it('renders dialog title when open', () => {
    wrap(<CreateSprintDialog open={true} onOpenChange={vi.fn()} projetId="p1" nextSprintNumber={3} />);
    expect(screen.getByText('Nouveau Sprint')).toBeInTheDocument();
  });

  it('prefills sprint name with number', () => {
    wrap(<CreateSprintDialog open={true} onOpenChange={vi.fn()} projetId="p1" nextSprintNumber={5} />);
    expect(screen.getByDisplayValue('Sprint 5')).toBeInTheDocument();
  });

  it('renders date fields', () => {
    wrap(<CreateSprintDialog open={true} onOpenChange={vi.fn()} projetId="p1" nextSprintNumber={1} />);
    expect(screen.getByLabelText('Date début')).toBeInTheDocument();
    expect(screen.getByLabelText('Date fin')).toBeInTheDocument();
  });

  it('renders velocity field', () => {
    wrap(<CreateSprintDialog open={true} onOpenChange={vi.fn()} projetId="p1" nextSprintNumber={1} />);
    expect(screen.getByText(/Vélocité prévue/)).toBeInTheDocument();
  });
});
