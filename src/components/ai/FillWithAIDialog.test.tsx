// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import { FillWithAIDialog } from './FillWithAIDialog';

const {
  AUTH_STATE,
  TOAST_FN,
  INVOKE_EDGE_MOCK,
  ON_OPEN_CHANGE,
  NAVIGATE_MOCK,
  ITEMS_ETABS,
  ENRICHED_ETABS,
  BUILDER_STATE,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE_VALUE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const toastFn = vi.fn();
  const invokeEdgeMock = vi.fn();
  const onOpenChange = vi.fn();
  const navigateMock = vi.fn();

  const itemsEtabs = [
    {
      id: 'e1',
      nom: 'Clinique du Lac',
      ville: 'Lyon',
      region: 'Ancienne région',
      statut: 'privé',
      type: 'clinique',
      dpi: 'oui',
      ca_mensuel: 12000,
      type_etablissement: 'clinique',
    },
    {
      id: 'e2',
      nom: 'Centre Hospitalier Nord',
      ville: 'Lille',
      region: 'Ancienne région 2',
      statut: 'public',
      type: 'hôpital',
      dpi: 'non',
      ca_mensuel: 22000,
      type_etablissement: 'centre hospitalier',
    },
  ];

  const enrichedEtabs = [
    {
      id: 'e1',
      type_etablissement_enrichi: 'Clinique privée',
      region: 'Auvergne-Rhône-Alpes',
      notes: 'Établissement régional',
      category_ai: 'ETI',
    },
    {
      id: 'e2',
      type_etablissement_enrichi: 'CHU',
      region: 'Hauts-de-France',
      notes: 'Grand établissement public',
      category_ai: 'Grand compte',
    },
  ];

  const builderState = {
    updateCalls: [] as Array<Record<string, unknown>>,
    eqCalls: [] as Array<[string, unknown]>,
    resultQueue: [] as Array<{ data: unknown; error: { message: string } | null }>,
    singleResult: { data: null as unknown, error: null as { message: string } | null },
    maybeSingleResult: { data: null as unknown, error: null as { message: string } | null },
  };

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((field: string, value: unknown) => {
        builderState.eqCalls.push([field, value]);
        const next = builderState.resultQueue.shift() ?? { data: null, error: null };
        return Promise.resolve(next);
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn((payload: Record<string, unknown>) => {
        builderState.updateCalls.push(payload);
        return builder;
      }),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => builderState.singleResult),
      maybeSingle: vi.fn(async () => builderState.maybeSingleResult),
      then: (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) => {
        const next = builderState.resultQueue.shift() ?? { data: null, error: null };
        return Promise.resolve(onFulfilled(next));
      },
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
    };
    return builder;
  };

  const fromMock = vi.fn(() => createBuilder());

  return {
    AUTH_STATE: AUTH_STATE_VALUE,
    TOAST_FN: toastFn,
    INVOKE_EDGE_MOCK: invokeEdgeMock,
    ON_OPEN_CHANGE: onOpenChange,
    NAVIGATE_MOCK: navigateMock,
    ITEMS_ETABS: itemsEtabs,
    ENRICHED_ETABS: enrichedEtabs,
    BUILDER_STATE: builderState,
    mockFrom: fromMock,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: INVOKE_EDGE_MOCK,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => NAVIGATE_MOCK,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="dialog-root" data-open={String(open)}>
      <button type="button" onClick={() => onOpenChange(false)}>
        close-dialog
      </button>
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  DialogTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <h1 className={className}>{children}</h1>,
  DialogDescription: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <p className={className}>{children}</p>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type = 'button',
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    className,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    className?: string;
  }) => (
    <input
      className={className}
      type="checkbox"
      checked={Boolean(checked)}
      onChange={() => onCheckedChange?.(!checked)}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <label className={className}>{children}</label>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    rows,
    className,
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={className}
    />
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: ({ className }: { className?: string }) => <hr className={className} />,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <tr className={className}>{children}</tr>,
  TableHead: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <th className={className}>{children}</th>,
  TableCell: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <td className={className}>{children}</td>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Sparkles: Icon,
    Loader2: Icon,
    ArrowLeft: Icon,
    AlertTriangle: Icon,
    Building2: Icon,
    Users: Icon,
    ChevronRight: Icon,
    Eye: Icon,
    Save: Icon,
    RotateCcw: Icon,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { Wrapper, queryClient };
}

