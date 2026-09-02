/// <reference types="vitest" />
/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const hoisted = vi.hoisted(() => {
  const useJarvisBackgroundJobs = vi.fn();
  const useJarvisActionContext = vi.fn();

  const cancelJob = vi.fn();
  const resumeAction = vi.fn();
  const cancelContext = vi.fn();
  const getContextSummary = vi.fn((ctx: { id: string }) => `Résumé ${ctx.id}`);

  const ACTIVE_JOBS = [
    { id: 'job-1', action_type: 'Indexation', progress: 42, status: 'processing' as const },
    { id: 'job-2', action_type: 'Analyse', progress: 10, status: 'paused' as const },
  ];

  const PENDING_CONTEXTS = [
    { id: 'ctx-1', created_at: '2025-01-01T10:15:00.000Z' },
    { id: 'ctx-2', created_at: '2025-01-01T10:20:00.000Z' },
  ];

  return {
    useJarvisBackgroundJobs,
    useJarvisActionContext,
    cancelJob,
    resumeAction,
    cancelContext,
    getContextSummary,
    ACTIVE_JOBS,
    PENDING_CONTEXTS,
  };
});

vi.mock('@/hooks/jarvis/useJarvisBackgroundJobs', () => ({
  useJarvisBackgroundJobs: hoisted.useJarvisBackgroundJobs,
}));

vi.mock('@/hooks/jarvis/useJarvisActionContext', () => ({
  useJarvisActionContext: hoisted.useJarvisActionContext,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    'aria-label': ariaLabel,
    variant,
    size,
  }: {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div role="progressbar" aria-valuenow={value ?? 0} className={className} />
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/assets/jarvis-logo.png', () => ({
  default: 'jarvis-logo-mock',
}));

vi.mock('framer-motion', () => {
  const ReactLocal = require('react') as typeof import('react');
  return {
    motion: {
      div: ReactLocal.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { initial?: unknown; animate?: unknown; exit?: unknown; transition?: unknown }>(
        ({ children, ...props }, ref) => (
          <div ref={ref} {...props}>
            {children}
          </div>
        )
      ),
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('lucide-react', () => {
  const ReactLocal = require('react') as typeof import('react');
  const Icon = ({ 'data-icon': dataIcon }: { 'data-icon': string }) => <svg data-icon={dataIcon} />;
  return {
    Loader2: () => <Icon data-icon="Loader2" />,
    XCircle: () => <Icon data-icon="XCircle" />,
    ChevronDown: () => <Icon data-icon="ChevronDown" />,
    ChevronUp: () => <Icon data-icon="ChevronUp" />,
    X: () => <Icon data-icon="X" />,
    Play: () => <Icon data-icon="Play" />,
    Pause: () => <Icon data-icon="Pause" />,
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('JarvisBackgroundIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useJarvisBackgroundJobs.mockReturnValue({
      activeJobs: hoisted.ACTIVE_JOBS,
      hasActiveJobs: true,
      processingJob: hoisted.ACTIVE_JOBS[0],
      cancelJob: hoisted.cancelJob,
    });
    hoisted.useJarvisActionContext.mockReturnValue({
      pendingContexts: hoisted.PENDING_CONTEXTS,
      hasPendingContexts: true,
      resumeAction: hoisted.resumeAction,
      cancelContext: hoisted.cancelContext,
      getContextSummary: hoisted.getContextSummary,
      isResuming: false,
    });
  });

  it('affiche le résumé en header avec le total et le job en cours', async () => {
    const { JarvisBackgroundIndicator } = await import('./JarvisBackgroundIndicator');
    renderWithClient(<JarvisBackgroundIndicator />);

    expect(screen.getByText('JARVIS en arrière-plan')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();

    expect(screen.getByText('Indexation')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();

    expect(screen.queryByText('En cours')).not.toBeInTheDocument();
    expect(screen.queryByText('En attente')).not.toBeInTheDocument();
  });

  it('déploie le contenu, affiche les items et déclenche les actions (cancel/resume)', async () => {
    const { JarvisBackgroundIndicator } = await import('./JarvisBackgroundIndicator');
    renderWithClient(<JarvisBackgroundIndicator />);

    const toggles = screen.getAllByLabelText('Suivant');
    fireEvent.click(toggles[0]);

    expect(await screen.findByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();

    expect(screen.getByText('Analyse')).toBeInTheDocument();
    const progressbars = screen.getAllByRole('progressbar');
    expect(progressbars.some((p) => p.getAttribute('aria-valuenow') === '42')).toBe(true);
    expect(progressbars.some((p) => p.getAttribute('aria-valuenow') === '10')).toBe(true);

    expect(screen.getByText('Résumé ctx-1')).toBeInTheDocument();
    expect(hoisted.getContextSummary).toHaveBeenCalled();

    const closeButtons = screen.getAllByLabelText('Fermer');
    fireEvent.click(closeButtons[1]);
    expect(hoisted.cancelJob).toHaveBeenCalledWith('job-1');

    fireEvent.click(closeButtons[2]);
    expect(hoisted.cancelJob).toHaveBeenCalledWith('job-2');

    const loadingButtons = screen.getAllByLabelText('Chargement');
    fireEvent.click(loadingButtons[0]);
    expect(hoisted.resumeAction).toHaveBeenCalledWith('ctx-1');

    fireEvent.click(closeButtons[3]);
    expect(hoisted.cancelContext).toHaveBeenCalledWith('ctx-1');
  });

  it('se masque si aucun job actif et aucun contexte en attente', async () => {
    hoisted.useJarvisBackgroundJobs.mockReturnValue({
      activeJobs: [],
      hasActiveJobs: false,
      processingJob: null,
      cancelJob: hoisted.cancelJob,
    });
    hoisted.useJarvisActionContext.mockReturnValue({
      pendingContexts: [],
      hasPendingContexts: false,
      resumeAction: hoisted.resumeAction,
      cancelContext: hoisted.cancelContext,
      getContextSummary: hoisted.getContextSummary,
      isResuming: false,
    });

    const { JarvisBackgroundIndicator } = await import('./JarvisBackgroundIndicator');
    const { container } = renderWithClient(<JarvisBackgroundIndicator />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('JARVIS en arrière-plan')).not.toBeInTheDocument();
  });

  it('se dismiss quand on clique sur Fermer dans le header', async () => {
    const { JarvisBackgroundIndicator } = await import('./JarvisBackgroundIndicator');
    const { container } = renderWithClient(<JarvisBackgroundIndicator />);

    expect(screen.getByText('JARVIS en arrière-plan')).toBeInTheDocument();

    const closeButtons = screen.getAllByLabelText('Fermer');
    fireEvent.click(closeButtons[0]);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('JARVIS en arrière-plan')).not.toBeInTheDocument();
  });
});