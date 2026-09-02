import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GroupeAllTasksView } from './GroupeAllTasksView';

const { mockUseTaches, TACHES_DATA } = vi.hoisted(() => {
  const TACHES_DATA = {
    'etab-1': [
      {
        id: 't1',
        titre: 'Nettoyer la cuisine',
        statut: 'Terminé',
        priorite: 'high',
        description: 'Nettoyage complet',
        echeance: '2030-06-15T00:00:00.000Z',
        date_echeance: '2030-06-15T00:00:00.000Z',
        responsable: { prenom: 'Jean', nom: 'Dupont' },
        categorie: { nom: 'Hygiène', couleur: '#ff0000' },
        etablissement: { id: 'etab-1', nom: 'Restaurant Le Phare', ville: 'Brest' },
      },
      {
        id: 't2',
        titre: 'Commander les fournitures',
        statut: 'En cours',
        priorite: 'medium',
        description: null,
        echeance: '2020-01-01T00:00:00.000Z',
        date_echeance: '2020-01-01T00:00:00.000Z',
        responsable: null,
        categorie: null,
        etablissement: { id: 'etab-1', nom: 'Restaurant Le Phare', ville: 'Brest' },
      },
      {
        id: 't3',
        titre: 'Former le personnel',
        statut: 'A faire',
        priorite: 'low',
        description: null,
        echeance: null,
        date_echeance: null,
        responsable: null,
        categorie: null,
        etablissement: { id: 'etab-1', nom: 'Restaurant Le Phare', ville: 'Brest' },
      },
    ],
  };
  return { mockUseTaches: vi.fn(), TACHES_DATA };
});

vi.mock('@/hooks/tasks/useTachesGroupe', () => ({
  useTachesAllEtablissementsGroupe: mockUseTaches,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

function renderView() {
  return render(
    <MemoryRouter>
      <GroupeAllTasksView groupeId="grp-1" />
    </MemoryRouter>
  );
}

describe('GroupeAllTasksView', () => {
  beforeEach(() => {
    mockUseTaches.mockReset();
  });

  it('affiche des skeletons pendant le chargement', () => {
    mockUseTaches.mockReturnValue({ data: undefined, isLoading: true });
    renderView();
    expect(screen.getAllByTestId('skeleton')).toHaveLength(3);
    expect(screen.queryByText('Aucune tâche')).not.toBeInTheDocument();
  });

  it("affiche l'état vide quand il n'y a aucune tâche", () => {
    mockUseTaches.mockReturnValue({ data: {}, isLoading: false });
    renderView();
    expect(screen.getByText('Aucune tâche')).toBeInTheDocument();
    expect(
      screen.getByText("Les établissements du groupe n'ont pas encore de tâches")
    ).toBeInTheDocument();
    expect(mockUseTaches).toHaveBeenCalledWith('grp-1');
  });

  it('affiche les KPIs globaux calculés à partir des tâches', () => {
    mockUseTaches.mockReturnValue({ data: TACHES_DATA, isLoading: false });
    renderView();
    // 3 tâches : 1 terminée, 1 en cours, 1 à faire → 33.3%
    expect(screen.getByText('Total tâches')).toBeInTheDocument();
    expect(screen.getByText('33.3%')).toBeInTheDocument();
    expect(screen.getByText('À faire')).toBeInTheDocument();
    expect(screen.getByText('En cours', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('Terminées')).toBeInTheDocument();
  });

  it("affiche l'alerte des tâches en retard (1 tâche échue non terminée)", () => {
    mockUseTaches.mockReturnValue({ data: TACHES_DATA, isLoading: false });
    renderView();
    expect(screen.getByText('Tâches en retard')).toBeInTheDocument();
    expect(
      screen.getByText('1 tâche en retard nécessite une attention')
    ).toBeInTheDocument();
    expect(screen.getByText('En retard')).toBeInTheDocument();
  });

  it("affiche les informations de l'établissement et des tâches", () => {
    mockUseTaches.mockReturnValue({ data: TACHES_DATA, isLoading: false });
    renderView();
    expect(screen.getByText('Restaurant Le Phare')).toBeInTheDocument();
    expect(screen.getByText('Brest')).toBeInTheDocument();
    expect(screen.getByText('Nettoyer la cuisine')).toBeInTheDocument();
    expect(screen.getByText('Commander les fournitures')).toBeInTheDocument();
    expect(screen.getByText('Former le personnel')).toBeInTheDocument();
    // Labels de priorité traduits
    expect(screen.getByText('Haute')).toBeInTheDocument();
    expect(screen.getByText('Moyenne')).toBeInTheDocument();
    expect(screen.getByText('Basse')).toBeInTheDocument();
    // Responsable et catégorie
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Hygiène')).toBeInTheDocument();
    // Lien vers la fiche établissement
    const link = screen.getByRole('link', { name: /Restaurant Le Phare/ });
    expect(link).toHaveAttribute('href', '/etablissements/etab-1');
  });
});