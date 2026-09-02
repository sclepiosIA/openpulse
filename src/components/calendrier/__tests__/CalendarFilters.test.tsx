import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarFilters } from '../CalendarFilters';

vi.mock('@/hooks/profile/useProfiles', () => ({
  useActiveProfiles: () => ({
    data: [
      { id: 'u1', display_name: 'Alice', avatar_url: null },
      { id: 'u2', display_name: 'Bob', avatar_url: null },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: () => ({
    data: [{ id: 'c1', name: 'Commercial', color: '#ff0000' }],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: () => ({
    data: [{ id: 'e1', nom: 'Etab 1' }],
    isLoading: false,
  }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const defaultFilters = {
  search: '',
  responsables: [],
  categories: [],
  statuts: [],
  priorites: [],
  etablissements: [],
  dateRange: { start: null, end: null },
  showOnlyMyTasks: false,
  hideCompleted: false,
  hideObsolete: false,
};

function renderFilters(overrides = {}) {
  const onFiltersChange = vi.fn();
  const onReset = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <CalendarFilters
        filters={{ ...defaultFilters, ...overrides }}
        onFiltersChange={onFiltersChange}
        onReset={onReset}
        hasActiveFilters={Object.keys(overrides).length > 0}
      />
    </QueryClientProvider>
  );
  return { onFiltersChange, onReset };
}

describe('CalendarFilters', () => {
  it('renders the search input and date preset shortcuts', () => {
    renderFilters();
    expect(screen.getByLabelText(/Recherche/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cette semaine/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ce mois/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /7 prochains jours/i })).toBeInTheDocument();
  });

  it('propagates search input changes via onFiltersChange', async () => {
    const user = userEvent.setup();
    const { onFiltersChange } = renderFilters();
    await user.type(screen.getByLabelText(/Recherche/i), 'rdv');
    // 3 keystrokes => 3 invocations, last call must carry the cumulative value
    expect(onFiltersChange).toHaveBeenCalled();
    const lastCall = onFiltersChange.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual({ search: 'v' });
    // First call is the first keystroke
    expect(onFiltersChange.mock.calls[0][0]).toEqual({ search: 'r' });
  });

  it('applies a date preset when a shortcut button is clicked', async () => {
    const user = userEvent.setup();
    const { onFiltersChange } = renderFilters();
    await user.click(screen.getByRole('button', { name: /Cette semaine/i }));
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    const arg = onFiltersChange.mock.calls[0][0];
    expect(arg.dateRange).toBeDefined();
    expect(arg.dateRange.start).toBeInstanceOf(Date);
    expect(arg.dateRange.end).toBeInstanceOf(Date);
    expect(arg.dateRange.end.getTime()).toBeGreaterThanOrEqual(arg.dateRange.start.getTime());
  });
});
