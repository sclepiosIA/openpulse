import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';

const {
  WORKFLOWS,
  SUGGESTED,
  EMPTY,
  mockExecuteWorkflow,
  mockUseJarvisEnhanced,
} = vi.hoisted(() => {
  const WORKFLOWS = [
    {
      id: 'wf-1',
      name: 'Rapport ventes',
      description: 'Génère le rapport quotidien des ventes',
      category: 'sales',
      triggerCommand: 'lance rapport ventes',
      stepsCount: 3,
      estimatedDurationMs: 5000,
    },
    {
      id: 'wf-2',
      name: 'Clôture comptable',
      description: 'Clôture le mois comptable',
      category: 'finance',
      triggerCommand: 'lance cloture',
      stepsCount: 5,
      estimatedDurationMs: 12000,
    },
  ];
  const SUGGESTED = [WORKFLOWS[0]];
  const EMPTY: typeof WORKFLOWS = [];
  const mockExecuteWorkflow = vi.fn(() => Promise.resolve({ success: true }));
  const mockUseJarvisEnhanced = vi.fn();
  return { WORKFLOWS, SUGGESTED, EMPTY, mockExecuteWorkflow, mockUseJarvisEnhanced };
});

vi.mock('@/hooks/jarvis/useJarvisEnhanced', () => ({
  useJarvisEnhanced: mockUseJarvisEnhanced,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="loader" />,
  Play: () => <span data-testid="icon-play" />,
  Clock: () => null,
  Zap: () => null,
  CheckCircle: () => <span data-testid="icon-check" />,
  Workflow: () => null,
}));

import { JarvisWorkflowPanel } from './JarvisWorkflowPanel';

function setHookState(overrides: Record<string, unknown> = {}) {
  mockUseJarvisEnhanced.mockReturnValue({
    workflows: WORKFLOWS,
    isWorkflowsLoading: false,
    executeWorkflow: mockExecuteWorkflow,
    isExecutingWorkflow: false,
    getSuggestedWorkflows: () => SUGGESTED,
    ...overrides,
  });
}

describe('JarvisWorkflowPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHookState();
  });

  it('affiche un spinner pendant le chargement des workflows', () => {
    setHookState({ isWorkflowsLoading: true });
    render(<JarvisWorkflowPanel />);

    expect(screen.getByTestId('loader')).toBeTruthy();
    expect(screen.queryByText('Rapport ventes')).toBeNull();
    expect(screen.queryByText('Clôture comptable')).toBeNull();
  });

  it('affiche les workflows avec leurs métadonnées réelles', () => {
    render(<JarvisWorkflowPanel />);

    // wf-1 apparaît dans les suggérés ET dans la liste principale
    expect(screen.getAllByText('Rapport ventes')).toHaveLength(2);
    expect(screen.getByText('Clôture comptable')).toBeTruthy();
    expect(screen.getByText('Clôture le mois comptable')).toBeTruthy();

    // Section suggérés
    expect(screen.getByText('Suggérés maintenant')).toBeTruthy();
    expect(screen.getByText('Suggéré')).toBeTruthy();

    // Étapes et durée estimée (5000ms → 5s, 12000ms → 12s)
    expect(screen.getAllByText('3 étapes')).toHaveLength(2);
    expect(screen.getByText('5 étapes')).toBeTruthy();
    expect(screen.getAllByText('~5s')).toHaveLength(2);
    expect(screen.getByText('~12s')).toBeTruthy();

    // Filtres de catégories
    expect(screen.getByText('Tous')).toBeTruthy();
    expect(screen.getByText('🎯 sales')).toBeTruthy();
    expect(screen.getByText('💰 finance')).toBeTruthy();
  });

  it('filtre la liste par catégorie au clic sur un filtre', () => {
    render(<JarvisWorkflowPanel />);

    fireEvent.click(screen.getByText('💰 finance'));

    // wf-1 ne reste visible que dans la section suggérés (1 occurrence au lieu de 2)
    expect(screen.getAllByText('Rapport ventes')).toHaveLength(1);
    expect(screen.getByText('Clôture comptable')).toBeTruthy();

    fireEvent.click(screen.getByText('Tous'));
    expect(screen.getAllByText('Rapport ventes')).toHaveLength(2);
  });

  it('appelle onExecuteWorkflow avec la triggerCommand puis affiche "Fait"', async () => {
    const onExecuteWorkflow = vi.fn();
    render(<JarvisWorkflowPanel onExecuteWorkflow={onExecuteWorkflow} />);

    const launchButtons = screen.getAllByText('Lancer');
    expect(launchButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(launchButtons[0]);
    });

    expect(onExecuteWorkflow).toHaveBeenCalledTimes(1);
    expect(onExecuteWorkflow).toHaveBeenCalledWith('lance rapport ventes');
    expect(mockExecuteWorkflow).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getAllByText('Fait').length).toBeGreaterThan(0);
    });
  });

  it('appelle executeWorkflow du hook quand aucun onExecuteWorkflow fourni', async () => {
    render(<JarvisWorkflowPanel />);

    const launchButtons = screen.getAllByText('Lancer');

    await act(async () => {
      fireEvent.click(launchButtons[0]);
    });

    expect(mockExecuteWorkflow).toHaveBeenCalledTimes(1);
    expect(mockExecuteWorkflow).toHaveBeenCalledWith({ workflowId: 'wf-1' });
  });

  it('affiche l’état vide quand aucun workflow n’est disponible', () => {
    setHookState({ workflows: EMPTY, getSuggestedWorkflows: () => EMPTY });
    render(<JarvisWorkflowPanel />);

    expect(screen.getByText('Aucun workflow dans cette catégorie')).toBeTruthy();
    expect(screen.queryByText('Suggérés maintenant')).toBeNull();
    expect(screen.queryByText('Lancer')).toBeNull();
  });
});