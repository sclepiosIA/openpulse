// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  AIUsageRegistryTab,
  AIUsagePromptsTab,
  AIUsageFunctionDetailDialog,
} from './AIUsageRegistryAndPromptsTabs';

const {
  CATEGORY_CONFIG_STABLE,
  MODEL_CONFIG_STABLE,
  AI_FUNCTIONS_REGISTRY_STABLE,
  FN_A,
  FN_B,
  STATS_MAP,
  EMPTY_STATS_MAP,
  formatCostMock,
  formatTokensMock,
} = vi.hoisted(() => {
  const CATEGORY_CONFIG_STABLE = {
    analysis: { label: 'Analyse', bgColor: 'bg-analysis', color: 'text-analysis' },
    generation: { label: 'Génération', bgColor: 'bg-generation', color: 'text-generation' },
  };

  const MODEL_CONFIG_STABLE = {
    'gpt-4o-mini': { label: 'GPT-4o Mini', bgColor: 'bg-model-mini', color: 'text-model-mini' },
    'gpt-4.1': { label: 'GPT-4.1', bgColor: 'bg-model-41', color: 'text-model-41' },
  };

  const FN_A = {
    id: 'fn-analyze',
    label: 'Analyse de document',
    category: 'analysis',
    model: 'gpt-4o-mini',
    processingType: 'doc-analysis',
    description: 'Analyse des contenus texte',
    systemPromptPreview: 'Tu analyses le document et retournes un résumé.',
    securityFeatures: ['redaction', 'validation'],
    fallbackChain: ['gpt-4o-mini', 'gpt-4.1'],
    parameters: {
      reasoning_effort: 'medium',
      max_completion_tokens: 1200,
      response_format: 'json',
      timeout_ms: 30000,
      verbosity: 'low',
    },
  };

  const FN_B = {
    id: 'fn-generate',
    label: 'Génération email',
    category: 'generation',
    model: 'gpt-4.1',
    processingType: 'email-generation',
    description: 'Produit un email prêt à envoyer',
    systemPromptPreview: 'Tu rédiges un email clair et concis.',
    securityFeatures: [],
    fallbackChain: ['gpt-4.1'],
    parameters: {
      reasoning_effort: 'low',
      max_completion_tokens: 0,
      response_format: '',
      timeout_ms: 15000,
      verbosity: 'high',
    },
  };

  const AI_FUNCTIONS_REGISTRY_STABLE = [
    FN_A,
    FN_B,
    {
      ...FN_A,
      id: 'fn-extra',
      label: 'Extra',
      processingType: 'extra-processing',
    },
  ];

  const STATS_MAP = new Map([
    ['doc-analysis', { count: 12, cost: 1.23, tokens: 4567, successRate: 0.92 }],
  ]);

  const EMPTY_STATS_MAP = new Map();

  return {
    CATEGORY_CONFIG_STABLE,
    MODEL_CONFIG_STABLE,
    AI_FUNCTIONS_REGISTRY_STABLE,
    FN_A,
    FN_B,
    STATS_MAP,
    EMPTY_STATS_MAP,
    formatCostMock: vi.fn((v: number) => `€${v.toFixed(2)}`),
    formatTokensMock: vi.fn((v: number) => `${v} tok`),
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card-content" className={className}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    onClick,
    className,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
  }) => (
    <button type="button" data-variant={variant} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/tabs', () => ({
  TabsContent: ({
    children,
    value,
    className,
  }: {
    children: React.ReactNode;
    value: string;
    className?: string;
  }) => <section data-testid={`tabs-${value}`} className={className}>{children}</section>,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={className}>{children}</td>,
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => <tr className={className} onClick={onClick}>{children}</tr>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    placeholder,
    value,
    onChange,
    className,
  }: {
    placeholder?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
  }) => <input placeholder={placeholder} value={value} onChange={onChange} className={className} />,
}));

vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="accordion" className={className}>{children}</div>,
  AccordionContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) => <div data-testid={`accordion-item-${value}`} className={className}>{children}</div>,
  AccordionTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="dialog" data-open={open ? 'true' : 'false'}>
      {children}
      <button type="button" onClick={() => onOpenChange(false)}>close-dialog</button>
    </div>
  ),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
}));

vi.mock('lucide-react', () => ({
  Search: () => <svg data-testid="search-icon" />,
  Shield: () => <svg data-testid="shield-icon" />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | undefined | false | null>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/lib/aiRegistry', () => ({
  AI_FUNCTIONS_REGISTRY: AI_FUNCTIONS_REGISTRY_STABLE,
  CATEGORY_CONFIG: CATEGORY_CONFIG_STABLE,
  MODEL_CONFIG: MODEL_CONFIG_STABLE,
}));

vi.mock('@/hooks/ai/useAIUsageStats', () => ({
  formatCost: formatCostMock,
  formatTokens: formatTokensMock,
}));

vi.mock('./AIUsageDashboardCards', () => ({
  InfoBlock: ({ label, value }: { label: string; value: string }) => (
    <div data-testid="info-block">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

describe('AIUsageRegistryAndPromptsTabs', () => {
  beforeEach(() => {
    formatCostMock.mockClear();
    formatTokensMock.mockClear();
  });

  it('render la tab registre, affiche les métriques métier et gère recherche/filtres/clic ligne', () => {
    const setRegistryFilter = vi.fn();
    const setRegistrySearch = vi.fn();
    const setSelectedFunction = vi.fn();

    render(
      <AIUsageRegistryTab
        filteredRegistry={[FN_A, FN_B]}
        registryFilter="all"
        setRegistryFilter={setRegistryFilter}
        registrySearch=""
        setRegistrySearch={setRegistrySearch}
        stats={{ callsByProcessingType: STATS_MAP }}
        setSelectedFunction={setSelectedFunction}
      />,
    );

    expect(screen.getByTestId('tabs-registry')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Rechercher une fonction...')).toHaveValue('');
    expect(screen.getByText('Fonction')).toBeInTheDocument();
    expect(screen.getByText('Analyse de document')).toBeInTheDocument();
    expect(screen.getByText('fn-analyze')).toBeInTheDocument();
    expect(screen.getByText('Génération email')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('€1.23')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('2 fonctions sur 3')).toBeInTheDocument();
    expect(formatCostMock).toHaveBeenCalledWith(1.23);
    expect(formatCostMock).toHaveBeenCalledWith(0);

    fireEvent.change(screen.getByPlaceholderText('Rechercher une fonction...'), {
      target: { value: 'doc' },
    });
    expect(setRegistrySearch).toHaveBeenCalledWith('doc');

    fireEvent.click(screen.getAllByText('Toutes')[0]);
    expect(setRegistryFilter).toHaveBeenCalledWith('all');

    fireEvent.click(screen.getAllByText('Analyse')[0]);
    expect(setRegistryFilter).toHaveBeenCalledWith('analysis');

    fireEvent.click(screen.getByText('Analyse de document'));
    expect(setSelectedFunction).toHaveBeenCalledWith(FN_A);
  });

  it('render la tab prompts avec détails de prompt, modèle, sécurité et fallback des valeurs vides', () => {
    const setPromptCategoryFilter = vi.fn();
    const setPromptSearch = vi.fn();

    render(
      <AIUsagePromptsTab
        filteredPrompts={[FN_A, FN_B]}
        promptCategoryFilter="all"
        setPromptCategoryFilter={setPromptCategoryFilter}
        promptSearch=""
        setPromptSearch={setPromptSearch}
      />,
    );

    expect(screen.getByTestId('tabs-prompts')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Rechercher dans les prompts...')).toHaveValue('');
    expect(screen.getAllByText('System Prompt')).toHaveLength(2);
    expect(screen.getByText('Tu analyses le document et retournes un résumé.')).toBeInTheDocument();
    expect(screen.getByText('Tu rédiges un email clair et concis.')).toBeInTheDocument();
    expect(screen.getByText('GPT-4o Mini')).toBeInTheDocument();
    expect(screen.getByText('GPT-4.1')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('1200')).toBeInTheDocument();

    const promptA = screen.getByTestId('accordion-item-fn-analyze');
    expect(within(promptA).getByText('json')).toBeInTheDocument();
    expect(within(promptA).getByText('Sécurité')).toBeInTheDocument();
    expect(within(promptA).getByText('redaction')).toBeInTheDocument();
    expect(within(promptA).getByText('validation')).toBeInTheDocument();

    const promptB = screen.getByTestId('accordion-item-fn-generate');
    expect(within(promptB).getByText('text')).toBeInTheDocument();
    expect(within(promptB).getByText('low')).toBeInTheDocument();
    expect(within(promptB).getByText('—')).toBeInTheDocument();

    expect(screen.getByText('2 fonctions affichées')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Rechercher dans les prompts...'), {
      target: { value: 'email' },
    });
    expect(setPromptSearch).toHaveBeenCalledWith('email');

    fireEvent.click(screen.getAllByText('Génération')[0]);
    expect(setPromptCategoryFilter).toHaveBeenCalledWith('generation');
  });

  it('render le dialogue de détail, affiche métriques réelles et ferme la modale', () => {
    const setSelectedFunction = vi.fn();

    render(
      <AIUsageFunctionDetailDialog
        selectedFunction={FN_A}
        setSelectedFunction={setSelectedFunction}
        stats={{ callsByProcessingType: STATS_MAP }}
      />,
    );

    expect(screen.getByText('Analyse de document')).toBeInTheDocument();
    expect(screen.getByText('Analyse des contenus texte')).toBeInTheDocument();
    expect(screen.getByText('Edge Function')).toBeInTheDocument();
    expect(screen.getByText('fn-analyze')).toBeInTheDocument();
    expect(screen.getByText('Processing Type')).toBeInTheDocument();
    expect(screen.getByText('doc-analysis')).toBeInTheDocument();
    expect(screen.getByText('Timeout')).toBeInTheDocument();
    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(screen.getByText('Verbosity')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
    expect(screen.getByText('Chaîne de fallback')).toBeInTheDocument();
    expect(screen.getByText('Tu analyses le document et retournes un résumé.')).toBeInTheDocument();
    expect(screen.getByText('Features de sécurité')).toBeInTheDocument();
    expect(screen.getByText('Métriques réelles')).toBeInTheDocument();
    expect(screen.getByText('Appels')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Coût total')).toBeInTheDocument();
    expect(screen.getByText('€1.23')).toBeInTheDocument();
    expect(screen.getByText('Tokens')).toBeInTheDocument();
    expect(screen.getByText('4567 tok')).toBeInTheDocument();
    expect(screen.getByText('Taux succès')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(formatTokensMock).toHaveBeenCalledWith(4567);

    fireEvent.click(screen.getByText('close-dialog'));
    expect(setSelectedFunction).toHaveBeenCalledWith(null);
  });

  it('n affiche pas les métriques réelles si aucune statistique ne correspond', () => {
    const setSelectedFunction = vi.fn();

    render(
      <AIUsageFunctionDetailDialog
        selectedFunction={FN_B}
        setSelectedFunction={setSelectedFunction}
        stats={{ callsByProcessingType: EMPTY_STATS_MAP }}
      />,
    );

    expect(screen.getByText('Génération email')).toBeInTheDocument();
    expect(screen.queryByText('Métriques réelles')).not.toBeInTheDocument();
    expect(screen.getByText('15s')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('ne rend pas de détail quand aucune fonction sélectionnée', () => {
    const setSelectedFunction = vi.fn();

    render(
      <AIUsageFunctionDetailDialog
        selectedFunction={null}
        setSelectedFunction={setSelectedFunction}
        stats={{ callsByProcessingType: STATS_MAP }}
      />,
    );

    expect(screen.queryByText('Métriques réelles')).not.toBeInTheDocument();
    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'false');
  });
});