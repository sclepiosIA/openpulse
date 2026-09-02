import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EtablissementsGridView } from './EtablissementsGridView';

const {
  ETABS_SMALL,
  ETABS_LARGE,
  ALL_ETABS,
  PROFILES,
  mockCountByPhase,
  mockOnSelect,
  mockOnEdit,
  mockOnDelete,
  mockOnCreateClick,
} = vi.hoisted(() => {
  const ETABS_SMALL = [
    { id: 'e1', nom: 'Clinique Alpha', phase: 'deploiement', progression: 20 },
    { id: 'e2', nom: 'Hôpital Beta', phase: 'production', progression: 80 },
    { id: 'e3', nom: 'Centre Gamma', phase: 'deploiement', progression: 40 },
  ];

  const ETABS_LARGE = Array.from({ length: 51 }, (_, i) => ({
    id: `e${i + 1}`,
    nom: `Etablissement ${i + 1}`,
    phase: i % 2 === 0 ? 'deploiement' : 'production',
    progression: 10 + (i % 5) * 20,
  }));

  const ALL_ETABS = [...ETABS_SMALL, { id: 'e4', nom: 'Delta', phase: 'production', progression: 100 }];
  const PROFILES = [{ id: 'p1', name: 'Profil 1' }];

  return {
    ETABS_SMALL,
    ETABS_LARGE,
    ALL_ETABS,
    PROFILES,
    mockCountByPhase: vi.fn((items: Array<{ phase?: string }>, phase: string) =>
      items.filter((item) => item.phase === phase).length,
    ),
    mockOnSelect: vi.fn(),
    mockOnEdit: vi.fn(),
    mockOnDelete: vi.fn(),
    mockOnCreateClick: vi.fn(),
  };
});

