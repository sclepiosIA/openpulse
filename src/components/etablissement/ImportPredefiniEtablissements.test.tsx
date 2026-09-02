/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportPredefiniEtablissements } from './ImportPredefiniEtablissements';

const {
  stableInsertSuccessResult,
  stableInsertErrorResult,
  stableThrownError,
  mockInsert,
  mockFrom,
  mockInvalidateQueries,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
  mockDebugError,
} = vi.hoisted(() => {
  const stableInsertSuccessResult = { data: [{ id: 'ok-1' }], error: null };
  const stableInsertErrorResult = { data: null, error: { message: 'x' } };
  const stableThrownError = new Error('boom');

  return {
    stableInsertSuccessResult,
    stableInsertErrorResult,
    stableThrownError,
    mockInsert: vi.fn(),
    mockFrom: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockSanitizeSupabaseError: vi.fn(),
    mockDebugError: vi.fn(),
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void | Promise<void>;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  Hospital: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="hospital-icon" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('ImportPredefiniEtablissements', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSanitizeSupabaseError.mockReturnValue('Erreur nettoyée');

    mockInsert.mockResolvedValue(stableInsertSuccessResult);

    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      insert: mockInsert,
      single: vi.fn(() => Promise.resolve(stableInsertSuccessResult)),
      maybeSingle: vi.fn(() => Promise.resolve(stableInsertSuccessResult)),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(stableInsertSuccessResult).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(stableInsertSuccessResult).catch(onRejected),
    };

    mockFrom.mockReturnValue(builder);
  });

  const renderComponent = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <ImportPredefiniEtablissements />
      </QueryClientProvider>,
    );
  };

  it('affiche le contenu initial avec le nombre réel de 20 établissements', () => {
    renderComponent();

    expect(screen.getByText("Import d'établissements prédéfinis")).toBeInTheDocument();
    expect(
      screen.getByText(/Cette action ajoutera 20 établissements CHU français en tant que prospects/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Importer les 20 établissements/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('CHU Martinique - Site de Fort-de-France')).toBeInTheDocument();
    expect(screen.getByText('CHU de Nouvelle-Calédonie')).toBeInTheDocument();
  });

  it('passe par l’état de chargement puis importe avec succès et invalide la query', async () => {
    let resolveInsert: ((value: typeof stableInsertSuccessResult) => void) | undefined;
    mockInsert.mockImplementation(
      () =>
        new Promise<typeof stableInsertSuccessResult>((resolve) => {
          resolveInsert = resolve;
        }),
    );

    renderComponent();
    const user = userEvent.setup();

    const button = screen.getByRole('button', { name: /Importer les 20 établissements/i });
    await user.click(button);

    expect(screen.getByRole('button', { name: /Import en cours/i })).toBeDisabled();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(mockFrom).toHaveBeenCalledWith('etablissements');

    const insertedPayload = mockInsert.mock.calls[0]?.[0];
    expect(Array.isArray(insertedPayload)).toBe(true);
    expect(insertedPayload).toHaveLength(20);
    expect(insertedPayload[0]).toMatchObject({
      nom: 'CHU Martinique - Site de Fort-de-France',
      ville: 'Fort-de-France',
      region: 'Martinique',
      type: 'CHU',
      statut: 'Prospect',
    });
    expect(insertedPayload[19]).toMatchObject({
      nom: 'CHU de Nouvelle-Calédonie',
      ville: 'Nouméa',
      region: 'Nouvelle-Calédonie',
      type: 'CHU',
      statut: 'Prospect',
    });
    expect(typeof insertedPayload[0].date_prise_contact).toBe('string');
    expect(insertedPayload[0].date_prise_contact).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    if (resolveInsert) {
      resolveInsert(stableInsertSuccessResult);
    }

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('20 établissements importés avec succès');
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['etablissements'] });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Importer les 20 établissements/i })).toBeEnabled();
  });

  it("affiche l'erreur sanitizée quand Supabase renvoie un error", async () => {
    mockInsert.mockResolvedValue(stableInsertErrorResult);

    renderComponent();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Importer les 20 établissements/i }));

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(stableInsertErrorResult.error);
    });

    expect(mockToastError).toHaveBeenCalledWith('Erreur nettoyée');
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Importer les 20 établissements/i })).toBeEnabled();
  });

  it("affiche une erreur générique et loggue via debug si l'import lève une exception", async () => {
    mockInsert.mockRejectedValue(stableThrownError);

    renderComponent();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Importer les 20 établissements/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'import");
    });

    expect(mockDebugError).toHaveBeenCalledWith('Import error:', stableThrownError);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});