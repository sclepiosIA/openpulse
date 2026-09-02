import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { PrevisionnelResume } from './PrevisionnelResume';

const { mockUseTresorerieKPIs, KPIS_OK, KPIS_EMPTY } = vi.hoisted(() => {
  const KPIS_OK = {
    isLoading: false,
    cashburnMoyen6MoisPasses: 10000,
    cashburnMoyenProjete6Mois: 12000,
    cashburnSalairesUniquement: 8000,
    caParExercice: [
      { annee: 2024, caComptable: 50000, caPercu: 40000 },
      { annee: 2025, caComptable: 75000, caPercu: 60000 },
    ],
    facturesEnAttente: { count: 3, montant: 15000 },
    fondsPropreActuels: 20000,
    projectionFinAnnee: -5000,
    prochainTrouTresorerie: { mois: 'mars 2026', solde: -3000 },
    pipelineNiveaux: [
      { label: 'Chaud', count: 2, probabilite: 0.8, montantMensuel: 1000, montantAnnuel: 12000 },
      { label: 'Tiède', count: 4, probabilite: 0.5, montantMensuel: 500, montantAnnuel: 6000 },
    ],
  };
  const KPIS_EMPTY = {
    ...KPIS_OK,
    caParExercice: [] as typeof KPIS_OK.caParExercice,
    pipelineNiveaux: [] as typeof KPIS_OK.pipelineNiveaux,
    prochainTrouTresorerie: null,
  };
  return { mockUseTresorerieKPIs: vi.fn(), KPIS_OK, KPIS_EMPTY };
});

vi.mock('@/hooks/tresorerie/useTresorerieKPIs', () => ({
  useTresorerieKPIs: mockUseTresorerieKPIs,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value?: number }) => <div data-testid="progress" data-value={value} />,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children?: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children?: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children?: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children?: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children?: React.ReactNode }) => <td>{children}</td>,
}));

vi.mock('lucide-react', () => ({
  Flame: () => null,
  Receipt: () => null,
  TrendingUp: () => null,
  AlertTriangle: () => null,
  PieChart: () => null,
  Landmark: () => null,
}));

// Normalise tous les types d'espaces (Intl fr-FR utilise des espaces insécables
// que testing-library collapse en espaces simples → on compare sur base normalisée).
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

const fmt = (value: number) =>
  norm(
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value)
  );

const fmtCompact = (value: number) =>
  norm(
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  );

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PrevisionnelResume />
    </QueryClientProvider>
  );
}

function pageText(container: HTMLElement): string {
  return norm(container.textContent ?? '');
}

describe('PrevisionnelResume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche les skeletons pendant le chargement', () => {
    mockUseTresorerieKPIs.mockReturnValue({ ...KPIS_OK, isLoading: true });
    renderComponent();

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons).toHaveLength(5);
    expect(screen.queryByText('Cashburn mensuel')).not.toBeInTheDocument();
  });

  it('affiche les KPIs de cashburn avec les montants formatés', () => {
    mockUseTresorerieKPIs.mockReturnValue(KPIS_OK);
    const { container } = renderComponent();

    expect(screen.getByText('Cashburn mensuel')).toBeInTheDocument();
    expect(screen.getByText('Cashburn moyen (6 mois passés)')).toBeInTheDocument();
    expect(screen.getByText('Masse salariale mensuelle moyenne')).toBeInTheDocument();

    const text = pageText(container);
    expect(text).toContain(fmt(-10000));
    expect(text).toContain(fmt(-12000));
    expect(text).toContain(fmt(-8000));
  });

  it('affiche le tableau du CA par exercice avec les valeurs métier', () => {
    mockUseTresorerieKPIs.mockReturnValue(KPIS_OK);
    const { container } = renderComponent();

    expect(screen.getByText("Chiffre d'affaires par exercice")).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();

    const text = pageText(container);
    expect(text).toContain(fmt(50000));
    expect(text).toContain(fmt(40000));
    expect(text).toContain(fmt(75000));
    expect(text).toContain(fmt(60000));
    expect(screen.queryByText('Aucun revenu enregistré')).not.toBeInTheDocument();
  });

  it('affiche les factures en attente et les fonds propres', () => {
    mockUseTresorerieKPIs.mockReturnValue(KPIS_OK);
    const { container } = renderComponent();

    expect(screen.getByText('Factures en attente')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(
      screen.getByText(`Projection fin ${new Date().getFullYear()}`)
    ).toBeInTheDocument();

    const text = pageText(container);
    expect(text).toContain(`${fmt(15000)} à encaisser`);
    expect(text).toContain(fmt(20000));
    expect(text).toContain(fmt(-5000));
  });

  it("affiche l'alerte de trou de trésorerie quand elle existe", () => {
    mockUseTresorerieKPIs.mockReturnValue(KPIS_OK);
    const { container } = renderComponent();

    expect(screen.getByText('Prochain trou de trésorerie prévu')).toBeInTheDocument();
    expect(screen.getByText('mars 2026')).toBeInTheDocument();
    expect(pageText(container)).toContain(fmt(-3000));
  });

  it('affiche le pipeline commercial avec les totaux calculés', () => {
    mockUseTresorerieKPIs.mockReturnValue(KPIS_OK);
    const { container } = renderComponent();

    expect(screen.getByText('Pipeline commercial')).toBeInTheDocument();
    expect(screen.getByText('Chaud')).toBeInTheDocument();
    expect(screen.getByText('Tiède')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    // Total établissements : 2 + 4 = 6
    expect(screen.getByText('6')).toBeInTheDocument();

    const text = pageText(container);
    // Total MRR : 1000 + 500 = 1500
    expect(text).toContain(fmtCompact(1500));
    // Total ARR : 12000 + 6000 = 18000
    expect(text).toContain(fmtCompact(18000));
    // ARR pondéré total : 12000*0.8 + 6000*0.5 = 12600
    expect(text).toContain(fmtCompact(12600));

    // Les barres de progression reflètent les probabilités
    const progressValues = screen
      .getAllByTestId('progress')
      .map((el) => el.getAttribute('data-value'));
    expect(progressValues).toContain('80');
    expect(progressValues).toContain('50');
  });

  it("affiche les états vides : pas de CA, pas de pipeline, pas d'alerte", () => {
    mockUseTresorerieKPIs.mockReturnValue(KPIS_EMPTY);
    renderComponent();

    expect(screen.getByText('Aucun revenu enregistré')).toBeInTheDocument();
    expect(screen.queryByText('Pipeline commercial')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Prochain trou de trésorerie prévu')
    ).not.toBeInTheDocument();
  });
});