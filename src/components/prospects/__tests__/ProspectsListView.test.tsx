import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({ name }: any) => <span>{name}</span>,
}));

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (n: number) => `${n} €`,
}));

import { ProspectsListView } from '../ProspectsListView';

const prospects = [
  { id: '1', nom: 'CHU Alpha', statut: 'Prospect', region: 'IDF', ville: 'Paris' },
] as any[];

const getProgressInfo = () => ({ progress: 30, totalTasks: 10, completedTasks: 3, potentialValue: 50000 });

describe('ProspectsListView', () => {
  it('renders prospect name', () => {
    render(
      <MemoryRouter>
        <ProspectsListView
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
  });
});
