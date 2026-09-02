import React from 'react';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Stable mocks and mutable hook state must be hoisted
const { mockMutateAsync, hookState, mockFrom, supabaseBuilder } = vi.hoisted(() => {
  const mockMutateAsync = vi.fn(async (payload: unknown) => Promise.resolve(payload));
  const hookState = { current: { mutateAsync: mockMutateAsync, isLoading: false, isError: false, error: null } };

  // Supabase builder chain stub (thenable)
  const supabaseBuilder = {
    select: vi.fn(() => supabaseBuilder),
    eq: vi.fn(() => supabaseBuilder),
    gte: vi.fn(() => supabaseBuilder),
    lte: vi.fn(() => supabaseBuilder),
    in: vi.fn(() => supabaseBuilder),
    order: vi.fn(() => supabaseBuilder),
    limit: vi.fn(() => supabaseBuilder),
    insert: vi.fn(() => supabaseBuilder),
    update: vi.fn(() => supabaseBuilder),
    delete: vi.fn(() => supabaseBuilder),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: function (resolve: unknown) {
      return Promise.resolve({ data: null, error: null }).then(resolve as any);
    },
    catch: vi.fn(() => supabaseBuilder),
  };

  const mockFrom = vi.fn(() => supabaseBuilder);

  return { mockMutateAsync, hookState, mockFrom, supabaseBuilder };
});

// Mock supabase client as required by rules
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }));

// Mock UI components used by the module
vi.mock('@/components/ui/card', () => ({ Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div> }));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, disabled }: { children: React.ReactNode; onClick?: () => void; variant?: string; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>{children}</button>
  ),
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder }: { value: string; onChange?: (e: any) => void; placeholder?: string }) => (
    <input role="textbox" value={value} onChange={onChange} placeholder={placeholder} />
  ),
}));
vi.mock('@/components/ui/label', () => ({ Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label> }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table><tbody>{children}</tbody></table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, colSpan, className }: { children: React.ReactNode; colSpan?: number; className?: string }) => <td colSpan={colSpan} className={className}>{children}</td>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
}));

// Mock lucide icon
vi.mock('lucide-react', () => ({ Plus: () => <span>+</span> }));

// Mock the hook module with a mutable hoisted state
vi.mock('@/hooks/auth/useRgpd', () => ({ useCreateRgpdDpa: () => hookState.current }));

// Now import the component under test after setting up mocks
import { RgpdDpaTab } from './RgpdDpaTab';
import { useCreateRgpdDpa } from '@/hooks/auth/useRgpd';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = createQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('RgpdDpaTab component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // reset hook state to default before each test
    hookState.current = { mutateAsync: mockMutateAsync, isLoading: false, isError: false, error: null };
  });

  it('renders empty state when no dpas provided', () => {
    render(<RgpdDpaTab dpas={undefined} />);
    expect(screen.getByText('Aucun sous-traitant enregistré')).toBeTruthy();
    // ensure table headers are rendered
    expect(screen.getByText('Sous-traitant')).toBeTruthy();
    expect(screen.getByText('Statut')).toBeTruthy();
  });

  it('renders provided dpas with proper badges and formatted dates', () => {
    const dpas = [
      {
        id: '1',
        nom_sous_traitant: 'Acme Cloud',
        type_service: 'Hébergement',
        pays: 'États-Unis',
        est_hors_ue: true,
        est_hds: true,
        date_expiration: '2024-12-31',
        est_actif: true,
      },
      {
        id: '2',
        nom_sous_traitant: 'Local Mail',
        type_service: 'Email',
        pays: 'France',
        est_hors_ue: false,
        est_hds: false,
        date_expiration: null,
        est_actif: false,
      },
    ];

    render(<RgpdDpaTab dpas={dpas} />);

    // First row checks
    expect(screen.getByText('Acme Cloud')).toBeTruthy();
    expect(screen.getByText('Hébergement')).toBeTruthy();
    expect(screen.getByText('États-Unis')).toBeTruthy();
    expect(screen.getByText('Hors UE')).toBeTruthy();
    expect(screen.getByText('Certifié HDS')).toBeTruthy();
    // date formatted as dd/MM/yyyy
    expect(screen.getByText('31/12/2024')).toBeTruthy();
    expect(screen.getByText('Actif')).toBeTruthy();

    // Second row checks
    expect(screen.getByText('Local Mail')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('France')).toBeTruthy();
    // no date -> hyphen
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Inactif')).toBeTruthy();
  });

  it('calls createDpa.mutateAsync with correct payload when adding a new dpa', async () => {
    // Ensure DialogContent is rendered by our mock so inputs are present
    render(<RgpdDpaTab dpas={[]} />);

    // There are three textboxes: nom, type, pays
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(3);

    const [nomInput, typeInput, paysInput] = inputs;

    // Simulate user filling the form
    await act(async () => {
      fireEvent.change(nomInput, { target: { value: 'Nouvel Acteur' } });
      fireEvent.change(typeInput, { target: { value: 'CRM' } });
      // leave pays as default or change
      fireEvent.change(paysInput, { target: { value: 'France' } });
    });

    const addButton = screen.getByText('Ajouter') as HTMLButtonElement;
    expect(addButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(addButton);
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      nom_sous_traitant: 'Nouvel Acteur',
      type_service: 'CRM',
      pays: 'France',
      est_hds: false,
    });
  });

  it('exposes loading state from useCreateRgpdDpa (renderHook) and then error state when configured', async () => {
    // Test loading state
    hookState.current = { mutateAsync: mockMutateAsync, isLoading: true, isError: false, error: null };

    const qc = createQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

    const { result: loadingResult } = renderHook(() => useCreateRgpdDpa(), { wrapper });
    expect(loadingResult.current.isLoading).toBe(true);
    expect(loadingResult.current.isError).toBe(false);
    expect(loadingResult.current.error).toBeNull();

    // Test error state
    hookState.current = { mutateAsync: mockMutateAsync, isLoading: false, isError: true, error: { message: 'échec mutation' } };
    const { result: errorResult } = renderHook(() => useCreateRgpdDpa(), { wrapper });
    expect(errorResult.current.isLoading).toBe(false);
    expect(errorResult.current.isError).toBe(true);
    expect(errorResult.current.error).toStrictEqual({ message: 'échec mutation' });
  });
});