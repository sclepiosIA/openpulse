import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmailSequenceBuilder } from './EmailSequenceBuilder';

const {
  SEQUENCES,
  ENROLLMENTS,
  createMutateAsync,
  updateMutateAsync,
  deleteMutate,
  updateMutate,
  confirmSpy,
} = vi.hoisted(() => {
  type SequenceStep = { delay_days: number; subject: string; body_html: string; condition?: 'always' | 'no_reply' };
  type EmailSequence = {
    id: string;
    nom: string;
    description?: string | null;
    statut: 'active' | 'draft' | 'paused' | 'archived';
    etapes: SequenceStep[];
  };

  const SEQUENCES: EmailSequence[] = [
    {
      id: 'seq-1',
      nom: 'Relance J+7',
      description: 'Séquence de relance',
      statut: 'active',
      etapes: [
        { delay_days: 0, subject: 'Bonjour', body_html: '<p>Intro</p>', condition: 'always' },
        { delay_days: 7, subject: 'Relance', body_html: '<p>Suivi</p>', condition: 'no_reply' },
      ],
    },
    {
      id: 'seq-2',
      nom: 'Bienvenue',
      description: null,
      statut: 'paused',
      etapes: [{ delay_days: 0, subject: 'Welcome', body_html: '<p>Hi</p>', condition: 'always' }],
    },
  ];

  const ENROLLMENTS = {
    'seq-1': [{ id: 'enr-1', statut: 'active' }, { id: 'enr-2', statut: 'paused' }, { id: 'enr-3', statut: 'active' }],
    'seq-2': [{ id: 'enr-4', statut: 'active' }],
  } as const;

  const createMutateAsync = vi.fn(async () => ({ id: 'seq-new' }));
  const updateMutateAsync = vi.fn(async () => ({ ok: true }));
  const deleteMutate = vi.fn();
  const updateMutate = vi.fn();
  const confirmSpy = vi.fn(() => true);

  return { SEQUENCES, ENROLLMENTS, createMutateAsync, updateMutateAsync, deleteMutate, updateMutate, confirmSpy };
});

vi.mock('@/hooks/email/useEmailSequences', () => {
  type SequenceStep = { delay_days: number; subject: string; body_html: string; condition?: 'always' | 'no_reply' };
  type EmailSequence = {
    id: string;
    nom: string;
    description?: string | null;
    statut: 'active' | 'draft' | 'paused' | 'archived';
    etapes: SequenceStep[];
  };

  return {
    useEmailSequences: vi.fn(() => ({ data: SEQUENCES as unknown as EmailSequence[], isLoading: false })),
    useCreateSequence: vi.fn(() => ({ mutateAsync: createMutateAsync, isPending: false })),
    useUpdateSequence: vi.fn(() => ({
      mutateAsync: updateMutateAsync,
      mutate: updateMutate,
      isPending: false,
    })),
    useDeleteSequence: vi.fn(() => ({ mutate: deleteMutate, isPending: false })),
    useSequenceEnrollments: vi.fn((sequenceId: string) => ({ data: (ENROLLMENTS as Record<string, { id: string; statut: string }[]>)[sequenceId] || [] })),
  };
});

vi.mock('@/components/email/SequenceABTestingPanel', () => ({
  SequenceABTestingPanel: ({ sequenceId, stepsCount }: { sequenceId: string; stepsCount: number }) => (
    <div data-testid="ab-panel">
      AB:{sequenceId}:{stepsCount}
    </div>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button type={type || 'button'} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type,
    min,
  }: {
    value?: string | number;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
    min?: number;
  }) => <input value={value ?? ''} onChange={onChange} placeholder={placeholder} type={type} min={min} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    rows,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    rows?: number;
  }) => <textarea value={value ?? ''} onChange={onChange} placeholder={placeholder} rows={rows} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/dialog', () => {
  const React = require('react') as typeof import('react');

  const DialogContext = React.createContext<{ open: boolean; onOpenChange?: (open: boolean) => void } | null>(null);

  const Dialog = ({ open, onOpenChange, children }: { open: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) => (
    <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
  );

  const DialogTrigger = ({ asChild, children }: { asChild?: boolean; children: React.ReactElement }) => {
    const ctx = React.useContext(DialogContext);
    const child = React.Children.only(children);
    if (!ctx) return child;
    const onClick = () => ctx.onOpenChange?.(true);
    return React.cloneElement(child, { onClick });
  };

  const DialogContent = ({ children }: { children: React.ReactNode }) => {
    const ctx = React.useContext(DialogContext);
    if (!ctx?.open) return null;
    return (
      <div role="dialog" aria-modal="true">
        {children}
      </div>
    );
  };

  const DialogHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>;
  const DialogFooter = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DialogDescription = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;

  return { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription };
});

vi.mock('@/components/ui/select', () => {
  const React = require('react') as typeof import('react');
  const SelectContext = React.createContext<{ value?: string; onValueChange?: (v: string) => void } | null>(null);

  const Select = ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) => (
    <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>
  );

  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectValue = () => {
    const ctx = React.useContext(SelectContext);
    return <span data-testid="select-value">{ctx?.value ?? ''}</span>;
  };

  const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => {
    const ctx = React.useContext(SelectContext);
    return (
      <button type="button" onClick={() => ctx?.onValueChange?.(value)}>
        {children}
      </button>
    );
  };

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ asChild, children }: { asChild?: boolean; children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button type="button" onClick={onClick} data-classname={className}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ 'data-testid': testId }: { 'data-testid'?: string }) => <span data-testid={testId || 'icon'} />;
  return {
    Plus: Icon,
    Trash2: Icon,
    Play: Icon,
    Pause: Icon,
    Mail: Icon,
    Clock: Icon,
    ArrowDown: Icon,
    Zap: Icon,
    MoreHorizontal: Icon,
    Users: Icon,
    Edit: Icon,
  };
});

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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
  };
  const mockFrom = vi.fn(() => builder);
  return { supabase: { from: mockFrom } };
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

