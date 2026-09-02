import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import { GeographicFilters } from './GeographicFilters';

const {
  STABLE_FILTERS,
  STABLE_PROFILES,
  STABLE_REGIONS,
  mockUpdateFilter,
  mockResetFilters,
  mockOnFiltersChange,
  mockUseGeographicFilters,
  mockUseProfiles,
  mockGetAllRegions,
  mockDebugWarn,
  mockFrom,
} = vi.hoisted(() => {
  const STABLE_FILTERS = {
    search: '',
    regions: [],
    types: [],
    phases: [],
    dpis: [],
    licensesRange: [0, 1000] as [number, number],
    passagesRange: [0, 500000] as [number, number],
    commercialId: undefined as string | undefined,
    chefProjetId: undefined as string | undefined,
    csmId: undefined as string | undefined,
  };

  const STABLE_PROFILES = [
    { id: 'p1', prenom: 'Alice', nom: 'Martin' },
    { id: 'p2', prenom: 'Bob', nom: 'Durand' },
  ];

  const STABLE_REGIONS = ['Île-de-France', 'Occitanie', 'Bretagne', 'Normandie'];

  const mockUpdateFilter = vi.fn();
  const mockResetFilters = vi.fn();
  const mockOnFiltersChange = vi.fn();

  const mockUseGeographicFilters = vi.fn(() => ({
    filters: STABLE_FILTERS,
    updateFilter: mockUpdateFilter,
    resetFilters: mockResetFilters,
    hasActiveFilters: false,
  }));

  const mockUseProfiles = vi.fn(() => ({
    data: STABLE_PROFILES,
    isLoading: false,
    isError: false,
  }));

  const mockGetAllRegions = vi.fn(() => STABLE_REGIONS);
  const mockDebugWarn = vi.fn();

  const createBuilder = () => {
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
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (resolve: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve),
      catch: (reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(reject),
    };
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());

  return {
    STABLE_FILTERS,
    STABLE_PROFILES,
    STABLE_REGIONS,
    mockUpdateFilter,
    mockResetFilters,
    mockOnFiltersChange,
    mockUseGeographicFilters,
    mockUseProfiles,
    mockGetAllRegions,
    mockDebugWarn,
    mockFrom,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    warn: mockDebugWarn,
  },
}));

vi.mock('@/hooks/geography/useGeographicFilters', () => ({
  useGeographicFilters: mockUseGeographicFilters,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: mockUseProfiles,
}));

