/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AISearchOverview } from './AISearchOverview';

const {
  EDGE_SUCCESS_RESULT,
  navigateMock,
  onCloseMock,
  invokeEdgeMock,
} = vi.hoisted(() => ({
  EDGE_SUCCESS_RESULT: {
    overview: 'Résumé **important** [1] puis autre source [2].',
    query: 'acme',
    sources: [
      {
        index: 1,
        type: 'email',
        id: 'mail-1',
        title: 'Email de suivi',
        href: '/emails/mail-1',
        etablissement: 'Clinique Acme',
      },
      {
        index: 2,
        type: 'etablissement',
        id: 'eta-2',
        title: 'Fiche établissement',
        href: '/etablissements/eta-2',
      },
    ],
  },
  navigateMock: vi.fn(),
  onCloseMock: vi.fn(),
  invokeEdgeMock: vi.fn(),
}));

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: invokeEdgeMock,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
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

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Loader2: Icon,
    Sparkles: Icon,
    Building2: Icon,
    Mail: Icon,
    CheckSquare: Icon,
    Users: Icon,
    Calendar: Icon,
    ExternalLink: Icon,
    Search: Icon,
    AlertCircle: Icon,
  };
});

vi.mock('react-markdown', () => ({
  default: ({
    children,
    components,
  }: {
    children: string;
    components?: {
      p?: ({ children }: { children: React.ReactNode }) => React.ReactElement;
      strong?: ({ children }: { children: React.ReactNode }) => React.ReactElement;
    };
  }) => {
    const text = String(children);
    const strongMatch = text.match(/\*\*(.*?)\*\*/);
    if (strongMatch && components?.strong) {
      return (
        <span>
          {components.strong({ children: strongMatch[1] })}
        </span>
      );
    }
    if (components?.p) {
      return components.p({ children: text });
    }
    return <span>{text}</span>;
  },
}));

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

describe('AISearchOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche l’état vide si la query est trop courte et ne lance pas la recherche', () => {
    render(<AISearchOverview query="ab" onClose={onCloseMock} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Tapez votre recherche')).toBeInTheDocument();
    expect(screen.getByText(/L'IA analysera vos emails/i)).toBeInTheDocument();
    expect(invokeEdgeMock).not.toHaveBeenCalled();
  });

  it('affiche le chargement puis le succès avec les sources et permet de naviguer', async () => {
    let resolvePromise: ((value: typeof EDGE_SUCCESS_RESULT) => void) | undefined;
    invokeEdgeMock.mockImplementation(
      () =>
        new Promise<typeof EDGE_SUCCESS_RESULT>((resolve) => {
          resolvePromise = resolve;
        }),
    );

    render(<AISearchOverview query="acme" onClose={onCloseMock} />, {
      wrapper: createWrapper(),
    });

    expect(await screen.findByText('Analyse en cours…')).toBeInTheDocument();
    expect(invokeEdgeMock).toHaveBeenCalledWith('ai-search-overview', { query: 'acme' });

    if (resolvePromise) {
      resolvePromise(EDGE_SUCCESS_RESULT);
    }

    await screen.findByText('Synthèse IA');
    expect(screen.getByText('Email de suivi')).toBeInTheDocument();
    expect(screen.getByText('Fiche établissement')).toBeInTheDocument();
    expect(screen.getByText('Clinique Acme')).toBeInTheDocument();
    expect(screen.getByText('Sources (2)')).toBeInTheDocument();
    expect(screen.getByText('important')).toBeInTheDocument();

    const citationButton = screen.getAllByRole('button', { name: '1' })[0];
    fireEvent.click(citationButton);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/emails/mail-1');

    const sourceButton = screen.getByRole('button', { name: /Fiche établissement/i });
    fireEvent.click(sourceButton);

    expect(onCloseMock).toHaveBeenCalledTimes(2);
    expect(navigateMock).toHaveBeenCalledWith('/etablissements/eta-2');
  });

  it('affiche une erreur puis permet de réessayer avec la même query', async () => {
    invokeEdgeMock.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(EDGE_SUCCESS_RESULT);

    render(<AISearchOverview query="acme" onClose={onCloseMock} />, {
      wrapper: createWrapper(),
    });

    expect(await screen.findByText('Erreur')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => {
      expect(invokeEdgeMock).toHaveBeenCalledTimes(2);
    });

    expect(invokeEdgeMock).toHaveBeenNthCalledWith(1, 'ai-search-overview', { query: 'acme' });
    expect(invokeEdgeMock).toHaveBeenNthCalledWith(2, 'ai-search-overview', { query: 'acme' });

    expect(await screen.findByText('Email de suivi')).toBeInTheDocument();
  });
});