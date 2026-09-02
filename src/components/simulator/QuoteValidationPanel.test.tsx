import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  MOCK_USER,
  debugError,
  formatEuroMock,
  mutateAsyncMock,
  useQuoteValidationMutationMock,
  mockFrom,
  mockSupabaseBuilder,
  RESULTS_BASE,
} = vi.hoisted(() => {
  const MOCK_USER = { id: 'u1', email: 't@t.co' };

  const debugError = vi.fn();

  const formatEuroMock = vi.fn((n: number) => `${n.toFixed(2)} €`);

  const mutateAsyncMock = vi.fn((_: unknown) => Promise.resolve());

  const useQuoteValidationMutationMock = vi.fn(() => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
    isError: false,
    isSuccess: false,
  }));

  type Builder = Record<string, unknown> & {
    __setNextSingle: (value: unknown) => void;
    __setNextMaybeSingle: (value: unknown) => void;
    __setNextThenable: (value: unknown) => void;
  };

  const createThenable = (get: () => unknown) => ({
    then: (onFulfilled?: (v: unknown) => unknown) => {
      try {
        const v = get();
        return Promise.resolve(onFulfilled ? onFulfilled(v) : v);
      } catch (e) {
        return Promise.reject(e);
      }
    },
    catch: (onRejected?: (e: unknown) => unknown) =>
      Promise.reject(new Error('thenable.catch not configured')).catch(onRejected),
  });

  const mockSupabaseBuilder = (() => {
    let nextSingle: unknown = { data: null, error: null };
    let nextMaybeSingle: unknown = { data: null, error: null };
    let nextThenable: unknown = { data: null, error: null };

    const builder: Builder = {
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
      rpc: vi.fn(() => builder),
      single: vi.fn(async () => nextSingle),
      maybeSingle: vi.fn(async () => nextMaybeSingle),
      __setNextSingle: (value: unknown) => {
        nextSingle = value;
      },
      __setNextMaybeSingle: (value: unknown) => {
        nextMaybeSingle = value;
      },
      __setNextThenable: (value: unknown) => {
        nextThenable = value;
      },
      ...createThenable(() => nextThenable),
    };

    return builder;
  })();

  const mockFrom = vi.fn(() => mockSupabaseBuilder);

  const RESULTS_BASE = {
    configuration: { resellerType: null as null | string },
    paliers: [
      {
        palier: 1,
        tauxObjectif: 1.5,
        coutTotal: 1000,
        coutTotalRevendeur: 1100,
        fraisAcces: 200,
        fraisAccesRevendeur: 220,
        prixSolution: 900,
        prixSolutionRevendeur: 990,
      },
      {
        palier: 2,
        tauxObjectif: 2.5,
        coutTotal: 2000,
        coutTotalRevendeur: 2200,
        fraisAcces: 200,
        fraisAccesRevendeur: 220,
        prixSolution: 1800,
        prixSolutionRevendeur: 1980,
      },
      {
        palier: 3,
        tauxObjectif: 3.5,
        coutTotal: 3000,
        coutTotalRevendeur: 3300,
        fraisAcces: 200,
        fraisAccesRevendeur: 220,
        prixSolution: 2700,
        prixSolutionRevendeur: 2970,
      },
      {
        palier: 4,
        tauxObjectif: 4.5,
        coutTotal: 4000,
        coutTotalRevendeur: 4400,
        fraisAcces: 200,
        fraisAccesRevendeur: 220,
        prixSolution: 3600,
        prixSolutionRevendeur: 3960,
      },
    ],
  };

  return {
    MOCK_USER,
    debugError,
    formatEuroMock,
    mutateAsyncMock,
    useQuoteValidationMutationMock,
    mockFrom,
    mockSupabaseBuilder,
    RESULTS_BASE,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: MOCK_USER } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: MOCK_USER }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/simulator-config', () => ({
  formatEuro: formatEuroMock,
}));

