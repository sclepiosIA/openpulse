import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionsBarDeployment } from '../BulkActionsBarDeployment';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: () => ({
      update: () => ({ in: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useActiveProfiles: () => ({ data: [] }),
}));

vi.mock('@/lib/deploymentUtils', () => ({
  DEPLOYMENT_PHASES: ['Contractuel', 'Déploiement', 'Formation'],
  exportToCSV: vi.fn(),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);

describe('BulkActionsBarDeployment', () => {
  const defaultProps = {
    selectedIds: ['id1', 'id2'],
    etablissements: [
      { id: 'id1', nom: 'CHU A', type: 'CHU', region: 'IDF', statut: 'Contractuel', progression: 30, date_signature: '2026-01-01' },
      { id: 'id2', nom: 'CHU B', type: 'CHU', region: 'ARA', statut: 'Formation', progression: 80, date_signature: null },
    ] as any[],
    onClearSelection: vi.fn(),
  };

  it('returns null when no selection', () => {
    const { container } = wrap(
      <BulkActionsBarDeployment {...defaultProps} selectedIds={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows selection count badge', () => {
    wrap(<BulkActionsBarDeployment {...defaultProps} />);
    expect(screen.getByText('2 sélectionné(s)')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    wrap(<BulkActionsBarDeployment {...defaultProps} />);
    expect(screen.getByText('Assigner')).toBeInTheDocument();
    expect(screen.getByText('Statut')).toBeInTheDocument();
    expect(screen.getByText('Exporter')).toBeInTheDocument();
  });

  it('calls onClearSelection when X clicked', () => {
    wrap(<BulkActionsBarDeployment {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const closeBtn = buttons[buttons.length - 1];
    fireEvent.click(closeBtn);
    expect(defaultProps.onClearSelection).toHaveBeenCalledOnce();
  });

  it('calls exportToCSV when export clicked', async () => {
    const { exportToCSV } = await import('@/lib/deploymentUtils');
    wrap(<BulkActionsBarDeployment {...defaultProps} />);
    fireEvent.click(screen.getByText('Exporter'));
    expect(exportToCSV).toHaveBeenCalled();
  });
});