describe('EmailSequenceBuilder', () => {
  it('affiche le chargement puis la liste avec métriques calculées (actifs et total jours)', async () => {
    const hooks = await import('@/hooks/email/useEmailSequences');
    const useEmailSequencesMock = vi.mocked(hooks.useEmailSequences);

    useEmailSequencesMock.mockReturnValueOnce({ data: undefined, isLoading: true });

    const { rerender } = render(<EmailSequenceBuilder />, { wrapper: createWrapper() });

    expect(screen.getByText('Chargement...')).toBeInTheDocument();

    useEmailSequencesMock.mockReturnValueOnce({ data: SEQUENCES, isLoading: false });
    rerender(<EmailSequenceBuilder />);

    expect(await screen.findByText('Relance J+7')).toBeInTheDocument();

    const card1 = screen.getByText('Relance J+7').closest('[data-testid="card"]');
    if (!card1) throw new Error('Card not found');

    expect(within(card1).getByText('2 étape(s)')).toBeInTheDocument();
    expect(within(card1).getByText('2 actif(s)')).toBeInTheDocument();
    expect(within(card1).getByText('7j')).toBeInTheDocument();

    const card2 = screen.getByText('Bienvenue').closest('[data-testid="card"]');
    if (!card2) throw new Error('Card not found');
    expect(within(card2).getByText('1 étape(s)')).toBeInTheDocument();
    expect(within(card2).getByText('1 actif(s)')).toBeInTheDocument();
    expect(within(card2).getByText('0j')).toBeInTheDocument();
  });

  it('crée une séquence via la modale et appelle mutateAsync avec les valeurs métier', async () => {
    const user = userEvent.setup();
    render(<EmailSequenceBuilder />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Nouvelle séquence'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Créer une séquence')).toBeInTheDocument();

    await user.type(within(dialog).getByPlaceholderText("Ex: Relance prospect J+7"), 'Ma séquence');
    await user.type(within(dialog).getByPlaceholderText('Optionnel...'), 'Desc');

    await user.click(within(dialog).getByText('Ajouter une étape'));

    const inputs = within(dialog).getAllByPlaceholderText("Objet de l'email...");
    expect(inputs.length).toBe(2);

    await user.type(inputs[0], 'Sujet 1');
    await user.type(inputs[1], 'Sujet 2');

    await user.click(within(dialog).getByText('Créer'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(createMutateAsync).toHaveBeenCalledWith({
      nom: 'Ma séquence',
      description: 'Desc',
      etapes: [
        { delay_days: 0, subject: 'Sujet 1', body_html: '', condition: 'always' },
        { delay_days: 7, subject: 'Sujet 2', body_html: '', condition: 'no_reply' },
      ],
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('met à jour une séquence existante et affiche le panneau AB en mode édition', async () => {
    const user = userEvent.setup();
    render(<EmailSequenceBuilder />, { wrapper: createWrapper() });

    const buttons = screen.getAllByRole('button');
    const editButton = buttons.find((b) => b.textContent?.includes('Modifier'));
    if (!editButton) throw new Error('Edit button not found');

    await user.click(editButton);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Modifier la séquence')).toBeInTheDocument();

    expect(within(dialog).getByTestId('ab-panel')).toHaveTextContent('AB:seq-1:2');

    const nameInput = within(dialog).getByPlaceholderText("Ex: Relance prospect J+7");
    await user.clear(nameInput);
    await user.type(nameInput, 'Relance J+7 (modifiée)');

    await user.click(within(dialog).getByText('Mettre à jour'));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(updateMutateAsync).toHaveBeenCalledWith({
      id: 'seq-1',
      nom: 'Relance J+7 (modifiée)',
      description: 'Séquence de relance',
      etapes: [
        { delay_days: 0, subject: 'Bonjour', body_html: '<p>Intro</p>', condition: 'always' },
        { delay_days: 7, subject: 'Relance', body_html: '<p>Suivi</p>', condition: 'no_reply' },
      ],
    });
  });

  it("toggle le statut via updateSequence.mutate avec l'état attendu", async () => {
    const user = userEvent.setup();
    render(<EmailSequenceBuilder />, { wrapper: createWrapper() });

    const buttons = screen.getAllByRole('button');
    const toggleButton = buttons.find((b) => b.textContent?.includes('Mettre en pause'));
    if (!toggleButton) throw new Error('Toggle button not found');

    await user.click(toggleButton);

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate).toHaveBeenCalledWith({ id: 'seq-1', statut: 'paused' });
  });

  it('supprime une séquence après confirmation', async () => {
    const user = userEvent.setup();
    const originalConfirm = window.confirm;

    Object.defineProperty(window, 'confirm', { value: confirmSpy, configurable: true });

    render(<EmailSequenceBuilder />, { wrapper: createWrapper() });

    const buttons = screen.getAllByRole('button');
    const deleteButton = buttons.find((b) => b.textContent?.includes('Supprimer'));
    if (!deleteButton) throw new Error('Delete button not found');

    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(deleteMutate).toHaveBeenCalledTimes(1);
    expect(deleteMutate).toHaveBeenCalledWith('seq-1');

    Object.defineProperty(window, 'confirm', { value: originalConfirm, configurable: true });
  });
});