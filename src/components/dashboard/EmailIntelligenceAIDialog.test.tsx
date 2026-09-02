// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  EmailIntelligenceAIDialog,
  getConfidenceColor,
  getConfidenceBorderColor,
  getActionLabel,
  formatActionData,
} from './EmailIntelligenceAIDialog';

const {
  stableSuggestions,
  setFilterActionType,
  setFilterConfidence,
  setSortBy,
  onOpenChange,
  onRequestBulk,
  onApproveOne,
  onRejectOne,
} = vi.hoisted(() => ({
  stableSuggestions: [
    {
      id: 's1',
      action_type: 'create_task',
      action_data: {
        title: 'Préparer le devis',
        priority: 'high',
        due_date: '2024-06-20T00:00:00.000Z',
      },
      reason: 'Le client demande un suivi rapide',
      confidence_score: 0.91,
      created_at: '2024-06-10T10:00:00.000Z',
      etablissement: { nom: 'Clinique du Parc', ville: 'Lyon' },
    },
    {
      id: 's2',
      action_type: 'change_status',
      action_data: {
        new_status: 'done',
      },
      reason: 'Le dossier semble clôturé',
      confidence_score: 0.55,
      created_at: '2024-06-11T10:00:00.000Z',
      etablissement: { nom: 'Clinique du Parc', ville: 'Lyon' },
    },
  ],
  setFilterActionType: vi.fn(),
  setFilterConfidence: vi.fn(),
  setSortBy: vi.fn(),
  onOpenChange: vi.fn(),
  onRequestBulk: vi.fn(),
  onApproveOne: vi.fn(),
  onRejectOne: vi.fn(),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode; variant?: string; className?: string }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode; className?: string }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  AccordionItem: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    value?: string;
  }) => <div data-testid="accordion-item" className={className}>{children}</div>,
  AccordionTrigger: ({ children }: { children: React.ReactNode; className?: string }) => <button type="button">{children}</button>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value: number; className?: string }) => <div data-testid="progress">{value}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <div data-testid={`select-${value}`}>
      <button type="button" onClick={() => onValueChange('triggered')}>
        select-action
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Zap: Icon,
    Mail: Icon,
    RefreshCw: Icon,
    Plus: Icon,
    ArrowRightCircle: Icon,
    FileText: Icon,
    Calendar: Icon,
    CheckCheck: Icon,
    X: Icon,
    Sparkles: Icon,
    Filter: Icon,
    Building2: Icon,
  };
});

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => 'il y a 2 jours'),
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | undefined | false | null>) => args.filter(Boolean).join(' '),
}));

