import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/profile/useProfiles', () => ({
  useActiveProfiles: () => ({ data: [{ id: 'u1', first_name: 'Jean', last_name: 'Dupont' }] }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ update: () => ({ in: () => Promise.resolve({ error: null }) }) }) },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/productionUtils', () => ({
  exportProductionToCSV: vi.fn(),
}));

import { BulkActionsBarProduction } from '../BulkActionsBarProduction';
import { supabase } from '@/integrations/supabase/client';

const etabs = [{ id: '1', nom: 'CHU Test' }] as any[];

describe('BulkActionsBarProduction', () => {
  it('renders selection count', () => {
    render(
      <BulkActionsBarProduction
        selectedIds={['1']}
        etablissements={etabs}
        healthScores={new Map()}
        healthMetrics={new Map()}
        onClearSelection={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByText(/1 sélectionné/)).toBeInTheDocument();
  });

  it('renders export button', () => {
    render(
      <BulkActionsBarProduction
        selectedIds={['1']}
        etablissements={etabs}
        healthScores={new Map()}
        healthMetrics={new Map()}
        onClearSelection={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByText(/Exporter/i)).toBeInTheDocument();
  });
});
