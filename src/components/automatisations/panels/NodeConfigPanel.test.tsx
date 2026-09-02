/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NodeConfigPanel } from './NodeConfigPanel';

const {
  PARAMS,
  mockUseParams,
  mockConditionGroupEditor,
  mockVariablesHelper,
  mockNodeInlineTest,
  TRIGGER_LABELS_STABLE,
  ACTION_LABELS_STABLE,
} = vi.hoisted(() => ({
  PARAMS: { id: 'workflow-1' },
  mockUseParams: vi.fn(() => ({ id: 'workflow-1' })),
  mockConditionGroupEditor: vi.fn(),
  mockVariablesHelper: vi.fn(),
  mockNodeInlineTest: vi.fn(),
  TRIGGER_LABELS_STABLE: {
    'prospect.score_above': 'Score prospect élevé',
    'email.no_reply_after_days': 'Sans réponse',
    'calendar.event_starts_in': 'Événement à venir',
    'churn.risk_detected': 'Risque de churn',
    schedule_cron: 'Cron',
    schedule: 'Planifié',
    webhook: 'Webhook',
  },
  ACTION_LABELS_STABLE: {
    create_task: 'Créer une tâche',
    send_email: 'Envoyer un email',
    send_notification: 'Envoyer une notification',
    create_ticket: 'Créer un ticket',
    update_field: 'Mettre à jour un champ',
    webhook: 'Webhook',
    ai_write_email: 'IA rédige un email',
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: mockUseParams,
}));

vi.mock('@/types/workflow', () => ({
  TRIGGER_LABELS: TRIGGER_LABELS_STABLE,
  ACTION_LABELS: ACTION_LABELS_STABLE,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type,
    min,
    max,
    className,
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      aria-label={placeholder || 'input'}
      value={value as string | number | readonly string[] | undefined}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      min={min}
      max={max}
      className={className}
    />
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    rows,
    className,
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
      aria-label={placeholder || 'textarea'}
      value={value as string | number | readonly string[] | undefined}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={className}
    />
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    'aria-label': ariaLabel,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => {
    const items: Array<{ value: string; label: React.ReactNode }> = [];

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const childProps = child.props as { children?: React.ReactNode };
      React.Children.forEach(childProps.children, (nested) => {
        if (!React.isValidElement(nested)) return;
        const nestedProps = nested.props as { children?: React.ReactNode };
        React.Children.forEach(nestedProps.children, (item) => {
          if (!React.isValidElement(item)) return;
          const itemProps = item.props as { value?: string; children?: React.ReactNode };
          if (itemProps.value) {
            items.push({ value: itemProps.value, label: itemProps.children });
          }
        });
      });
    });

    return (
      <select
        aria-label="select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">--</option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {typeof item.label === 'string' ? item.label : item.value}
          </option>
        ))}
      </select>
    );
  },
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder || 'value'}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { value: string; children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Trash2: () => <svg data-testid="trash-icon" />,
}));

vi.mock('./ConditionGroupEditor', () => ({
  ConditionGroupEditor: ({
    value,
    onChange,
  }: {
    value: Record<string, unknown>;
    onChange: (value: Record<string, unknown>) => void;
  }) => {
    mockConditionGroupEditor(value);
    return (
      <button
        onClick={() => onChange({ combinator: 'or', rules: [{ field: 'score' }] })}
      >
        Edit condition
      </button>
    );
  },
}));

vi.mock('./VariablesHelper', () => ({
  VariablesHelper: ({ triggerType }: { triggerType?: string }) => {
    mockVariablesHelper(triggerType);
    return <div data-testid="variables-helper">Variables helper</div>;
  },
}));

