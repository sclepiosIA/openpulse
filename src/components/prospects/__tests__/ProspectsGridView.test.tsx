import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({ name }: any) => <span>{name}</span>,
}));

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (n: number) => `${n} €`,
}));

import { ProspectsGridView } from '../ProspectsGridView';

const prospects = [
  { id: '1', nom: 'CHU Alpha', statut: 'Prospect', region: 'IDF', ville: 'Paris', responsable_id: 'u1' },
  { id: '2', nom: 'Clinique Beta', statut: 'Contacté', region: 'PACA', ville: 'Marseille' },
] as any[];

const getProgressInfo = () => ({ progress: 50, totalTasks: 10, completedTasks: 5, potentialValue: 50000 });

describe('ProspectsGridView', () => {
  it('renders prospect cards', () => {
    render(
      <MemoryRouter>
        <ProspectsGridView
          prospects={prospects}
          selectedIds={new Set()}
          onSelect={vi.fn()}
          getProgressInfo={getProgressInfo}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getAllByText('CHU Alpha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Clinique Beta').length).toBeGreaterThanOrEqual(1);
  });
});
