// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FranceRegionMap } from './FranceRegionMap';

const {
  GEO_STATS_LOADING,
  GEO_STATS_SUCCESS,
  GEO_STATS_ERROR,
  mockUseGeographicStats,
  mockFrom,
} = vi.hoisted(() => {
  const GEO_STATS_LOADING = {
    stats: {
      byRegion: {},
    },
    isLoading: true,
    isError: false,
    error: null,
  };

  const GEO_STATS_SUCCESS = {
    stats: {
      byRegion: {
        Bretagne: 16,
        Occitanie: 10,
        'Île-de-France': 7,
        Normandie: 3,
        Corse: 0,
      },
    },
    isLoading: false,
    isError: false,
    error: null,
  };

  const GEO_STATS_ERROR = {
    stats: {
      byRegion: {},
    },
    isLoading: false,
    isError: true,
    error: { message: 'x' },
  };

  const mockUseGeographicStats = vi.fn(() => GEO_STATS_SUCCESS);

  type BuilderResult = { data: unknown; error: unknown };

  const createBuilder = (result: BuilderResult) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled?: (value: BuilderResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder({ data: null, error: null }));

  return {
    GEO_STATS_LOADING,
    GEO_STATS_SUCCESS,
    GEO_STATS_ERROR,
    mockUseGeographicStats,
    mockFrom,
  };
});

vi.mock('@/hooks/geography/useGeographicStats', () => ({
  useGeographicStats: mockUseGeographicStats,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('lucide-react', () => ({
  MapPin: ({ className }: { className?: string }) => <svg data-testid="map-pin" className={className} />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('FranceRegionMap', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return Wrapper;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGeographicStats.mockReturnValue(GEO_STATS_SUCCESS);
  });

  it('affiche le titre, l’icône et les régions triées par ordre décroissant avec leurs valeurs métier', () => {
    render(<FranceRegionMap />);

    expect(screen.getByText('Répartition par région')).toBeInTheDocument();
    expect(screen.getByTestId('map-pin')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);

    expect(buttons[0]).toHaveTextContent('Bretagne');
    expect(buttons[0]).toHaveTextContent('16');
    expect(buttons[1]).toHaveTextContent('Occitanie');
    expect(buttons[1]).toHaveTextContent('10');
    expect(buttons[2]).toHaveTextContent('Île-de-France');
    expect(buttons[2]).toHaveTextContent('7');
    expect(buttons[3]).toHaveTextContent('Normandie');
    expect(buttons[3]).toHaveTextContent('3');
    expect(buttons[4]).toHaveTextContent('Corse');
    expect(buttons[4]).toHaveTextContent('0');

    expect(screen.getAllByText('1-3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4-8').length).toBeGreaterThan(0);
    expect(screen.getByText('15+')).toBeInTheDocument();
  });

  it('applique les classes visuelles selon les seuils et la largeur de progression calculée', () => {
    render(<FranceRegionMap />);

    const bretagne = screen.getByRole('button', { name: /Bretagne/i });
    const occitanie = screen.getByRole('button', { name: /Occitanie/i });
    const ileDeFrance = screen.getByRole('button', { name: /Île-de-France/i });
    const normandie = screen.getByRole('button', { name: /Normandie/i });
    const corse = screen.getByRole('button', { name: /Corse/i });

    expect(bretagne.className).toContain('bg-primary/10');
    expect(bretagne.className).toContain('border-primary/30');

    expect(occitanie.className).toContain('bg-emerald-50');
    expect(occitanie.className).toContain('border-emerald-200');

    expect(ileDeFrance.className).toContain('bg-blue-50');
    expect(ileDeFrance.className).toContain('border-blue-200');

    expect(normandie.className).toContain('bg-amber-50');
    expect(normandie.className).toContain('border-amber-200');

    expect(corse.className).toContain('bg-muted/30');
    expect(corse.className).toContain('border-muted-foreground/10');

    const bretagneBar = bretagne.querySelector('[style*="width: 100%"]');
    const occitanieBar = occitanie.querySelector('[style*="width: 62.5%"]');
    const ileBar = ileDeFrance.querySelector('[style*="width: 43.75%"]');
    const normandieBar = normandie.querySelector('[style*="width: 18.75%"]');
    const corseBar = corse.querySelector('[style*="width: 0%"]');

    expect(bretagneBar).toBeTruthy();
    expect(occitanieBar).toBeTruthy();
    expect(ileBar).toBeTruthy();
    expect(normandieBar).toBeTruthy();
    expect(corseBar).toBeTruthy();
  });

  it('gère la sélection d’une région avec badge et style primaire', () => {
    render(<FranceRegionMap selectedRegion="Occitanie" />);

    const occitanie = screen.getByRole('button', { name: /Occitanie/i });
    expect(occitanie.className).toContain('border-primary');
    expect(occitanie.className).toContain('bg-primary/10');
    expect(occitanie.className).toContain('scale-[1.02]');
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('déclenche onRegionClick avec le nom exact de la région cliquée', async () => {
    const onRegionClick = vi.fn();

    render(<FranceRegionMap onRegionClick={onRegionClick} />);

    fireEvent.click(screen.getByRole('button', { name: /Normandie/i }));

    expect(onRegionClick).toHaveBeenCalledTimes(1);
    expect(onRegionClick).toHaveBeenCalledWith('Normandie');
  });

  it('supporte un état de chargement via le hook et expose isLoading dans un renderHook avec QueryClientProvider', () => {
    mockUseGeographicStats.mockReturnValue(GEO_STATS_LOADING);

    const wrapper = createWrapper();

    const { result } = renderHook(() => mockUseGeographicStats(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.stats.byRegion).toEqual({});

    render(<FranceRegionMap />);
    expect(screen.getByText('Répartition par région')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('expose les données de succès réelles via le hook mocké', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => mockUseGeographicStats(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.stats.byRegion.Bretagne).toBe(16);
    expect(result.current.stats.byRegion.Occitanie).toBe(10);
    expect(result.current.stats.byRegion['Île-de-France']).toBe(7);
    expect(result.current.stats.byRegion.Normandie).toBe(3);
    expect(result.current.stats.byRegion.Corse).toBe(0);
  });

  it('gère un état d’erreur du hook avec error.message = x et isError = true', () => {
    mockUseGeographicStats.mockReturnValue(GEO_STATS_ERROR);

    const wrapper = createWrapper();

    const { result } = renderHook(() => mockUseGeographicStats(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.stats.byRegion).toEqual({});

    render(<FranceRegionMap />);
    expect(screen.getByText('Répartition par région')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});