describe('FillWithAIDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    BUILDER_STATE.updateCalls.length = 0;
    BUILDER_STATE.eqCalls.length = 0;
    BUILDER_STATE.resultQueue.length = 0;
    BUILDER_STATE.singleResult = { data: null, error: null };
    BUILDER_STATE.maybeSingleResult = { data: null, error: null };
  });

  it('monte correctement avec renderHook dans un QueryClientProvider et couvre isLoading puis succès', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['hook-loading-success'],
          queryFn: async () => ITEMS_ETABS,
        }),
      { wrapper: Wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(ITEMS_ETABS);
    expect(result.current.data?.[0]?.nom).toBe('Clinique du Lac');
    expect(result.current.data?.[1]?.nom).toBe('Centre Hospitalier Nord');
  });

  it('affiche la configuration initiale avec les champs présélectionnés réels', () => {
    const { Wrapper } = createWrapper();

    render(
      <FillWithAIDialog
        open
        onOpenChange={ON_OPEN_CHANGE}
        entityType="etablissements"
        items={ITEMS_ETABS}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('Fill with AI')).toBeInTheDocument();
    expect(screen.getByText(/Enrichir 2 établissements/)).toBeInTheDocument();
    expect(screen.getByText('Type précis')).toBeInTheDocument();
    expect(screen.getByText('Région')).toBeInTheDocument();
    expect(screen.getByText('Note contextuelle')).toBeInTheDocument();
    expect(screen.getByText('Segment client')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
    expect(checkboxes[3]).not.toBeChecked();
  });

  it('déclenche l’enrichissement, affiche le succès métier réel puis applique les mises à jour Supabase', async () => {
    const user = userEvent.setup();
    const { queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    INVOKE_EDGE_MOCK.mockResolvedValue({
      enriched_items: ENRICHED_ETABS,
      total_processed: 2,
      total_requested: 2,
    });

    render(
      <FillWithAIDialog
        open
        onOpenChange={ON_OPEN_CHANGE}
        entityType="etablissements"
        items={ITEMS_ETABS}
      />,
      { wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> }
    );

    const textarea = screen.getByPlaceholderText(/Priorise les établissements publics/i);
    await user.type(textarea, 'Concentre-toi sur les acteurs publics');

    const actionButton = screen.getAllByRole('button').find((button) => {
      const text = button.textContent ?? '';
      return text.includes('Aperçu') || text.includes('Enrichir') || text.includes('Générer');
    });

    expect(actionButton).toBeTruthy();

    if (actionButton) {
      await user.click(actionButton);
    }

    await waitFor(() => {
      expect(INVOKE_EDGE_MOCK).toHaveBeenCalledTimes(1);
    });

    expect(INVOKE_EDGE_MOCK).toHaveBeenCalledWith('fill-with-ai', {
      entity_type: 'etablissements',
      items: [
        {
          id: 'e1',
          nom: 'Clinique du Lac',
          ville: 'Lyon',
          region: 'Ancienne région',
          statut: 'privé',
          type: 'clinique',
          dpi: 'oui',
          ca_mensuel: 12000,
          type_etablissement: 'clinique',
        },
        {
          id: 'e2',
          nom: 'Centre Hospitalier Nord',
          ville: 'Lille',
          region: 'Ancienne région 2',
          statut: 'public',
          type: 'hôpital',
          dpi: 'non',
          ca_mensuel: 22000,
          type_etablissement: 'centre hospitalier',
        },
      ],
      fields_to_enrich: [
        {
          field: 'type_etablissement_enrichi',
          label: 'Type précis',
          instruction: 'CHU, CH, clinique privée, EHPAD, HAD, SSR, psychiatrie, etc.',
        },
        {
          field: 'region',
          label: 'Région',
          instruction: 'Région administrative française basée sur la ville',
        },
      ],
      custom_instructions: 'Concentre-toi sur les acteurs publics',
    });

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '2/2 éléments enrichis ✨',
        })
      );
    });

    expect(screen.getByText('Aperçu')).toBeInTheDocument();
    expect(screen.getByText('Clinique du Lac')).toBeInTheDocument();
    expect(screen.getByText('Centre Hospitalier Nord')).toBeInTheDocument();
    expect(screen.getByText('Clinique privée')).toBeInTheDocument();
    expect(screen.getByText('Auvergne-Rhône-Alpes')).toBeInTheDocument();
    expect(screen.getByText('CHU')).toBeInTheDocument();
    expect(screen.getByText('Hauts-de-France')).toBeInTheDocument();

    const applyButton = screen.getAllByRole('button').find((button) => {
      const text = button.textContent ?? '';
      return text.includes('Appliquer') || text.includes('Sauvegarder');
    });

    expect(applyButton).toBeTruthy();

    if (applyButton) {
      await act(async () => {
        await user.click(applyButton);
      });
    }

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('etablissements');
    });

    expect(BUILDER_STATE.updateCalls).toEqual([
      {
        type_etablissement_enrichi: 'Clinique privée',
        region: 'Auvergne-Rhône-Alpes',
        notes: 'Établissement régional',
        category_ai: 'ETI',
      },
      {
        type_etablissement_enrichi: 'CHU',
        region: 'Hauts-de-France',
        notes: 'Grand établissement public',
        category_ai: 'Grand compte',
      },
    ]);

    expect(BUILDER_STATE.eqCalls).toEqual([
      ['id', 'e1'],
      ['id', 'e2'],
    ]);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['etablissements'] });
    expect(ON_OPEN_CHANGE).toHaveBeenCalledWith(false);
    expect(TOAST_FN).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '2 éléments mis à jour ✓',
        variant: 'default',
      })
    );
  });

  it('gère l’erreur d’enrichissement en affichant un toast destructif', async () => {
    const user = userEvent.setup();
    const { Wrapper } = createWrapper();

    INVOKE_EDGE_MOCK.mockRejectedValue(new Error('x'));

    render(
      <FillWithAIDialog
        open
        onOpenChange={ON_OPEN_CHANGE}
        entityType="etablissements"
        items={ITEMS_ETABS}
      />,
      { wrapper: Wrapper }
    );

    const actionButton = screen.getAllByRole('button').find((button) => {
      const text = button.textContent ?? '';
      return text.includes('Aperçu') || text.includes('Enrichir') || text.includes('Générer');
    });

    expect(actionButton).toBeTruthy();

    if (actionButton) {
      await user.click(actionButton);
    }

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erreur d'enrichissement",
          description: 'x',
          variant: 'destructive',
        })
      );
    });
  });

  it('couvre le scénario erreur de requête Supabase stable via renderHook avec isError', async () => {
    const { Wrapper } = createWrapper();

    BUILDER_STATE.resultQueue.push({ data: null, error: { message: 'x' } });

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['supabase-error'],
          queryFn: async () => {
            const { supabase } = await import('@/integrations/supabase/client');
            const response = await supabase.from('etablissements');
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.data;
          },
        }),
      { wrapper: Wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
  });
});