vi.mock('./NodeInlineTest', () => ({
  NodeInlineTest: () => {
    mockNodeInlineTest();
    return <div data-testid="node-inline-test">Inline test</div>;
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

function renderPanel(
  props: React.ComponentProps<typeof NodeConfigPanel>,
) {
  const Wrapper = createWrapper();
  return render(<NodeConfigPanel {...props} />, { wrapper: Wrapper });
}

describe('NodeConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue(PARAMS);
  });

  it('affiche le message vide quand aucun noeud n’est sélectionné', () => {
    renderPanel({
      node: null,
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onClose: vi.fn(),
    });

    expect(screen.getByText('Sélectionnez un bloc pour le configurer.')).toBeInTheDocument();
  });

  it('met à jour le libellé et supprime un noeud non trigger', () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();

    renderPanel({
      node: {
        id: 'n1',
        type: 'delay',
        position: { x: 0, y: 0 },
        data: { label: 'Pause', config: { amount: 2, unit: 'hours' } },
      },
      onUpdate,
      onDelete,
      onClose: vi.fn(),
    });

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Pause modifiée' } });

    expect(onUpdate).toHaveBeenCalledWith('n1', {
      label: 'Pause modifiée',
      config: { amount: 2, unit: 'hours' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onDelete).toHaveBeenCalledWith('n1');
  });

  it('n’affiche pas le bouton supprimer pour un trigger et met à jour sa configuration score', () => {
    const onUpdate = vi.fn();

    renderPanel({
      node: {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: {
          label: 'Déclencheur score',
          trigger_type: 'prospect.score_above',
          config: { threshold: 70, operator: 'gte' },
        },
      },
      onUpdate,
      onDelete: vi.fn(),
      onClose: vi.fn(),
    });

    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
    expect(screen.getByText('Type de déclencheur')).toBeInTheDocument();
    expect(screen.getByText('Seuil de score (0-100)')).toBeInTheDocument();
    expect(screen.getByText('Opérateur')).toBeInTheDocument();

    const numberInputs = screen.getAllByDisplayValue('70');
    fireEvent.change(numberInputs[0], { target: { value: '85' } });

    expect(onUpdate).toHaveBeenCalledWith('trigger-1', {
      label: 'Déclencheur score',
      trigger_type: 'prospect.score_above',
      config: { threshold: 85, operator: 'gte' },
    });
  });

  it('met à jour la configuration schedule_cron avec une expression cron réelle', () => {
    const onUpdate = vi.fn();

    renderPanel({
      node: {
        id: 'trigger-2',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: {
          label: 'Planification',
          trigger_type: 'schedule_cron',
          config: { cron_expression: '' },
        },
      },
      onUpdate,
      onDelete: vi.fn(),
      onClose: vi.fn(),
    });

    expect(screen.getByText('Expression cron')).toBeInTheDocument();
    expect(screen.getByText(/Format : minute heure jour mois jour_semaine/i)).toBeInTheDocument();

    const cronInput = screen.getByPlaceholderText('0 9 * * 1-5');
    fireEvent.change(cronInput, { target: { value: '30 8 * * 1' } });

    expect(onUpdate).toHaveBeenCalledWith('trigger-2', {
      label: 'Planification',
      trigger_type: 'schedule_cron',
      config: { cron_expression: '30 8 * * 1' },
    });
  });

  it('rend l’éditeur de conditions et propage la nouvelle config', () => {
    const onUpdate = vi.fn();

    renderPanel({
      node: {
        id: 'cond-1',
        type: 'condition',
        position: { x: 0, y: 0 },
        data: {
          label: 'Vérifier score',
          config: { combinator: 'and', rules: [] },
        },
      },
      onUpdate,
      onDelete: vi.fn(),
      onClose: vi.fn(),
      triggerType: 'prospect.score_above',
    });

    expect(screen.getByTestId('variables-helper')).toBeInTheDocument();
    expect(screen.getByText('Règles (ET / OU imbriqués)')).toBeInTheDocument();
    expect(mockVariablesHelper).toHaveBeenCalledWith('prospect.score_above');
    expect(mockConditionGroupEditor).toHaveBeenCalledWith({ combinator: 'and', rules: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Edit condition' }));

    expect(onUpdate).toHaveBeenCalledWith('cond-1', {
      label: 'Vérifier score',
      config: { combinator: 'or', rules: [{ field: 'score' }] },
    });
  });

  it('met à jour un noeud delay avec quantité numérique', () => {
    const onUpdate = vi.fn();

    renderPanel({
      node: {
        id: 'delay-1',
        type: 'delay',
        position: { x: 0, y: 0 },
        data: {
          label: 'Attente',
          config: { amount: 1, unit: 'minutes' },
        },
      },
      onUpdate,
      onDelete: vi.fn(),
      onClose: vi.fn(),
    });

    expect(screen.getByText('Quantité')).toBeInTheDocument();
    expect(screen.getByText('Unité')).toBeInTheDocument();

    const amountInput = screen.getByDisplayValue('1');
    fireEvent.change(amountInput, { target: { value: '5' } });

    expect(onUpdate).toHaveBeenCalledWith('delay-1', {
      label: 'Attente',
      config: { amount: 5, unit: 'minutes' },
    });
  });

  it('met à jour les champs métier de l’action create_task', () => {
    const onUpdate = vi.fn();

    renderPanel({
      node: {
        id: 'action-1',
        type: 'action',
        position: { x: 0, y: 0 },
        data: {
          label: 'Créer tâche',
          action_type: 'create_task',
          config: {
            titre: 'Relancer prospect',
            description: 'Préparer un appel',
            priorite: 'medium',
            echeance_offset_days: 2,
          },
        },
      },
      onUpdate,
      onDelete: vi.fn(),
      onClose: vi.fn(),
    });

    expect(screen.getByText("Type d'action")).toBeInTheDocument();
    expect(screen.getByText('Titre tâche')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Priorité')).toBeInTheDocument();
    expect(screen.getByText('Échéance (jours)')).toBeInTheDocument();

    const titleInput = screen.getByDisplayValue('Relancer prospect');
    fireEvent.change(titleInput, { target: { value: 'Relancer établissement prioritaire' } });

    expect(onUpdate).toHaveBeenCalledWith('action-1', {
      label: 'Créer tâche',
      action_type: 'create_task',
      config: {
        titre: 'Relancer établissement prioritaire',
        description: 'Préparer un appel',
        priorite: 'medium',
        echeance_offset_days: 2,
      },
    });
  });

  it('met à jour les champs de l’action send_email', () => {
    const onUpdate = vi.fn();

    renderPanel({
      node: {
        id: 'action-2',
        type: 'action',
        position: { x: 0, y: 0 },
        data: {
          label: 'Email',
          action_type: 'send_email',
          config: {
            to: '{{trigger.email}}',
            subject: 'Relance',
            body: 'Bonjour',
          },
        },
      },
      onUpdate,
      onDelete: vi.fn(),
      onClose: vi.fn(),
    });

    expect(screen.getByText('Destinataire')).toBeInTheDocument();
    expect(screen.getByText('Sujet')).toBeInTheDocument();
    expect(screen.getByText('Corps')).toBeInTheDocument();

    const subjectInput = screen.getByDisplayValue('Relance');
    fireEvent.change(subjectInput, { target: { value: 'Relance après démo' } });

    expect(onUpdate).toHaveBeenCalledWith('action-2', {
      label: 'Email',
      action_type: 'send_email',
      config: {
        to: '{{trigger.email}}',
        subject: 'Relance après démo',
        body: 'Bonjour',
      },
    });
  });

  it('affiche le bloc webhook trigger informatif', () => {
    renderPanel({
      node: {
        id: 'trigger-3',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: {
          label: 'Webhook entrant',
          trigger_type: 'webhook',
          config: {},
        },
      },
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onClose: vi.fn(),
    });

    expect(screen.getByText(/Les tokens webhook se gèrent depuis/i)).toBeInTheDocument();
    expect(screen.getByText(/Automatisations → Webhooks/i)).toBeInTheDocument();
  });
});