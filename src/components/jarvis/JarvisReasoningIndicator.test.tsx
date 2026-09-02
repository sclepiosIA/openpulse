import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { cnMock } = vi.hoisted(() => {
  return {
    cnMock: vi.fn((...classes: Array<string | undefined | null | false>) =>
      classes.filter(Boolean).join(' ')
    ),
  };
});

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}));

vi.mock('framer-motion', () => {
  const MotionDiv = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )
  );
  MotionDiv.displayName = 'MotionDiv';

  return {
    motion: {
      div: MotionDiv,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('lucide-react', () => {
  const Icon =
    (name: string) =>
    React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>((props, ref) => (
      <svg ref={ref} data-icon={name} {...props} />
    ));

  const Brain = Icon('Brain');
  Brain.displayName = 'Brain';
  const Search = Icon('Search');
  Search.displayName = 'Search';
  const Cog = Icon('Cog');
  Cog.displayName = 'Cog';
  const MessageSquare = Icon('MessageSquare');
  MessageSquare.displayName = 'MessageSquare';
  const CheckCircle2 = Icon('CheckCircle2');
  CheckCircle2.displayName = 'CheckCircle2';
  const Loader2 = Icon('Loader2');
  Loader2.displayName = 'Loader2';
  const GitBranch = Icon('GitBranch');
  GitBranch.displayName = 'GitBranch';
  const Database = Icon('Database');
  Database.displayName = 'Database';
  const Mail = Icon('Mail');
  Mail.displayName = 'Mail';
  const FileText = Icon('FileText');
  FileText.displayName = 'FileText';

  return {
    Brain,
    Search,
    Cog,
    MessageSquare,
    CheckCircle2,
    Loader2,
    GitBranch,
    Database,
    Mail,
    FileText,
  };
});

import JarvisReasoningIndicator, { useReasoningSteps, type ReasoningStep } from './JarvisReasoningIndicator';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('JarvisReasoningIndicator', () => {
  it('rend null quand inactif et toutes les étapes sont pending', () => {
    const steps: ReasoningStep[] = [
      { id: 's1', label: 'Étape 1', status: 'pending', icon: 'brain' },
      { id: 's2', label: 'Étape 2', status: 'pending', icon: 'search' },
    ];

    const { container } = render(
      <JarvisReasoningIndicator steps={steps} isActive={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('mode compact: affiche le label de l’étape active et son détail', async () => {
    const stepsInitial: ReasoningStep[] = [
      { id: 'a', label: 'Analyse', status: 'completed', icon: 'brain' },
      { id: 'b', label: 'Recherche', status: 'pending', icon: 'database' },
    ];

    const { rerender } = render(
      <JarvisReasoningIndicator steps={stepsInitial} isActive={true} compact={true} />
    );

    expect(screen.getByText('Analyse')).toBeInTheDocument();

    const stepsWithActive: ReasoningStep[] = [
      { id: 'a', label: 'Analyse', status: 'completed', icon: 'brain' },
      { id: 'b', label: 'Recherche', status: 'active', icon: 'database', detail: 'indexation' },
    ];

    rerender(<JarvisReasoningIndicator steps={stepsWithActive} isActive={true} compact={true} />);

    await waitFor(() => {
      expect(screen.getByText('Recherche')).toBeInTheDocument();
      expect(screen.getByText('(indexation)')).toBeInTheDocument();
    });

    expect(document.querySelectorAll('[data-icon="Loader2"]').length).toBeGreaterThan(0);
  });

  it('mode complet: affiche les étapes et les icônes selon le statut (active/completed/skipped)', () => {
    const steps: ReasoningStep[] = [
      { id: 'analyze', label: 'Analyse de la requête', status: 'completed', icon: 'brain' },
      { id: 'search', label: 'Recherche dans la base de données', status: 'active', icon: 'database', detail: 'fast' },
      { id: 'tool', label: 'Exécution: Requête base de données', status: 'skipped', icon: 'cog' },
      { id: 'resp', label: 'Formulation de la réponse', status: 'pending', icon: 'message' },
    ];

    render(<JarvisReasoningIndicator steps={steps} isActive={true} />);

    expect(screen.getByText('Raisonnement en cours...')).toBeInTheDocument();
    expect(screen.getByText('Analyse de la requête')).toBeInTheDocument();
    expect(screen.getByText('Recherche dans la base de données')).toBeInTheDocument();
    expect(screen.getByText('Formulation de la réponse')).toBeInTheDocument();

    expect(document.querySelectorAll('[data-icon="CheckCircle2"]').length).toBe(1);
    expect(document.querySelectorAll('[data-icon="Loader2"]').length).toBe(1);

    expect(screen.getByText('fast')).toBeInTheDocument();
  });
});

describe('useReasoningSteps', () => {
  it('génère les étapes attendues avec multi-intent, recherche, outils et envoi', async () => {
    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const context = {
      isMultiIntent: true,
      intentCount: 2,
      isSearching: true,
      hasToolCalls: true,
      toolNames: ['query_database', 'send_email'],
      isSending: true,
    };

    const { result } = renderHook(() => useReasoningSteps(context), { wrapper });

    await waitFor(() => {
      expect(result.current.length).toBeGreaterThan(0);
    });

    const labels = result.current.map(s => s.label);
    expect(labels[0]).toBe('Analyse de la requête');
    expect(labels).toContain('Détection de 2 intentions');
    expect(labels).toContain('Recherche dans la base de données');
    expect(labels).toContain('Exécution: Requête base de données');
    expect(labels).toContain("Exécution: Envoi d'email");
    expect(labels).toContain('Envoi du message');
    expect(labels[labels.length - 1]).toBe('Formulation de la réponse');

    const multi = result.current.find(s => s.id === 'multi-intent');
    expect(multi?.detail).toBe('multi-intent');
    expect(multi?.status).toBe('completed');
    expect(multi?.icon).toBe('branch');

    const search = result.current.find(s => s.id === 'search');
    expect(search?.status).toBe('active');
    expect(search?.icon).toBe('database');

    const toolQuery = result.current.find(s => s.id === 'tool-query_database');
    expect(toolQuery?.status).toBe('completed');
    expect(toolQuery?.icon).toBe('database');

    const toolSend = result.current.find(s => s.id === 'tool-send_email');
    expect(toolSend?.status).toBe('active');
    expect(toolSend?.icon).toBe('mail');

    const sending = result.current.find(s => s.id === 'sending');
    expect(sending?.status).toBe('active');
    expect(sending?.icon).toBe('mail');
  });

  it('met à jour les étapes quand le contexte change (active -> pending) ', async () => {
    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, rerender } = renderHook(
      ({ ctx }: { ctx: { isSearching?: boolean } }) => useReasoningSteps(ctx),
      { wrapper, initialProps: { ctx: { isSearching: true } } }
    );

    await waitFor(() => {
      expect(result.current.some(s => s.id === 'search')).toBe(true);
    });

    expect(result.current.find(s => s.id === 'search')?.status).toBe('active');

    await act(async () => {
      rerender({ ctx: { isSearching: false } });
    });

    await waitFor(() => {
      expect(result.current.some(s => s.id === 'search')).toBe(false);
      const response = result.current.find(s => s.id === 'response');
      expect(response?.status).toBe('pending');
    });
  });
});