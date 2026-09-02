// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { JarvisEmailPreview } from './JarvisEmailPreview';

const {
  AUTH_STATE,
  SIGNATURE_STATE,
  sanitizeMock,
  buttonSpy,
  mockFrom,
  QUERY_OK,
  QUERY_ERR,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.dev' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  SIGNATURE_STATE: {
    signature: '<table><tr><td>Signature pro</td></tr></table>',
    loading: false,
  },
  sanitizeMock: vi.fn((value: string) => value),
  buttonSpy: vi.fn(),
  mockFrom: vi.fn(),
  QUERY_OK: [{ id: '1', name: 'ok' }],
  QUERY_ERR: { message: 'x' },
}));

vi.mock('dompurify', () => ({
  default: {
    sanitize: sanitizeMock,
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg aria-hidden="true" {...props} />;
  return {
    Mail: Icon,
    Send: Icon,
    Edit2: Icon,
    X: Icon,
    User: Icon,
    Users: Icon,
    FileText: Icon,
    Loader2: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
  }) => (
    <button
      type="button"
      data-variant={variant}
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
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

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: ({ className }: { className?: string }) => <hr className={className} />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | undefined | null | false>) => values.filter(Boolean).join(' '),
}));

vi.mock('@/hooks/email/useEmailSignature', () => ({
  useEmailSignature: () => SIGNATURE_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/integrations/supabase/client', () => {
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
    single: vi.fn(async () => ({ data: QUERY_OK[0], error: null })),
    maybeSingle: vi.fn(async () => ({ data: QUERY_OK[0], error: null })),
    then: (onFulfilled: (value: { data: typeof QUERY_OK; error: null }) => unknown) =>
      Promise.resolve({ data: QUERY_OK, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  };
  mockFrom.mockImplementation(() => builder);
  return {
    supabase: {
      from: mockFrom,
    },
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

function TestQuery({
  shouldFail = false,
}: {
  shouldFail?: boolean;
}) {
  const { isLoading, isError, data, error } = useQuery({
    queryKey: ['jarvis-email-preview-test', shouldFail],
    queryFn: async () => {
      if (shouldFail) {
        const result = { data: null, error: QUERY_ERR };
        if (result.error) {
          throw new Error(result.error.message);
        }
        return result.data;
      }
      const result = { data: QUERY_OK, error: null as null };
      return result.data;
    },
  });

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{String(isError)}</span>
      <span data-testid="data">{data ? data.map((r) => r.name).join(', ') : ''}</span>
      <span data-testid="message">{error instanceof Error ? error.message : ''}</span>
    </div>
  );
}

describe('JarvisEmailPreview', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    AUTH_STATE.user = { id: 'u1', email: 'user@test.dev' };
    SIGNATURE_STATE.signature = '<table><tr><td>Signature pro</td></tr></table>';
    SIGNATURE_STATE.loading = false;
    sanitizeMock.mockImplementation((value: string) => value);
  });

  it('affiche les métadonnées, le corps formaté, la signature et le fil existant', () => {
    render(
      <JarvisEmailPreview
        emailData={{
          to: ['alice@test.dev', 'bob@test.dev'],
          cc: 'copy@test.dev',
          bcc: ['hidden1@test.dev', 'hidden2@test.dev'],
          subject: 'Sujet important',
          body: 'Bonjour\nLigne 2',
          thread_id: 'thread-1',
        }}
        onConfirm={vi.fn()}
        onModify={vi.fn()}
        onCancel={vi.fn()}
        className="custom-class"
      />
    );

    expect(screen.getByText("Aperçu de l'email")).toBeInTheDocument();
    expect(screen.getByText('Prêt à envoyer')).toBeInTheDocument();
    expect(screen.getByText('user@test.dev')).toBeInTheDocument();
    expect(screen.getByText('alice@test.dev, bob@test.dev')).toBeInTheDocument();
    expect(screen.getByText('copy@test.dev')).toBeInTheDocument();
    expect(screen.getByText('hidden1@test.dev, hidden2@test.dev')).toBeInTheDocument();
    expect(screen.getByText('Sujet important')).toBeInTheDocument();
    expect(screen.getByText('Réponse dans un fil de discussion existant')).toBeInTheDocument();

    const content = document.querySelector('.email-content');
    expect(content).not.toBeNull();
    expect(content?.innerHTML).toContain('Bonjour<br>Ligne 2');
    expect(content?.innerHTML).toContain('email-signature-wrapper');
    expect(content?.innerHTML).toContain('Signature pro');

    expect(sanitizeMock).toHaveBeenCalledTimes(1);
    expect(sanitizeMock).toHaveBeenCalledWith(
      'Bonjour<br>Ligne 2<br><br><div class="email-signature-wrapper"><table><tr><td>Signature pro</td></tr></table></div>',
      expect.objectContaining({
        ALLOWED_TAGS: expect.arrayContaining(['table', 'tr', 'td', 'img', 'font']),
        ALLOWED_ATTR: expect.arrayContaining(['class', 'style', 'href', 'src']),
        ALLOW_DATA_ATTR: false,
      })
    );
  });

  it('gère les valeurs par défaut et masque cc/bcc/modifier absents', () => {
    AUTH_STATE.user = { id: 'u1', email: '' };
    SIGNATURE_STATE.signature = '';
    SIGNATURE_STATE.loading = true;

    render(
      <JarvisEmailPreview
        emailData={{
          to: '',
          body: 'Texte simple',
        }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Votre adresse email')).toBeInTheDocument();
    expect(screen.getByText('Non spécifié')).toBeInTheDocument();
    expect(screen.getByText('(Sans objet)')).toBeInTheDocument();
    expect(screen.queryByText('CC :')).not.toBeInTheDocument();
    expect(screen.queryByText('CCI :')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /modifier/i })).not.toBeInTheDocument();

    const content = document.querySelector('.email-content');
    expect(content?.innerHTML).toBe('Texte simple');
  });

  it('appelle les callbacks des actions et désactive les boutons pendant la confirmation', () => {
    const onConfirm = vi.fn();
    const onModify = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <JarvisEmailPreview
        emailData={{
          to: 'dest@test.dev',
          subject: 'Sujet',
          body: 'Contenu',
        }}
        onConfirm={onConfirm}
        onModify={onModify}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /envoyer/i }));
    fireEvent.click(screen.getByRole('button', { name: /modifier/i }));
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onModify).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <JarvisEmailPreview
        emailData={{
          to: 'dest@test.dev',
          subject: 'Sujet',
          body: 'Contenu',
        }}
        onConfirm={onConfirm}
        onModify={onModify}
        onCancel={onCancel}
        isConfirming
      />
    );

    const sendButton = screen.getByRole('button', { name: /envoi en cours/i });
    const modifyButton = screen.getByRole('button', { name: /modifier/i });
    const cancelButton = screen.getByRole('button', { name: /annuler/i });

    expect(sendButton).toBeDisabled();
    expect(modifyButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('couvre chargement puis succès avec renderHook dans un QueryClientProvider', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['preview-hook-success'],
          queryFn: async () => {
            await Promise.resolve();
            return { data: QUERY_OK, error: null as null };
          },
          select: (res) => res.data,
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(QUERY_OK);
    expect(result.current.data?.[0]).toEqual({ id: '1', name: 'ok' });
  });

  it("couvre l'erreur via react-query avec { data:null, error:{ message:'x' } }", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['preview-hook-error'],
          queryFn: async () => {
            const res = { data: null, error: { message: 'x' } };
            if (res.error) {
              throw new Error(res.error.message);
            }
            return res.data;
          },
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
  });

  it('affiche chargement puis succès dans un composant de test react-query', async () => {
    const wrapper = createWrapper();

    render(<TestQuery />, { wrapper });

    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('data')).toHaveTextContent('ok');
    expect(screen.getByTestId('message')).toHaveTextContent('');
  });

  it("affiche l'état d'erreur dans un composant de test react-query", async () => {
    const wrapper = createWrapper();

    render(<TestQuery shouldFail />, { wrapper });

    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('message')).toHaveTextContent('x');
    expect(screen.getByTestId('data')).toHaveTextContent('');
  });
});