/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CleanupSuggestionsButton } from './CleanupSuggestionsButton';

const {
  mockInvokeEdge,
  mockToast,
  mockSanitizeSupabaseError,
  mockDebugError,
} = vi.hoisted(() => ({
  mockInvokeEdge: vi.fn(),
  mockToast: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
  mockDebugError: vi.fn(),
}));

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: mockInvokeEdge,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

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
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Trash2: ({ className }: { className?: string }) => <svg data-testid="trash-icon" className={className} />,
  Loader2: ({ className }: { className?: string }) => <svg data-testid="loader-icon" className={className} />,
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('CleanupSuggestionsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le bouton avec son état initial et l’icône poubelle', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    render(<CleanupSuggestionsButton />, { wrapper: createWrapper(queryClient) });

    const button = screen.getByRole('button', { name: /nettoyer suggestions invalides/i });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('data-variant', 'outline');
    expect(button).toHaveAttribute('data-size', 'sm');
    expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument();
  });

  it('déclenche le nettoyage, affiche le succès réel et invalide les 2 requêtes attendues', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockInvokeEdge.mockResolvedValue({ message: '12 suggestions supprimées' });

    const user = userEvent.setup();
    render(<CleanupSuggestionsButton />, { wrapper: createWrapper(queryClient) });

    const button = screen.getByRole('button', { name: /nettoyer suggestions invalides/i });

    await user.click(button);

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith('cleanup-all-suggestions');
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Nettoyage terminé',
        description: '12 suggestions supprimées',
      });
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['email-suggestions-pending'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['etablissement-email-suggestions'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument();
  });

  it('affiche un état de chargement pendant l’appel puis revient à l’état normal', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    let resolveCall: ((value: { message?: string }) => void) | undefined;
    mockInvokeEdge.mockImplementation(
      () =>
        new Promise<{ message?: string }>((resolve) => {
          resolveCall = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<CleanupSuggestionsButton />, { wrapper: createWrapper(queryClient) });

    const button = screen.getByRole('button', { name: /nettoyer suggestions invalides/i });

    const clickPromise = user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    if (resolveCall) {
      resolveCall({ message: 'Terminé' });
    }

    await clickPromise;

    await waitFor(() => {
      expect(button).toBeEnabled();
      expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
    });
  });

  it('gère une erreur, journalise, sanitize le message et affiche un toast destructif', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const edgeError = { data: null, error: { message: 'x' } };
    mockInvokeEdge.mockRejectedValue(edgeError);
    mockSanitizeSupabaseError.mockReturnValue('Message utilisateur propre');

    const user = userEvent.setup();
    render(<CleanupSuggestionsButton />, { wrapper: createWrapper(queryClient) });

    const button = screen.getByRole('button', { name: /nettoyer suggestions invalides/i });

    await user.click(button);

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledWith('Erreur lors du nettoyage:', edgeError);
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(edgeError);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'Message utilisateur propre',
        variant: 'destructive',
      });
    });

    await waitFor(() => {
      expect(button).toBeEnabled();
    });
  });

  it('utilise le message de secours quand la edge function ne renvoie pas de message', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    mockInvokeEdge.mockResolvedValue({});

    const user = userEvent.setup();
    render(<CleanupSuggestionsButton />, { wrapper: createWrapper(queryClient) });

    await user.click(screen.getByRole('button', { name: /nettoyer suggestions invalides/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Nettoyage terminé',
        description: 'Les suggestions invalides ont été supprimées',
      });
    });
  });
});