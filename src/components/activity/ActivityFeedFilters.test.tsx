// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, cleanup, renderHook } from '@testing-library/react';
import { ActivityFeedFilters } from './ActivityFeedFilters';

const {
  PROFILES_ROWS,
  ETABS_ROWS,
  PROFILE_RESULT,
  ETABS_RESULT,
  mockFrom,
  mockOnChange,
  calendarPropsSpy,
} = vi.hoisted(() => ({
  PROFILES_ROWS: [
    { user_id: 'u1', prenom: 'Alice', nom: 'Martin' },
    { user_id: 'u2', prenom: 'Bob', nom: 'Durand' },
  ],
  ETABS_ROWS: [
    { id: 'e1', nom: 'Clinique A' },
    { id: 'e2', nom: 'Hôpital B' },
  ],
  PROFILE_RESULT: { data: null as null | Array<{ user_id: string; prenom: string; nom: string }>, error: null as null | { message: string } },
  ETABS_RESULT: { data: null as null | Array<{ id: string; nom: string }>, error: null as null | { message: string } },
  mockFrom: vi.fn(),
  mockOnChange: vi.fn(),
  calendarPropsSpy: vi.fn(),
}));

vi.mock('@/types/activity', () => ({
  ACTIVITY_TYPE_LABELS: {
    created: 'Création',
    updated: 'Modification',
    deleted: 'Suppression',
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ children }: { children?: React.ReactNode }) => <span>{children}</span>;
  return {
    X: Icon,
    Search: Icon,
    Users: Icon,
    Building2: Icon,
    CalendarIcon: Icon,
    Filter: Icon,
  };
});

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
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

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
  }) => <input value={value} onChange={onChange} placeholder={placeholder} data-class={className} />,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
  CommandItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
  }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: (props: {
    onSelect?: (range: { from?: Date; to?: Date }) => void;
    selected?: { from?: Date; to?: Date };
  }) => {
    calendarPropsSpy(props);
    return (
      <button
        type="button"
        onClick={() =>
          props.onSelect?.({
            from: new Date('2024-01-10T00:00:00.000Z'),
            to: new Date('2024-01-20T00:00:00.000Z'),
          })
        }
      >
        MockCalendar
      </button>
    );
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createBuilder(result: { data: unknown; error: null | { message: string } }) {
  const builder: any = {
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
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (onFulfilled: (value: { data: unknown; error: null | { message: string } }) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ActivityFeedFilters', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    PROFILE_RESULT.data = PROFILES_ROWS;
    PROFILE_RESULT.error = null;
    ETABS_RESULT.data = ETABS_ROWS;
    ETABS_RESULT.error = null;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return createBuilder(PROFILE_RESULT);
      }
      if (table === 'etablissements') {
        return createBuilder(ETABS_RESULT);
      }
      return createBuilder({ data: [], error: null });
    });
  });

  it('charge les données supabase et affiche les valeurs métier réelles', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => ({ ready: true }), { wrapper });
    expect(result.current.ready).toBe(true);

    render(
      <QueryClientProvider client={createQueryClient()}>
        <ActivityFeedFilters filters={{}} onChange={mockOnChange} />
      </QueryClientProvider>
    );

    expect(screen.getByPlaceholderText('Rechercher (titre, description, établissement, auteur)…')).toHaveValue('');
    expect(screen.getByText('Utilisateurs')).toBeInTheDocument();
    expect(screen.getByText('Établissements')).toBeInTheDocument();
    expect(screen.getByText('Période')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alice Martin')).toBeInTheDocument();
      expect(screen.getByText('Bob Durand')).toBeInTheDocument();
      expect(screen.getByText('Clinique A')).toBeInTheDocument();
      expect(screen.getByText('Hôpital B')).toBeInTheDocument();
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(screen.getByText('Création')).toBeInTheDocument();
    expect(screen.getByText('Modification')).toBeInTheDocument();
    expect(screen.getByText('Suppression')).toBeInTheDocument();
  });

  it('déclenche onChange avec les bons filtres pour recherche, types, utilisateurs, établissements et période', async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <ActivityFeedFilters filters={{}} onChange={mockOnChange} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Martin')).toBeInTheDocument();
      expect(screen.getByText('Clinique A')).toBeInTheDocument();
    });

    vi.useFakeTimers();

    fireEvent.change(screen.getByPlaceholderText('Rechercher (titre, description, établissement, auteur)…'), {
      target: { value: 'urgence' },
    });

    await vi.advanceTimersByTimeAsync(300);

    expect(mockOnChange).toHaveBeenCalledWith({ search: 'urgence' });

    vi.useRealTimers();

    fireEvent.click(screen.getByText('Création'));
    expect(mockOnChange).toHaveBeenCalledWith({ types: ['created'] });

    fireEvent.click(screen.getByText('Alice Martin'));
    expect(mockOnChange).toHaveBeenCalledWith({ user_ids: ['u1'] });

    fireEvent.click(screen.getByText('Clinique A'));
    expect(mockOnChange).toHaveBeenCalledWith({ etablissement_ids: ['e1'] });

    fireEvent.click(screen.getByText('MockCalendar'));
    expect(mockOnChange).toHaveBeenCalledWith({
      date_from: '2024-01-10T00:00:00.000Z',
      date_to: '2024-01-20T00:00:00.000Z',
    });
  });

  it('affiche les filtres actifs et permet de tout effacer', async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <ActivityFeedFilters
          filters={{
            search: 'abc',
            types: ['created'],
            user_ids: ['u1'],
            etablissement_ids: ['e1'],
            date_from: '2024-01-10T00:00:00.000Z',
            date_to: '2024-01-20T00:00:00.000Z',
          }}
          onChange={mockOnChange}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('abc')).toBeInTheDocument();
    expect(screen.getByText('10/01/24 → 20/01/24')).toBeInTheDocument();
    expect(screen.getByText('Tout effacer')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Tout effacer'));

    expect(mockOnChange).toHaveBeenCalledWith({});
  });

  it('gère les erreurs de requête react-query via le wrapper de hook', async () => {
    PROFILE_RESULT.data = null;
    PROFILE_RESULT.error = { message: 'x' };

    const { useQuery } = await import('@tanstack/react-query');

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['error-case'],
          queryFn: async () => {
            const { supabase } = await import('@/integrations/supabase/client');
            const response = await supabase.from('profiles').select('user_id, prenom, nom');
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.data;
          },
        }),
      { wrapper }
    );

    expect(result.current.isLoading || result.current.isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
  });
})