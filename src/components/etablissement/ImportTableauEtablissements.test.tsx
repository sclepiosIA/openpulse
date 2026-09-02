import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { ImportTableauEtablissements } from './ImportTableauEtablissements';

const {
  ETABS,
  toast,
  debug,
  mockFrom,
  builder,
  invalidateQueriesMock,
  setInsertImpl,
  resetMocks
} = vi.hoisted(() => {
  // Jeu fictif, aligné sur le composant. Voir l'en-tête de
  // ImportTableauEtablissements.tsx pour la raison de la neutralisation.
  const ETABS = [
    { nom: 'CH de Val-Fleuri', ville: 'Val-Fleuri', region: 'Région Nord', type: 'CH', dpi: 'Autre Lourd', statut: 'Prospect' },
    { nom: 'CHU des Trois-Rivières', ville: 'Trois-Rivières', region: 'Région Ouest', type: 'CHU', dpi: 'Autre Lourd', statut: 'Prospect' },
    { nom: 'GHT Plaine-du-Sud', ville: 'Bourg-en-Plaine', region: 'Région Sud', type: 'GHT', dpi: 'Autre Web', statut: 'Prospect' },
    { nom: 'CH de Mont-Clair', ville: 'Mont-Clair', region: 'Région Est', type: 'CH', dpi: 'Autre Web', statut: 'Prospect' },
    { nom: 'ESPIC Sainte-Colline', ville: 'Sainte-Colline', region: 'Région Centre', type: 'ESPIC', dpi: 'Inconnu', statut: 'Prospect' },
    { nom: 'Clinique du Grand-Pré', ville: 'Grand-Pré', region: 'Région Ouest', type: 'Privé', dpi: 'Inconnu', statut: 'Prospect' },
    { nom: 'CHU de Rive-Haute', ville: 'Rive-Haute', region: 'Région Nord', type: 'CHU', dpi: 'Autre Lourd', statut: 'Prospect' },
    { nom: 'CH de Longchamp', ville: 'Longchamp', region: 'Région Sud', type: 'CH', dpi: 'Autre Web', statut: 'Prospect' },
    { nom: 'GHT Vallée-Bleue', ville: 'Vallée-Bleue', region: 'Région Est', type: 'GHT', dpi: 'Inconnu', statut: 'Prospect' },
    { nom: 'ESPIC Les Quatre-Chênes', ville: 'Quatre-Chênes', region: 'Région Centre', type: 'ESPIC', dpi: 'Autre Lourd', statut: 'Prospect' },
    { nom: 'Clinique de Beauregard', ville: 'Beauregard', region: 'Région Ouest', type: 'Privé', dpi: 'Autre Web', statut: 'Prospect' },
    { nom: 'CH de Pierrefonds', ville: 'Pierrefonds', region: 'Région Nord', type: 'CH', dpi: 'Inconnu', statut: 'Prospect' }
  ] as const;

  const toast = { success: vi.fn(), error: vi.fn() };
  const debug = { error: vi.fn() };
  const invalidateQueriesMock = vi.fn();

  type InsertArgs = Record<string, unknown>;
  let insertImpl: (args: InsertArgs) => Promise<{ data: unknown; error: null | { message: string } }> = async () => ({
    data: null,
    error: null
  });

  const setInsertImpl = (fn: typeof insertImpl) => {
    insertImpl = fn;
  };

  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn((args: InsertArgs) => {
      const p = insertImpl(args);
      (builder as { then?: unknown }).then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        (p as Promise<unknown>).then(onFulfilled, onRejected);
      (builder as { catch?: unknown }).catch = (onRejected: (e: unknown) => unknown) => (p as Promise<unknown>).catch(onRejected);
      return builder;
    }),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: undefined,
    catch: undefined
  };

  const mockFrom = vi.fn(() => builder);

  const resetMocks = () => {
    toast.success.mockClear();
    toast.error.mockClear();
    debug.error.mockClear();
    invalidateQueriesMock.mockClear();
    mockFrom.mockClear();

    (builder.select as ReturnType<typeof vi.fn>).mockClear();
    (builder.eq as ReturnType<typeof vi.fn>).mockClear();
    (builder.gte as ReturnType<typeof vi.fn>).mockClear();
    (builder.lte as ReturnType<typeof vi.fn>).mockClear();
    (builder.in as ReturnType<typeof vi.fn>).mockClear();
    (builder.order as ReturnType<typeof vi.fn>).mockClear();
    (builder.limit as ReturnType<typeof vi.fn>).mockClear();
    (builder.insert as ReturnType<typeof vi.fn>).mockClear();
    (builder.update as ReturnType<typeof vi.fn>).mockClear();
    (builder.delete as ReturnType<typeof vi.fn>).mockClear();
    (builder.upsert as ReturnType<typeof vi.fn>).mockClear();
    (builder.single as ReturnType<typeof vi.fn>).mockClear();
    (builder.maybeSingle as ReturnType<typeof vi.fn>).mockClear();
    (builder as { then?: unknown }).then = undefined;
    (builder as { catch?: unknown }).catch = undefined;

    setInsertImpl(async () => ({ data: null, error: null }));
  };

  return {
    ETABS,
    toast,
    debug,
    mockFrom,
    builder,
    invalidateQueriesMock,
    setInsertImpl,
    resetMocks
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>
}));

