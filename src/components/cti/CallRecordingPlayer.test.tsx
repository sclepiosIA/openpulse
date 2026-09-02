// @vitest-environment jsdom

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { CallRecordingPlayer } from './CallRecordingPlayer';

const {
  AUTH_STATE,
  SIGNED_URL,
  SECOND_SIGNED_URL,
  mockGetRecordingSignedUrl,
  mockNavigate,
  toastSuccess,
  toastError,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const SIGNED_URL = 'https://app.local/audio/file.mp3?sig=ok';
  const SECOND_SIGNED_URL = 'https://app.local/audio/file-2.mp3?sig=next';

  const mockGetRecordingSignedUrl = vi.fn();
  const mockNavigate = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();

  const result = { data: null, error: null };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    match: vi.fn(() => builder),
    or: vi.fn(() => builder),
    not: vi.fn(() => builder),
    is: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    overlaps: vi.fn(() => builder),
    textSearch: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };

  const mockFrom = vi.fn(() => builder);

  return {
    AUTH_STATE,
    SIGNED_URL,
    SECOND_SIGNED_URL,
    mockGetRecordingSignedUrl,
    mockNavigate,
    toastSuccess,
    toastError,
    mockFrom,
  };
});

vi.mock('@/hooks/voice/useCalls', () => ({
  getRecordingSignedUrl: mockGetRecordingSignedUrl,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    size,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    size?: string;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-size={size} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  Play: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="play-icon" {...props} />,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
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

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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

  return Wrapper;
}

describe('CallRecordingPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche l'absence d'enregistrement quand recordingPath est null", () => {
    render(<CallRecordingPlayer recordingPath={null} />, { wrapper: createWrapper() });

    expect(screen.getByText("Pas d'enregistrement")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /écouter/i })).not.toBeInTheDocument();
    expect(document.querySelector('audio')).toBeNull();
    expect(mockGetRecordingSignedUrl).not.toHaveBeenCalled();
  });

  it("affiche le bouton d'écoute, montre le chargement, puis rend l'audio avec l'URL signée", async () => {
    let resolveSignedUrl: ((value: string) => void) | undefined;
    mockGetRecordingSignedUrl.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveSignedUrl = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<CallRecordingPlayer recordingPath="calls/rec-1.mp3" />, { wrapper: createWrapper() });

    const button = screen.getByRole('button', { name: /écouter/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('data-size', 'sm');
    expect(button).toHaveAttribute('data-variant', 'outline');
    expect(screen.getByTestId('play-icon')).toBeInTheDocument();

    await act(async () => {
      await user.click(button);
    });

    expect(mockGetRecordingSignedUrl).toHaveBeenCalledTimes(1);
    expect(mockGetRecordingSignedUrl).toHaveBeenCalledWith('calls/rec-1.mp3', 300);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /écouter/i })).toBeDisabled();
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    await act(async () => {
      if (resolveSignedUrl) {
        resolveSignedUrl(SIGNED_URL);
      }
    });

    await waitFor(() => {
      const audio = document.querySelector('audio');
      expect(audio).not.toBeNull();
      expect(audio?.getAttribute('src')).toBe(SIGNED_URL);
      expect(audio?.getAttribute('preload')).toBe('none');
      expect(audio?.hasAttribute('controls')).toBe(true);
    });

    expect(screen.queryByRole('button', { name: /écouter/i })).not.toBeInTheDocument();
  });

  it("réinitialise le lecteur quand recordingPath change et récupère une nouvelle URL signée", async () => {
    mockGetRecordingSignedUrl.mockResolvedValueOnce(SIGNED_URL).mockResolvedValueOnce(SECOND_SIGNED_URL);

    const user = userEvent.setup();
    const { rerender } = render(<CallRecordingPlayer recordingPath="calls/first.mp3" />, {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /écouter/i }));
    });

    await waitFor(() => {
      const audio = document.querySelector('audio');
      expect(audio?.getAttribute('src')).toBe(SIGNED_URL);
    });

    rerender(<CallRecordingPlayer recordingPath="calls/second.mp3" />);

    expect(document.querySelector('audio')).toBeNull();
    expect(screen.getByRole('button', { name: /écouter/i })).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /écouter/i }));
    });

    expect(mockGetRecordingSignedUrl).toHaveBeenNthCalledWith(1, 'calls/first.mp3', 300);
    expect(mockGetRecordingSignedUrl).toHaveBeenNthCalledWith(2, 'calls/second.mp3', 300);

    await waitFor(() => {
      const audio = document.querySelector('audio');
      expect(audio?.getAttribute('src')).toBe(SECOND_SIGNED_URL);
    });
  });

  it("conserve le bouton et n'affiche pas d'audio si la récupération de l'URL signée ne renvoie rien", async () => {
    mockGetRecordingSignedUrl.mockResolvedValueOnce(null);

    const user = userEvent.setup();
    render(<CallRecordingPlayer recordingPath="calls/error.mp3" />, { wrapper: createWrapper() });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /écouter/i }));
    });

    expect(mockGetRecordingSignedUrl).toHaveBeenCalledTimes(1);
    expect(mockGetRecordingSignedUrl).toHaveBeenCalledWith('calls/error.mp3', 300);

    await waitFor(() => {
      expect(document.querySelector('audio')).toBeNull();
      expect(screen.getByRole('button', { name: /écouter/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /écouter/i })).not.toBeDisabled();
    });
  });
});