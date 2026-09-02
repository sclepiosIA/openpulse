// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoringFiltersBar, type ScoringFiltersState } from './ScoringFiltersBar';

const { buttonMockCalls, checkboxMockCalls } = vi.hoisted(() => ({
  buttonMockCalls: vi.fn(),
  checkboxMockCalls: vi.fn(),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      data-testid="input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
  }) => {
    const text = React.Children.toArray(children)
      .map(child => (typeof child === 'string' ? child : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    buttonMockCalls(text);
    return (
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
  }) => {
    checkboxMockCalls(checked);
    return (
      <input
        type="checkbox"
        checked={!!checked}
        onChange={e => onCheckedChange?.(e.target.checked)}
      />
    );
  },
}));

vi.mock('lucide-react', () => ({
  Search: () => <span data-testid="icon-search" />,
  Filter: () => <span data-testid="icon-filter" />,
  X: () => <span data-testid="icon-x" />,
  ArrowDownUp: () => <span data-testid="icon-sort" />,
}));

describe('ScoringFiltersBar', () => {
  const ownersList = [
    { id: 'owner-1', prenom: 'Jean', nom: 'Dupont', email: 'jean@example.test' },
    { id: 'owner-2', prenom: null, nom: null, email: 'sarah@example.test' },
  ];

  const statutsList = ['Nouveau', 'Qualifié', 'Proposition'];

  const baseFilters: ScoringFiltersState = {
    search: '',
    tiers: [],
    owners: [],
    statuts: [],
    onlySnoozed: false,
    onlyOrphans: false,
    sort: 'score',
  };

  beforeEach(() => {
    buttonMockCalls.mockClear();
    checkboxMockCalls.mockClear();
  });

  it('affiche les libellés par défaut et masque le reset quand aucun filtre n’est actif', () => {
    const onChange = vi.fn();

    render(
      <ScoringFiltersBar
        filters={baseFilters}
        onChange={onChange}
        ownersList={ownersList}
        statutsList={statutsList}
      />
    );

    expect(screen.getByPlaceholderText('Rechercher un prospect…')).toHaveValue('');
    expect(screen.getByText(/Owner : Tous/)).toBeInTheDocument();
    expect(screen.getByText(/Tri : Score/)).toBeInTheDocument();
    expect(screen.queryByText(/Réinitialiser/)).not.toBeInTheDocument();
  });

  it('affiche le nom de l’owner sélectionné, les compteurs actifs et le libellé de tri réel', () => {
    const onChange = vi.fn();
    const filters: ScoringFiltersState = {
      search: 'acme',
      tiers: ['hot', 'cold'],
      owners: ['owner-1'],
      statuts: ['Qualifié'],
      onlySnoozed: true,
      onlyOrphans: false,
      sort: 'mrr',
    };

    render(
      <ScoringFiltersBar
        filters={filters}
        onChange={onChange}
        ownersList={ownersList}
        statutsList={statutsList}
      />
    );

    expect(screen.getByDisplayValue('acme')).toBeInTheDocument();
    expect(screen.getByText(/Owner : Jean Dupont/)).toBeInTheDocument();
    expect(screen.getByText(/Tri : MRR potentiel/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/Réinitialiser/)).toBeInTheDocument();
  });

  it('affiche le fallback email puis le compteur pluriel pour les owners', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <ScoringFiltersBar
        filters={{ ...baseFilters, owners: ['owner-2'] }}
        onChange={onChange}
        ownersList={ownersList}
        statutsList={statutsList}
      />
    );

    expect(screen.getByText(/Owner : sarah@example\.test/)).toBeInTheDocument();

    rerender(
      <ScoringFiltersBar
        filters={{ ...baseFilters, owners: ['owner-1', 'owner-2'] }}
        onChange={onChange}
        ownersList={ownersList}
        statutsList={statutsList}
      />
    );

    expect(screen.getByText(/Owner : 2 sélectionnés/)).toBeInTheDocument();
  });

  it('déclenche onChange avec la nouvelle recherche', () => {
    const onChange = vi.fn();

    render(
      <ScoringFiltersBar
        filters={baseFilters}
        onChange={onChange}
        ownersList={ownersList}
        statutsList={statutsList}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Rechercher un prospect…'), {
      target: { value: 'beta' },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...baseFilters,
      search: 'beta',
    });
  });

  it('toggle un tier, un owner et un statut avec les valeurs métier attendues', () => {
    const onChange = vi.fn();

    render(
      <ScoringFiltersBar
        filters={baseFilters}
        onChange={onChange}
        ownersList={ownersList}
        statutsList={statutsList}
      />
    );

    fireEvent.click(screen.getByLabelText('🔥 Chauds (≥80)'));
    expect(onChange).toHaveBeenCalledWith({
      ...baseFilters,
      tiers: ['hot'],
    });

    fireEvent.click(screen.getByLabelText('Jean Dupont'));
    expect(onChange).toHaveBeenCalledWith({
      ...baseFilters,
      owners: ['owner-1'],
    });

    fireEvent.click(screen.getByLabelText('Qualifié'));
    expect(onChange).toHaveBeenCalledWith({
      ...baseFilters,
      statuts: ['Qualifié'],
    });
  });

  it('retire une valeur déjà sélectionnée pour les tableaux de filtres', () => {
    const onChange = vi.fn();
    const filters: ScoringFiltersState = {
      ...baseFilters,
      tiers: ['warm'],
      owners: ['owner-1'],
      statuts: ['Nouveau'],
    };

    render(
      <ScoringFiltersBar
        filters={filters}
        onChange={onChange}
        ownersList={ownersList}
        statutsList={statutsList}
      />
    );

    fireEvent.click(screen.getByLabelText('🌡️ Tièdes (60-79)'));
    expect(onChange).toHaveBeenCalledWith({
      ...filters,
      tiers: [],
    });

    fireEvent.click(screen.getByLabelText('Jean Dupont'));
    expect(onChange).toHaveBeenCalledWith({
      ...filters,
      owners: [],
    });

    fireEvent.click(screen.getByLabelText('Nouveau'));
    expect(onChange).toHaveBeenCalledWith({
      ...filters,
      statuts: [],
    });
  });

  it('met à jour les booléens onlySnoozed et onlyOrphans', () => {
    const onChange = vi.fn();

    render(
      <ScoringFiltersBar
        filters={baseFilters}
        onChange={onChange}
        ownersList={ownersList}
        statutsList={statutsList}
      />
    );

    fireEvent.click(screen.getByLabelText('Snoozés'));
    expect(onChange).toHaveBeenCalledWith({
      ...baseFilters,
      onlySnoozed: true,
    });

    fireEvent.click(screen.getByLabelText('Sans owner'));
    expect(onChange).toHaveBeenCalledWith({
      ...baseFilters,
      onlyOrphans: true,
    });
  });

  it('change le tri avec la clé attendue', () => {
    const onChange = vi.fn();

    render(
      <ScoringFiltersBar
        filters={baseFilters}
        onChange={onChange}
        ownersList={ownersList}
        statutsList={statutsList}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Vélocité' }));

    expect(onChange).toHaveBeenCalledWith({
      ...baseFilters,
      sort: 'velocity',
    });
  });

  it('réinitialise tous les filtres actifs vers l’état par défaut', () => {
    const onChange = vi.fn();
    const filters: ScoringFiltersState = {
      search: 'gamma',
      tiers: ['hot'],
      owners: ['owner-1'],
      statuts: ['Proposition'],
      onlySnoozed: true,
      onlyOrphans: true,
      sort: 'last',
    };

    render(
      <ScoringFiltersBar
        filters={filters}
        onChange={onChange}
        ownersList={ownersList}
        statutsList={statutsList}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }));

    expect(onChange).toHaveBeenCalledWith({
      search: '',
      tiers: [],
      owners: [],
      statuts: [],
      onlySnoozed: false,
      onlyOrphans: false,
      sort: 'score',
    });
  });
});