vi.mock('@/lib/geography', () => ({
  getAllRegions: mockGetAllRegions,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
    <input ref={ref} {...props} />
  )),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => <div data-value={value} data-onchange={String(Boolean(onValueChange))}>{children}</div>,
  SelectTrigger: ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SelectItem: ({
    children,
    value,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { value: string }) => (
    <div data-value={value} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  PopoverContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandItem: ({
    children,
    onSelect,
    value,
  }: {
    children: React.ReactNode;
    onSelect?: (value: string) => void;
    value: string;
  }) => (
    <button type="button" onClick={() => onSelect?.(value)}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: (props: React.HTMLAttributes<HTMLHRElement>) => <hr {...props} />,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode; defaultOpen?: boolean }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
  CollapsibleContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Search: Icon,
    X: Icon,
    Filter: Icon,
    Users: Icon,
    MapPin: Icon,
    Building: Icon,
    Cpu: Icon,
    ChevronDown: Icon,
    Check: Icon,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('GeographicFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockUseGeographicFilters.mockReturnValue({
      filters: STABLE_FILTERS,
      updateFilter: mockUpdateFilter,
      resetFilters: mockResetFilters,
      hasActiveFilters: false,
    });

    mockUseProfiles.mockReturnValue({
      data: STABLE_PROFILES,
      isLoading: false,
      isError: false,
    });

    mockGetAllRegions.mockReturnValue(STABLE_REGIONS);
  });

  it('se charge avec les données métier attendues via le wrapper QueryClientProvider', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const profiles = mockUseProfiles();
        return {
          profilesCount: profiles.data.length,
          firstProfileName: `${profiles.data[0].prenom} ${profiles.data[0].nom}`,
          regions: mockGetAllRegions(),
        };
      },
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.profilesCount).toBe(2);
    });

    expect(result.current.firstProfileName).toBe('Alice Martin');
    expect(result.current.regions).toEqual(['Île-de-France', 'Occitanie', 'Bretagne', 'Normandie']);
  });

  it('restaure les filtres sauvegardés sans restaurer les phases et notifie onFiltersChange', async () => {
    localStorage.setItem(
      'geo-advanced-filters',
      JSON.stringify({
        search: 'CHU Paris',
        regions: ['Occitanie', 'Bretagne'],
        types: ['CHU'],
        phases: ['Production'],
        dpis: ['Maincare'],
      })
    );

    render(<GeographicFilters onFiltersChange={mockOnFiltersChange} />);

    await waitFor(() => {
      expect(mockUpdateFilter).toHaveBeenCalledWith('search', 'CHU Paris');
    });

    expect(mockUpdateFilter).toHaveBeenCalledWith('regions', ['Occitanie', 'Bretagne']);
    expect(mockUpdateFilter).toHaveBeenCalledWith('types', ['CHU']);
    expect(mockUpdateFilter).toHaveBeenCalledWith('dpis', ['Maincare']);
    expect(mockUpdateFilter).not.toHaveBeenCalledWith('phases', ['Production']);

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      search: 'CHU Paris',
      regions: ['Occitanie', 'Bretagne'],
      types: ['CHU'],
      dpis: ['Maincare'],
      phases: [],
    });
  });

  it('met à jour la recherche puis permet de sélectionner une région avec des valeurs métier réelles', async () => {
    render(<GeographicFilters onFiltersChange={mockOnFiltersChange} />);

    const input = screen.getByPlaceholderText('Rechercher...');
    fireEvent.change(input, { target: { value: 'Clinique Toulouse' } });

    expect(mockUpdateFilter).toHaveBeenCalledWith('search', 'Clinique Toulouse');

    const regionButton = screen.getByRole('button', { name: /Île-de-France/i });
    fireEvent.click(regionButton);

    expect(mockUpdateFilter).toHaveBeenCalledWith('regions', ['Île-de-France']);
  });

  it('affiche un état de chargement métier côté hook mocké puis un succès', async () => {
    mockUseProfiles
      .mockReturnValueOnce({
        data: [],
        isLoading: true,
        isError: false,
      })
      .mockReturnValue({
        data: STABLE_PROFILES,
        isLoading: false,
        isError: false,
      });

    const wrapper = createWrapper();

    const { result, rerender } = renderHook(() => mockUseProfiles(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);

    rerender();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(STABLE_PROFILES);
    expect(result.current.data[1].prenom).toBe('Bob');
  });

  it('gère une erreur de hook métier avec isError à true', async () => {
    const errorState = {
      data: null,
      error: { message: 'x' },
      isLoading: false,
      isError: true,
    };

    const failingHook = vi.fn(() => errorState);
    const wrapper = createWrapper();

    const { result } = renderHook(() => failingHook(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.data).toBeNull();
  });

  it('déclenche une mutation simulée dans act et vérifie l’appel attendu', async () => {
    const mutateFilters = vi.fn();

    const wrapper = createWrapper();

    const { result } = renderHook(
      () => ({
        mutate: mutateFilters,
      }),
      { wrapper }
    );

    await act(async () => {
      result.current.mutate({
        regions: ['Occitanie'],
        phases: ['Production'],
      });
    });

    expect(mutateFilters).toHaveBeenCalledWith({
      regions: ['Occitanie'],
      phases: ['Production'],
    });
  });
});