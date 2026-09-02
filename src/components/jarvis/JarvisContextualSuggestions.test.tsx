import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  baseSuggestions,
  mockOnExecute,
  mockUseJarvisContextualSuggestions,
  mockFrom,
  mockUseAuthContext,
  mockUseAuthHook,
  mockUseAdminRole,
  mockToastSuccess,
  mockToastError,
  mockNavigate,
} = vi.hoisted(() => {
  const baseSuggestions = [
    {
      id: 's1',
      icon: 'summary' as const,
      category: 'analyze' as const,
      label: 'Générer un résumé',
      command: 'Résumer cette page',
    },
    {
      id: 's2',
      icon: 'email' as const,
      category: 'action' as const,
      label: 'Préparer un email',
      command: 'Rédiger un email pour ce client',
    },
    {
      id: 's3',
      icon: 'task' as const,
      category: 'action' as const,
      label: 'Créer une tâche',
      command: 'Ajouter une tâche liée à cet élément',
    },
    {
      id: 's4',
      icon: 'chart' as const,
      category: 'analyze' as const,
      label: 'Analyser les performances',
      command: 'Montrer les KPI associés',
    },
    {
      id: 's5',
      icon: 'search' as const,
      category: 'navigate' as const,
      label: 'Explorer les éléments similaires',
      command: 'Trouver des éléments similaires',
    },
    {
      id: 's6',
      icon: 'edit' as const,
      category: 'create' as const,
      label: 'Proposer une mise à jour',
      command: 'Suggérer des modifications de contenu',
    },
  ];

  const mockOnExecute = vi.fn();

  const mockUseJarvisContextualSuggestions = vi.fn(() => ({
    suggestions: baseSuggestions,
    pageType: 'record',
    module: 'crm',
    entityName: 'Client très important',
    isLoading: false,
  }));

  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      const promise = Promise.resolve({ data: null, error: null });
      return promise.then(onFulfilled, onRejected);
    },
    catch(onRejected: (reason: unknown) => unknown) {
      const promise = Promise.resolve({ data: null, error: null });
      return promise.catch(onRejected);
    },
  };

  const mockFrom = vi.fn(() => builder);

  const mockUseAuthContext = vi.fn(() => ({
    user: { id: 'u1', email: 'user@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }));

  const mockUseAuthHook = vi.fn(() => ({
    user: { id: 'u1', email: 'user@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }));

  const mockUseAdminRole = vi.fn(() => true);

  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();

  const mockNavigate = vi.fn();

  return {
    baseSuggestions,
    mockOnExecute,
    mockUseJarvisContextualSuggestions,
    mockFrom,
    mockUseAuthContext,
    mockUseAuthHook,
    mockUseAdminRole,
    mockToastSuccess,
    mockToastError,
    mockNavigate,
  };
});

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...rest }: { children: React.ReactNode }) => <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    FileText: Icon,
    Mail: Icon,
    CheckSquare: Icon,
    BarChart2: Icon,
    AlertTriangle: Icon,
    Calendar: Icon,
    Search: Icon,
    Edit: Icon,
    ChevronRight: Icon,
    Sparkles: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...rest}>{children}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...rest }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...rest}>{children}</span>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/hooks/jarvis/useJarvisContextualSuggestions', () => ({
  useJarvisContextualSuggestions: () => mockUseJarvisContextualSuggestions(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => {
  const MockAuthProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return { AuthProvider: MockAuthProvider };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuthContext(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuthHook(),
}));

vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: () => mockUseAdminRole(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import { JarvisContextualSuggestions } from './JarvisContextualSuggestions';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('JarvisContextualSuggestions', () => {
  it('affiche le loader pendant le chargement', () => {
    mockUseJarvisContextualSuggestions.mockReturnValueOnce({
      suggestions: [],
      pageType: 'record',
      module: 'crm',
      entityName: 'Client A',
      isLoading: true,
    });

    renderWithClient(
      <JarvisContextualSuggestions onExecute={mockOnExecute} />
    );

    expect(screen.getByText('Analyse du contexte...')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('affiche les suggestions et le badge avec le nom de l’entité tronqué', () => {
    const longName = 'Entité avec un nom vraiment très long pour le test';
    mockUseJarvisContextualSuggestions.mockReturnValueOnce({
      suggestions: baseSuggestions,
      pageType: 'record',
      module: 'crm',
      entityName: longName,
      isLoading: false,
    });

    renderWithClient(
      <JarvisContextualSuggestions onExecute={mockOnExecute} maxVisible={3} />
    );

    expect(screen.getByText('Suggestions contextuelles')).toBeInTheDocument();

    const truncated = longName.substring(0, 20) + '...';
    expect(screen.getByText(truncated)).toBeInTheDocument();

    expect(screen.getByText('Générer un résumé')).toBeInTheDocument();
    expect(screen.getByText('Préparer un email')).toBeInTheDocument();
    expect(screen.getByText('Créer une tâche')).toBeInTheDocument();

    expect(screen.queryByText('Analyser les performances')).not.toBeInTheDocument();

    expect(screen.getByText('+3 autres suggestions')).toBeInTheDocument();
  });

  it('n’affiche pas le message "plus de suggestions" si le nombre est inférieur ou égal à maxVisible', () => {
    mockUseJarvisContextualSuggestions.mockReturnValueOnce({
      suggestions: baseSuggestions.slice(0, 3),
      pageType: 'record',
      module: 'crm',
      entityName: 'Client B',
      isLoading: false,
    });

    renderWithClient(
      <JarvisContextualSuggestions onExecute={mockOnExecute} maxVisible={5} />
    );

    expect(screen.queryByText(/\+[\d]+ autres suggestions/)).not.toBeInTheDocument();
  });

  it('appelle onExecute avec la commande correcte lors du clic sur une suggestion', () => {
    mockUseJarvisContextualSuggestions.mockReturnValueOnce({
      suggestions: baseSuggestions,
      pageType: 'record',
      module: 'crm',
      entityName: 'Client C',
      isLoading: false,
    });

    renderWithClient(
      <JarvisContextualSuggestions onExecute={mockOnExecute} />
    );

    const button = screen.getByText('Préparer un email');
    fireEvent.click(button);

    expect(mockOnExecute).toHaveBeenCalledTimes(1);
    expect(mockOnExecute).toHaveBeenCalledWith('Rédiger un email pour ce client');
  });

  it('désactive les boutons quand isDisabled est à true', () => {
    mockUseJarvisContextualSuggestions.mockReturnValueOnce({
      suggestions: baseSuggestions.slice(0, 2),
      pageType: 'record',
      module: 'crm',
      entityName: 'Client D',
      isLoading: false,
    });

    renderWithClient(
      <JarvisContextualSuggestions onExecute={mockOnExecute} isDisabled />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});