describe('EmailIntelligenceAIDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche l’état vide quand il n’y a aucune suggestion', () => {
    render(
      <EmailIntelligenceAIDialog
        open={true}
        onOpenChange={onOpenChange}
        aiSuggestionsCount={0}
        filteredSuggestionsCount={0}
        orderedGroupedAISuggestionEntries={[]}
        filterActionType="all"
        setFilterActionType={setFilterActionType}
        filterConfidence="all"
        setFilterConfidence={setFilterConfidence}
        sortBy="date"
        setSortBy={setSortBy}
        avgConfidence={0}
        highConfCount={0}
        lowConfCount={0}
        isApprovingAI={false}
        isRejectingAI={false}
        processingSuggestionId={null}
        onRequestBulk={onRequestBulk}
        onApproveOne={onApproveOne}
        onRejectOne={onRejectOne}
      />
    );

    expect(screen.getByText(/Aucune suggestion pour le moment/)).toBeInTheDocument();
    expect(
      screen.getByText(/L'IA analyse vos emails en continu pour vous proposer des actions pertinentes/)
    ).toBeInTheDocument();
  });

  it('affiche les métriques, le groupe établissement et permet les actions bulk', () => {
    render(
      <EmailIntelligenceAIDialog
        open={true}
        onOpenChange={onOpenChange}
        aiSuggestionsCount={2}
        filteredSuggestionsCount={2}
        orderedGroupedAISuggestionEntries={[['eta1', stableSuggestions]]}
        filterActionType="all"
        setFilterActionType={setFilterActionType}
        filterConfidence="all"
        setFilterConfidence={setFilterConfidence}
        sortBy="date"
        setSortBy={setSortBy}
        avgConfidence={73}
        highConfCount={1}
        lowConfCount={1}
        isApprovingAI={false}
        isRejectingAI={false}
        processingSuggestionId={null}
        onRequestBulk={onRequestBulk}
        onApproveOne={onApproveOne}
        onRejectOne={onRejectOne}
      />
    );

    expect(screen.getByText(/Actions suggérées par l'IA \(2 \/ 2\)/)).toBeInTheDocument();
    expect(screen.getByText('Confiance moyenne')).toBeInTheDocument();
    expect(screen.getByText('73%')).toBeInTheDocument();

    const groupCard = screen.getByText('Clinique du Parc').closest('[data-testid="card"]');
    expect(groupCard).not.toBeNull();
    const groupScope = within(groupCard as HTMLElement);

    expect(groupScope.getByText(/2 suggestions • Lyon/)).toBeInTheDocument();
    expect(groupScope.getByText('Création de tâche')).toBeInTheDocument();
    expect(groupScope.getByText('Changement de statut')).toBeInTheDocument();
    expect(groupScope.getByText('91%')).toBeInTheDocument();
    expect(groupScope.getByText('55%')).toBeInTheDocument();
    expect(screen.getAllByText('il y a 2 jours')).toHaveLength(2);

    fireEvent.click(groupScope.getByText('Tout approuver'));
    expect(onRequestBulk).toHaveBeenCalledWith('approve', 'eta1', 'Clinique du Parc');

    fireEvent.click(groupScope.getByText('Tout ignorer'));
    expect(onRequestBulk).toHaveBeenCalledWith('reject', 'eta1', 'Clinique du Parc');
  });

  it('affiche la vue aucun résultat quand les filtres éliminent tout et permet la réinitialisation', () => {
    render(
      <EmailIntelligenceAIDialog
        open={true}
        onOpenChange={onOpenChange}
        aiSuggestionsCount={3}
        filteredSuggestionsCount={0}
        orderedGroupedAISuggestionEntries={[]}
        filterActionType="create_task"
        setFilterActionType={setFilterActionType}
        filterConfidence="high"
        setFilterConfidence={setFilterConfidence}
        sortBy="confidence"
        setSortBy={setSortBy}
        avgConfidence={0}
        highConfCount={0}
        lowConfCount={0}
        isApprovingAI={false}
        isRejectingAI={false}
        processingSuggestionId={null}
        onRequestBulk={onRequestBulk}
        onApproveOne={onApproveOne}
        onRejectOne={onRejectOne}
      />
    );

    expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
    expect(screen.getByText(/Aucune suggestion ne correspond à vos filtres/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Réinitialiser'));
    expect(setFilterActionType).toHaveBeenCalledWith('all');
    expect(setFilterConfidence).toHaveBeenCalledWith('all');
    expect(setSortBy).toHaveBeenCalledWith('date');
  });
});

describe('helpers EmailIntelligenceAIDialog', () => {
  it('retourne les classes de couleur de confiance attendues', () => {
    expect(getConfidenceColor(0.85)).toBe('text-green-600 dark:text-green-400');
    expect(getConfidenceColor(0.65)).toBe('text-yellow-600 dark:text-yellow-400');
    expect(getConfidenceColor(0.2)).toBe('text-orange-600 dark:text-orange-400');

    expect(getConfidenceBorderColor(0.85)).toBe('border-green-500/30');
    expect(getConfidenceBorderColor(0.65)).toBe('border-yellow-500/30');
    expect(getConfidenceBorderColor(0.2)).toBe('border-orange-500/30');
  });

  it('retourne les libellés d’action métier attendus', () => {
    expect(getActionLabel('update_task')).toBe('Mise à jour de tâche');
    expect(getActionLabel('create_task')).toBe('Création de tâche');
    expect(getActionLabel('change_status')).toBe('Changement de statut');
    expect(getActionLabel('update_summary')).toBe('Mise à jour du résumé');
    expect(getActionLabel('send_email_response')).toBe('Réponse email');
    expect(getActionLabel('schedule_follow_up')).toBe('Relance planifiée');
    expect(getActionLabel('custom_action')).toBe('custom_action');
  });

  it('formate les données d’action create_task et update_summary avec les valeurs métier', () => {
    const { container: createTaskContainer } = render(
      <>{formatActionData('create_task', {
        title: 'Préparer le dossier',
        priority: 'medium',
        due_date: '2024-06-20T00:00:00.000Z',
      })}</>
    );

    expect(createTaskContainer.textContent).toContain('Titre');
    expect(createTaskContainer.textContent).toContain('Préparer le dossier');
    expect(createTaskContainer.textContent).toContain('Priorité');
    expect(createTaskContainer.textContent).toContain('medium');
    expect(createTaskContainer.textContent).toContain('Échéance');

    const longSummary = 'a'.repeat(120);
    const { container: summaryContainer } = render(
      <>{formatActionData('update_summary', { summary: longSummary })}</>
    );

    expect(summaryContainer.textContent).toContain('Résumé');
    expect(summaryContainer.textContent).toContain('a'.repeat(100));
    expect(summaryContainer.textContent).toContain('...');
  });

  it('retourne null si action_data est absent et fallback json pour une action inconnue', () => {
    expect(formatActionData('create_task', null)).toBeNull();

    const { container } = render(<>{formatActionData('unknown_action', { foo: 'bar', count: 2 })}</>);
    expect(container.textContent).toContain('"foo": "bar"');
    expect(container.textContent).toContain('"count": 2');
  });
});