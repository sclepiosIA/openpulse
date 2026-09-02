// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { RegenerateDetailedSummariesButton } from './RegenerateDetailedSummariesButton';

const {
  THREADS_SUCCESS,
  THREADS_EMPTY,
  QUERY_ERROR,
  INVOKE_ERROR,
  mockFrom,
  mockInvoke,
  mockDebugError,
  mockToastSuccess,
  mockToastError,
  mockToastInfo,
  mockSanitizeSupabaseError,
} = vi.hoisted(() => ({
  THREADS_SUCCESS: [{ id: 'thread-1' }, { id: 'thread-2' }, { id: 'thread-3' }],
  THREADS_EMPTY: [],
  QUERY_ERROR: { message: 'threads query failed' },
  INVOKE_ERROR: { message: 'invoke failed' },
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
  mockDebugError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    info: mockToastInfo,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    className?: string;
    variant?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div role="progressbar" aria-valuenow={value ?? 0} className={className}>
      {value ?? 0}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Sparkles: ({ className }: { className?: string }) => <svg data-testid="sparkles-icon" className={className} />,
  Loader2: ({ className }: { className?: string }) => <svg data-testid="loader-icon" className={className} />,
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

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

function renderWithProviders(ui: React.ReactElement) {
  const Wrapper = createWrapper();
  return render(ui, { wrapper: Wrapper });
}

function createBuilder(response: { data: unknown; error: unknown }) {
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
    not: vi.fn(() => builder),
    is: vi.fn(() => builder),
    or: vi.fn(() => builder),
    match: vi.fn(() => builder),
    single: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
    then: (
      onFulfilled?: ((value: typeof response) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve(response).then(onFulfilled ?? undefined, onRejected ?? undefined),
    catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(response).catch(onRejected ?? undefined),
    finally: (onFinally?: (() => void) | null) => Promise.resolve(response).finally(onFinally ?? undefined),
  };
  return builder;
}

describe('RegenerateDetailedSummariesButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSanitizeSupabaseError.mockReturnValue('message nettoyé');
  });

  it('monte dans un wrapper QueryClientProvider compatible renderHook', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => React.useState('ok'), { wrapper });
    expect(result.current[0]).toBe('ok');
  });

  it('traite les threads manquants, appelle les services Supabase et affiche le récapitulatif final', async () => {
    const builder = createBuilder({ data: THREADS_SUCCESS, error: null });
    mockFrom.mockReturnValue(builder);
    mockInvoke
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: INVOKE_ERROR })
      .mockResolvedValueOnce({ error: null });

    renderWithProviders(<RegenerateDetailedSummariesButton />);

    expect(screen.getByText('Régénérer les résumés détaillés')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Régénérer les résumés IA pour inclure un résumé détaillé des threads existants',
      ),
    ).toBeInTheDocument();

    const initialButton = screen.getByRole('button', { name: /Régénérer les résumés manquants/i });
    expect(initialButton).toBeEnabled();

    await userEvent.click(initialButton);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('email_threads');
      expect(builder.select).toHaveBeenCalledWith('id');
      expect(builder.not).toHaveBeenCalledWith('ai_last_processed_at', 'is', null);
      expect(builder.is).toHaveBeenCalledWith('ai_detailed_summary', null);
      expect(builder.limit).toHaveBeenCalledWith(100);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(3);
      expect(mockInvoke).toHaveBeenNthCalledWith(1, 'process-email-with-ai', {
        body: { thread_id: 'thread-1' },
      });
      expect(mockInvoke).toHaveBeenNthCalledWith(2, 'process-email-with-ai', {
        body: { thread_id: 'thread-2' },
      });
      expect(mockInvoke).toHaveBeenNthCalledWith(3, 'process-email-with-ai', {
        body: { thread_id: 'thread-3' },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Dernière régénération :')).toBeInTheDocument();
    });

    const summaryBlock = screen.getByText('Dernière régénération :').closest('div');
    expect(summaryBlock).not.toBeNull();

    const scoped = within(summaryBlock as HTMLElement);
    expect(scoped.getByText('Threads traités :')).toBeInTheDocument();
    expect(scoped.getByText('Erreurs :')).toBeInTheDocument();
    expect(scoped.getByText('3')).toBeInTheDocument();
    expect(scoped.getByText('1')).toBeInTheDocument();

    expect(mockDebugError).toHaveBeenCalledWith('Error processing thread thread-2:', INVOKE_ERROR);
    expect(mockToastSuccess).toHaveBeenCalledWith('Régénération terminée : 2 résumés mis à jour sur 3 threads');
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalled();

    expect(screen.getByRole('button', { name: /Régénérer les résumés manquants/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Régénération en cours/i })).not.toBeInTheDocument();
  });

  it('affiche un toast informatif quand aucun thread ne nécessite de régénération', async () => {
    const builder = createBuilder({ data: THREADS_EMPTY, error: null });
    mockFrom.mockReturnValue(builder);

    renderWithProviders(<RegenerateDetailedSummariesButton />);

    await userEvent.click(screen.getByRole('button', { name: /Régénérer les résumés manquants/i }));

    await waitFor(() => {
      expect(mockToastInfo).toHaveBeenCalledWith('Tous les threads ont déjà un résumé détaillé');
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(screen.queryByText('Dernière régénération :')).not.toBeInTheDocument();
  });

  it('gère une erreur de récupération et affiche le message sanitizé', async () => {
    const builder = createBuilder({ data: null, error: QUERY_ERROR });
    mockFrom.mockReturnValue(builder);
    mockSanitizeSupabaseError.mockReturnValue('erreur lisible');

    renderWithProviders(<RegenerateDetailedSummariesButton />);

    await userEvent.click(screen.getByRole('button', { name: /Régénérer les résumés manquants/i }));

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledWith('Error during regeneration:', QUERY_ERROR);
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(QUERY_ERROR);
      expect(mockToastError).toHaveBeenCalledWith('Erreur : erreur lisible');
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalled();
    expect(screen.queryByText('Dernière régénération :')).not.toBeInTheDocument();
  });
});