vi.mock('lucide-react', () => ({
  Hospital: (props: Record<string, unknown>) => <svg aria-label="hospital-icon" {...props} />,
  Loader2: (props: Record<string, unknown>) => <svg aria-label="loader-icon" {...props} />
}));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/lib/debug', () => ({ debug }));
vi.mock('@/lib/supabaseBrowser', () => ({ supabase: { from: mockFrom } }));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock
    })
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  });
}

describe('ImportTableauEtablissements', () => {
  it('setup queryclient wrapper via renderHook (règle) + rendu de base', () => {
    const queryClient = createQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => ({ ok: true }), { wrapper });
    expect(result.current.ok).toBe(true);

    render(
      <QueryClientProvider client={queryClient}>
        <ImportTableauEtablissements />
      </QueryClientProvider>
    );

    expect(screen.getByText("Import des établissements du tableau")).toBeTruthy();
    expect(screen.getByText(new RegExp(`Cette action ajoutera\\s+${ETABS.length}\\s+établissements`, 'i'))).toBeTruthy();

    const firstRowLabel = `${ETABS[0].nom} (${ETABS[0].dpi})`;
    expect(screen.getByText(firstRowLabel)).toBeTruthy();
  });

  it('loading -> succès : insère toutes les lignes, toast.success et invalidation', async () => {
    resetMocks();
    const queryClient = createQueryClient();

    setInsertImpl(async () => ({ data: null, error: null }));

    render(
      <QueryClientProvider client={queryClient}>
        <ImportTableauEtablissements />
      </QueryClientProvider>
    );

    const buttonIdle = screen.getByRole('button', { name: new RegExp(`Importer les\\s+${ETABS.length}\\s+établissements`, 'i') });

    await act(async () => {
      fireEvent.click(buttonIdle);
    });

    await waitFor(() => {
      const btn = screen.getByRole('button');
      expect(btn).toHaveProperty('disabled', false);
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect((builder.insert as ReturnType<typeof vi.fn>).mock.calls.length).toBe(ETABS.length);

    const firstInsertArg = (builder.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(firstInsertArg).toBeTruthy();
    expect(firstInsertArg?.nom).toBe(ETABS[0].nom);
    expect(firstInsertArg?.ville).toBe(ETABS[0].ville);
    expect(firstInsertArg?.region).toBe(ETABS[0].region);
    expect(firstInsertArg?.statut).toBe('Prospect');
    expect(firstInsertArg?.dpi).toBe(ETABS[0].dpi);

    const date = firstInsertArg?.date_prise_contact;
    expect(typeof date).toBe('string');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(`${ETABS.length} établissements importés avec succès`);
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['etablissements'] });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("succès partiel + erreur(s) par ligne : toast.success + toast.error + debug.error", async () => {
    resetMocks();
    const queryClient = createQueryClient();

    let callIndex = 0;
    setInsertImpl(async () => {
      callIndex += 1;
      if (callIndex === 2) return { data: null, error: { message: 'x' } };
      return { data: null, error: null };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ImportTableauEtablissements />
      </QueryClientProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Importer les\\s+${ETABS.length}\\s+établissements`, 'i') }));
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(`${ETABS.length - 1} établissements importés avec succès`);
    });

    expect(toast.error).toHaveBeenCalledWith(`1 erreur(s) lors de l'import`);
    expect(debug.error).toHaveBeenCalled();

    const debugArgs = (debug.error as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === "Erreurs d'import:");
    expect(debugArgs).toBeTruthy();
    const errorsArray = debugArgs?.[1] as unknown;
    expect(Array.isArray(errorsArray)).toBe(true);
    expect((errorsArray as string[])[0]).toContain(`${ETABS[1].nom}: x`);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['etablissements'] });
  });

  it("exception globale pendant l'import : toast.error générique, pas de succès, pas d'invalidation", async () => {
    resetMocks();
    const queryClient = createQueryClient();

    setInsertImpl(async () => {
      throw new Error('boom');
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ImportTableauEtablissements />
      </QueryClientProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Importer les\\s+${ETABS.length}\\s+établissements`, 'i') }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Erreur lors de l'import");
    });

    const importErrorCall = (debug.error as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === 'Import error:');
    expect(importErrorCall).toBeTruthy();

    expect(toast.success).not.toHaveBeenCalled();
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });
});