vi.mock('@/hooks/quote/useQuoteValidationMutation', () => ({
  useQuoteValidationMutation: useQuoteValidationMutationMock,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="card-title">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className} data-testid="button">
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/radio-group', () => ({
  RadioGroup: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    className?: string;
  }) => (
    <div data-testid="radio-group" data-value={value}>
      <button type="button" data-testid="radio-succes" onClick={() => onValueChange?.('succes')}>
        radio-succes
      </button>
      <button type="button" data-testid="radio-statique" onClick={() => onValueChange?.('statique')}>
        radio-statique
      </button>
      {children}
    </div>
  ),
  RadioGroupItem: ({ value, id }: { value: string; id?: string }) => <input type="radio" value={value} id={id} readOnly />,
}));

vi.mock('@/components/ui/select', () => {
  const Ctx = React.createContext<{ value?: string; onValueChange?: (v: string) => void } | null>(null);

  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode;
      value?: string;
      onValueChange?: (v: string) => void;
    }) => (
      <Ctx.Provider value={{ value, onValueChange }}>
        <div data-testid="select" data-value={value}>
          {children}
        </div>
      </Ctx.Provider>
    ),
    SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
    SelectValue: () => {
      const ctx = React.useContext(Ctx);
      return <span data-testid="select-value">{ctx?.value ?? ''}</span>;
    },
    SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const ctx = React.useContext(Ctx);
      return (
        <button type="button" data-testid={`select-item-${value}`} onClick={() => ctx?.onValueChange?.(value)}>
          {children}
        </button>
      );
    },
  };
});

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/alert-dialog', () => {
  const Ctx = React.createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

  return {
    AlertDialog: ({ children }: { children: React.ReactNode }) => {
      const [open, setOpen] = React.useState(false);
      return (
        <Ctx.Provider value={{ open, setOpen }}>
          <div data-testid="alert-dialog">{children}</div>
        </Ctx.Provider>
      );
    },
    AlertDialogTrigger: ({ children, asChild }: { children: React.ReactElement; asChild?: boolean }) => {
      const ctx = React.useContext(Ctx);
      if (!asChild) return children;
      const child = React.Children.only(children);
      return React.cloneElement(child, {
        onClick: (e: React.MouseEvent) => {
          (child.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
          ctx?.setOpen(true);
        },
      });
    },
    AlertDialogContent: ({ children }: { children: React.ReactNode }) => {
      const ctx = React.useContext(Ctx);
      if (!ctx?.open) return null;
      return <div role="dialog">{children}</div>;
    },
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogCancel: ({ children }: { children: React.ReactNode }) => {
      const ctx = React.useContext(Ctx);
      return (
        <button type="button" onClick={() => ctx?.setOpen(false)}>
          {children}
        </button>
      );
    },
    AlertDialogAction: ({
      children,
      onClick,
      disabled,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
  };
});

vi.mock('lucide-react', () => ({
  CheckCircle2: (props: Record<string, unknown>) => <svg data-testid="icon-check" {...props} />,
  Save: (props: Record<string, unknown>) => <svg data-testid="icon-save" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="icon-alert" {...props} />,
}));

import { QuoteValidationPanel } from './QuoteValidationPanel';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const client = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('QuoteValidationPanel', () => {
  it("affiche un message si aucun etablissementId", () => {
    render(<QuoteValidationPanel results={RESULTS_BASE} />);
    expect(
      screen.getByText("La validation contractuelle n'est disponible que depuis la fiche d'un établissement.")
    ).toBeTruthy();
    expect(screen.queryByText('Validation contractuelle')).toBeNull();
  });

  it('succès: récapitulatif palier par défaut (palier 3) et mutation avec payload complet', async () => {
    useQuoteValidationMutationMock.mockReturnValueOnce({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      isSuccess: false,
    });

    const onValidated = vi.fn();

    render(
      <QuoteValidationPanel
        results={RESULTS_BASE}
        etablissementId="etab-1"
        etablissementNom="Etab A"
        onValidated={onValidated}
      />
    );

    expect(screen.getByText('Validation contractuelle')).toBeTruthy();
    expect(screen.getByText('Type :')).toBeTruthy();
    expect(screen.getAllByText('Au succès').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Palier 3').length).toBeGreaterThan(0);
    expect(screen.getByText('3.5%')).toBeTruthy();

    const expectedFraisAcces = `${RESULTS_BASE.paliers[2].fraisAcces.toFixed(2)} €`;
    const expectedCoutAnnuel = `${RESULTS_BASE.paliers[2].coutTotal.toFixed(2)} €`;

    expect(screen.getAllByText(expectedFraisAcces).length).toBeGreaterThan(0);
    expect(screen.getAllByText(expectedCoutAnnuel).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Valider et enregistrer' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    expect(screen.getByText('Confirmer la validation')).toBeTruthy();
    expect(screen.getByText('Etab A')).toBeTruthy();
    expect(screen.getAllByText(expectedCoutAnnuel).length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    });

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      type: 'succes',
      etablissementId: 'etab-1',
      etablissementNom: 'Etab A',
      pallierVise: '3',
      tarifsData: {
        palier1: 1000,
        palier2: 2000,
        palier3: 3000,
        palier4: 4000,
        frais_acces: 200,
      },
      seuilsData: {
        palier1: 1.5,
        palier2: 2.5,
        palier3: 3.5,
        palier4: 4.5,
      },
      fraisAcces: 200,
    });
    expect(onValidated).toHaveBeenCalledTimes(1);
    expect(debugError).not.toHaveBeenCalled();
  });

  it('chargement: désactive le bouton quand isPending=true', () => {
    useQuoteValidationMutationMock.mockReturnValueOnce({
      mutateAsync: mutateAsyncMock,
      isPending: true,
      isError: false,
      isSuccess: false,
    });

    render(<QuoteValidationPanel results={RESULTS_BASE} etablissementId="etab-1" etablissementNom="Etab A" />);

    const btn = screen.getByRole('button', { name: 'Valider et enregistrer' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    fireEvent.click(btn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('erreur: si la mutation rejette, log debug.error et ne déclenche pas onValidated', async () => {
    const rejectingMutate = vi.fn(async () => {
      throw new Error('x');
    });

    useQuoteValidationMutationMock.mockReturnValueOnce({
      mutateAsync: rejectingMutate,
      isPending: false,
      isError: true,
      isSuccess: false,
    });

    const onValidated = vi.fn();

    render(
      <QuoteValidationPanel
        results={RESULTS_BASE}
        etablissementId="etab-1"
        etablissementNom="Etab A"
        onValidated={onValidated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Valider et enregistrer' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    });

    expect(rejectingMutate).toHaveBeenCalledTimes(1);
    expect(onValidated).not.toHaveBeenCalled();
    expect(debugError).toHaveBeenCalledTimes(1);
    expect((debugError.mock.calls[0] ?? [])[0]).toBe('Erreur validation devis:');
  });

  it('hook: renderHook dans QueryClientProvider (loading -> success -> error)', () => {
    const wrapper = createWrapper();

    const hookLoading = vi.fn(() => ({
      mutateAsync: mutateAsyncMock,
      isPending: true,
      isError: false,
      isSuccess: false,
    }));
    const hookSuccess = vi.fn(() => ({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      isSuccess: true,
    }));
    const hookError = vi.fn(() => ({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: true,
      isSuccess: false,
    }));

    useQuoteValidationMutationMock.mockImplementationOnce(hookLoading);
    const { result: r1, unmount: u1 } = renderHook(() => useQuoteValidationMutationMock(), { wrapper });
    expect(r1.current.isPending).toBe(true);
    expect(r1.current.isSuccess).toBe(false);
    u1();

    useQuoteValidationMutationMock.mockImplementationOnce(hookSuccess);
    const { result: r2, unmount: u2 } = renderHook(() => useQuoteValidationMutationMock(), { wrapper });
    expect(r2.current.isPending).toBe(false);
    expect(r2.current.isSuccess).toBe(true);
    expect(r2.current.isError).toBe(false);
    u2();

    useQuoteValidationMutationMock.mockImplementationOnce(hookError);
    const { result: r3, unmount: u3 } = renderHook(() => useQuoteValidationMutationMock(), { wrapper });
    expect(r3.current.isError).toBe(true);
    expect(r3.current.isSuccess).toBe(false);
    u3();
  });
});