vi.mock('@/lib/phaseUtils', () => ({
  countByPhase: mockCountByPhase,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-description" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/virtual-list', () => ({
  VirtualList: ({
    items,
    renderItem,
  }: {
    items: Array<{ id: string }>;
    renderItem: (item: { id: string }) => React.ReactNode;
  }) => (
    <div data-testid="virtual-list">
      <div data-testid="virtual-count">{items.length}</div>
      {items.slice(0, 3).map((item) => (
        <div key={item.id} data-testid="virtual-item">
          {renderItem(item)}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/etablissement/EnhancedEtablissementCard', () => ({
  EnhancedEtablissementCard: ({
    etablissement,
    isSelected,
    onSelect,
    onEdit,
    onDelete,
  }: {
    etablissement: { id: string; nom?: string };
    isSelected: boolean;
    onSelect: (id: string) => void;
    onEdit: (etab: { id: string; nom?: string }) => void;
    onDelete: (etab: { id: string; nom?: string }) => void;
  }) => (
    <div data-testid="etab-card" data-selected={isSelected ? 'true' : 'false'}>
      <span>{etablissement.nom}</span>
      <button type="button" onClick={() => onSelect(etablissement.id)}>
        select-{etablissement.id}
      </button>
      <button type="button" onClick={() => onEdit(etablissement)}>
        edit-{etablissement.id}
      </button>
      <button type="button" onClick={() => onDelete(etablissement)}>
        delete-{etablissement.id}
      </button>
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  Building2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="building-icon" {...props} />,
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="plus-icon" {...props} />,
}));

describe('EtablissementsGridView', () => {
  const loadMoreRef = React.createRef<HTMLDivElement>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche la grille, les cartes, les statistiques métier et déclenche les callbacks', () => {
    render(
      <EtablissementsGridView
        etablissements={ETABS_SMALL}
        allEtablissementsData={ALL_ETABS}
        allProfiles={PROFILES}
        isSelectionMode={true}
        selectedIds={new Set(['e2'])}
        isLoading={false}
        isFetchingNextPage={false}
        searchTerm=""
        loadMoreRef={loadMoreRef}
        onSelect={mockOnSelect}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateClick={mockOnCreateClick}
      />,
    );

    expect(screen.queryByTestId('virtual-list')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('etab-card')).toHaveLength(3);
    expect(screen.getByText('Clinique Alpha')).toBeInTheDocument();
    expect(screen.getByText('Hôpital Beta')).toBeInTheDocument();
    expect(screen.getByText('Centre Gamma')).toBeInTheDocument();

    const cards = screen.getAllByTestId('etab-card');
    expect(cards[0]).toHaveAttribute('data-selected', 'false');
    expect(cards[1]).toHaveAttribute('data-selected', 'true');
    expect(cards[2]).toHaveAttribute('data-selected', 'false');

    expect(screen.getByText('Résumé')).toBeInTheDocument();
    expect(screen.getByText('Résultats filtrés')).toBeInTheDocument();
    expect(screen.getByText('Total global')).toBeInTheDocument();
    expect(screen.getByText('En déploiement')).toBeInTheDocument();
    expect(screen.getByText('En production')).toBeInTheDocument();
    expect(screen.getByText('Progression moyenne (filtrée)')).toBeInTheDocument();

    const resFiltresLabel = screen.getByText('Résultats filtrés');
    expect(resFiltresLabel.previousElementSibling).toHaveTextContent('3');

    const totalGlobalLabel = screen.getByText('Total global');
    expect(totalGlobalLabel.previousElementSibling).toHaveTextContent('4');

    const deplLabel = screen.getByText('En déploiement');
    expect(deplLabel.previousElementSibling).toHaveTextContent('2');

    const prodLabel = screen.getByText('En production');
    expect(prodLabel.previousElementSibling).toHaveTextContent('1');

    const progLabel = screen.getByText('Progression moyenne (filtrée)');
    const progValue = progLabel.previousElementSibling as HTMLElement | null;
    expect(progValue).not.toBeNull();
    if (progValue) {
      expect(progValue).toHaveTextContent('47');
      expect(progValue).toHaveTextContent('%');
    }

    expect(mockCountByPhase).toHaveBeenCalledWith(ETABS_SMALL, 'deploiement');
    expect(mockCountByPhase).toHaveBeenCalledWith(ETABS_SMALL, 'production');

    fireEvent.click(screen.getByRole('button', { name: 'select-e1' }));
    expect(mockOnSelect).toHaveBeenCalledWith('e1');

    fireEvent.click(screen.getByRole('button', { name: 'edit-e2' }));
    expect(mockOnEdit).toHaveBeenCalledWith(ETABS_SMALL[1]);

    fireEvent.click(screen.getByRole('button', { name: 'delete-e3' }));
    expect(mockOnDelete).toHaveBeenCalledWith(ETABS_SMALL[2]);
  });

  it('affiche la virtualisation au-delà de 50 établissements et le loader de pagination', () => {
    render(
      <EtablissementsGridView
        etablissements={ETABS_LARGE}
        allEtablissementsData={ETABS_LARGE}
        allProfiles={PROFILES}
        isSelectionMode={false}
        selectedIds={new Set()}
        isLoading={false}
        isFetchingNextPage={true}
        searchTerm=""
        loadMoreRef={loadMoreRef}
        onSelect={mockOnSelect}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateClick={mockOnCreateClick}
      />,
    );

    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    expect(screen.getByTestId('virtual-count')).toHaveTextContent('51');
    expect(screen.getAllByTestId('virtual-item')).toHaveLength(3);
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('affiche l’état vide avec recherche sans bouton de création', () => {
    render(
      <EtablissementsGridView
        etablissements={[]}
        allEtablissementsData={ALL_ETABS}
        allProfiles={PROFILES}
        isSelectionMode={false}
        selectedIds={new Set()}
        isLoading={false}
        isFetchingNextPage={false}
        searchTerm="beta"
        loadMoreRef={loadMoreRef}
        onSelect={mockOnSelect}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateClick={mockOnCreateClick}
      />,
    );

    expect(screen.getByText('Aucun établissement trouvé')).toBeInTheDocument();
    expect(screen.getByText('Aucun établissement ne correspond à votre recherche "beta"')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Créer le premier établissement/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('building-icon')).toBeInTheDocument();
  });

  it('affiche l’état vide initial avec bouton de création', () => {
    render(
      <EtablissementsGridView
        etablissements={[]}
        allEtablissementsData={[]}
        allProfiles={PROFILES}
        isSelectionMode={false}
        selectedIds={new Set()}
        isLoading={false}
        isFetchingNextPage={false}
        searchTerm=""
        loadMoreRef={loadMoreRef}
        onSelect={mockOnSelect}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateClick={mockOnCreateClick}
      />,
    );

    expect(screen.getByText('Aucun établissement')).toBeInTheDocument();
    expect(screen.getByText('Commencez par créer votre premier établissement client')).toBeInTheDocument();

    const createButton = screen.getByRole('button', { name: /Créer le premier établissement/i });
    fireEvent.click(createButton);
    expect(mockOnCreateClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
  });

  it('n’affiche pas l’état vide ni le résumé pendant le chargement', () => {
    const { container } = render(
      <EtablissementsGridView
        etablissements={[]}
        allEtablissementsData={undefined}
        allProfiles={undefined}
        isSelectionMode={false}
        selectedIds={new Set()}
        isLoading={true}
        isFetchingNextPage={false}
        searchTerm=""
        loadMoreRef={loadMoreRef}
        onSelect={mockOnSelect}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateClick={mockOnCreateClick}
      />,
    );

    expect(screen.queryByText('Aucun établissement')).not.toBeInTheDocument();
    expect(screen.queryByText('Résumé')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('grid');
  });
});