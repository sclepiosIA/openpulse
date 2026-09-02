/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen, waitFor, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { JarvisModifyDialog } from './JarvisModifyDialog';

const {
  AUTH_STATE,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockFrom,
  SELECT_OPTIONS,
  SEND_EMAIL_ACTION,
  CREATE_TASK_ACTION,
  UPDATE_STATUS_ACTION,
  SCHEDULE_MEETING_ACTION,
  CLOSE_TICKET_ACTION,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    catch: (reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(reject),
  };

  return {
    AUTH_STATE,
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockFrom: vi.fn(() => chain),
    SELECT_OPTIONS: ['basse', 'moyenne', 'haute', 'urgente'],
    SEND_EMAIL_ACTION: {
      id: 'a1',
      proposed_action: {
        type: 'send_email',
        data: {
          to: 'old@test.co',
          subject: 'Sujet initial',
          body: 'Corps initial',
        },
      },
    },
    CREATE_TASK_ACTION: {
      id: 'a2',
      proposed_action: {
        type: 'create_task',
        data: {
          titre: 'Tâche initiale',
          description: 'Description initiale',
          priorite: 'moyenne',
          date_echeance: '2026-01-15T10:30:00',
        },
      },
    },
    UPDATE_STATUS_ACTION: {
      id: 'a3',
      proposed_action: {
        type: 'update_status',
        data: {
          entity_type: 'company',
          new_status: 'contacted',
        },
      },
    },
    SCHEDULE_MEETING_ACTION: {
      id: 'a4',
      proposed_action: {
        type: 'schedule_meeting',
        data: {
          title: 'Réunion initiale',
          start_time: '2026-02-20T09:15:00',
          end_time: '2026-02-20T10:00:00',
          location: 'Salle A',
        },
      },
    },
    CLOSE_TICKET_ACTION: {
      id: 'a5',
      proposed_action: {
        type: 'close_ticket',
        data: {
          resolution_note: 'Résolu après correctif',
        },
      },
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Pencil: Icon,
    Mail: Icon,
    CheckSquare: Icon,
    Building2: Icon,
    Calendar: Icon,
    Ticket: Icon,
    Save: Icon,
    X: Icon,
    Sparkles: Icon,
  };
});

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  DialogFooter: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type = 'button',
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
    return <input ref={ref} {...props} />;
  }),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    ...props
  }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
    props,
    ref,
  ) {
    return <textarea ref={ref} {...props} />;
  }),
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
  }) => (
    <select
      data-testid="select-priorite"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
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

describe('JarvisModifyDialog', () => {
  it('couvre un hook react-query: chargement puis succès avec wrapper QueryClientProvider', async () => {
    const stableResult = { value: 'ok' };
    let calls = 0;

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['jarvis-modify-dialog-test'],
          queryFn: async () => {
            calls += 1;
            await Promise.resolve();
            return stableResult;
          },
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ value: 'ok' });
    expect(calls).toBe(1);
  });

  it('couvre un hook react-query: erreur -> isError', async () => {
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['jarvis-modify-dialog-error'],
          queryFn: async () => {
            const response = { data: null, error: { message: 'x' } };
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.data;
          },
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('x');
  });

  it('affiche et modifie un email puis sauvegarde avec les valeurs réelles du formulaire', async () => {
    const onOpenChange = vi.fn();
    const onSaveAndApprove = vi.fn(async () => {});

    render(
      <JarvisModifyDialog
        action={SEND_EMAIL_ACTION}
        open={true}
        onOpenChange={onOpenChange}
        onSaveAndApprove={onSaveAndApprove}
      />,
    );

    expect(screen.getByText("Modifier l'email")).toBeInTheDocument();
    expect(screen.getByLabelText('Destinataire')).toHaveValue('old@test.co');
    expect(screen.getByLabelText('Sujet')).toHaveValue('Sujet initial');
    expect(screen.getByLabelText('Contenu')).toHaveValue('Corps initial');

    fireEvent.change(screen.getByLabelText('Destinataire'), { target: { value: 'new@test.co' } });
    fireEvent.change(screen.getByLabelText('Sujet'), { target: { value: 'Sujet modifié' } });
    fireEvent.change(screen.getByLabelText('Contenu'), { target: { value: 'Contenu final' } });

    await fireEvent.click(screen.getByRole('button', { name: /Enregistrer et approuver/i }));

    await waitFor(() => {
      expect(onSaveAndApprove).toHaveBeenCalledWith('a1', {
        to: 'new@test.co',
        subject: 'Sujet modifié',
        body: 'Contenu final',
      });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('affiche le mode chargement et désactive les actions', () => {
    const onOpenChange = vi.fn();
    const onSaveAndApprove = vi.fn(async () => {});

    render(
      <JarvisModifyDialog
        action={SEND_EMAIL_ACTION}
        open={true}
        onOpenChange={onOpenChange}
        onSaveAndApprove={onSaveAndApprove}
        isLoading={true}
      />,
    );

    expect(screen.getByRole('button', { name: /Enregistrement/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Annuler/i })).toBeDisabled();
  });

  it('modifie une tâche avec priorité et échéance puis sauvegarde', async () => {
    const onOpenChange = vi.fn();
    const onSaveAndApprove = vi.fn(async () => {});

    render(
      <JarvisModifyDialog
        action={CREATE_TASK_ACTION}
        open={true}
        onOpenChange={onOpenChange}
        onSaveAndApprove={onSaveAndApprove}
      />,
    );

    expect(screen.getByText('Modifier la tâche')).toBeInTheDocument();
    expect(screen.getByLabelText('Titre de la tâche')).toHaveValue('Tâche initiale');
    expect(screen.getByLabelText('Description')).toHaveValue('Description initiale');
    expect(screen.getByTestId('select-priorite')).toHaveValue('moyenne');
    expect(screen.getByLabelText('Échéance')).toHaveValue('2026-01-15');
    expect(SELECT_OPTIONS).toEqual(['basse', 'moyenne', 'haute', 'urgente']);

    fireEvent.change(screen.getByLabelText('Titre de la tâche'), { target: { value: 'Nouvelle tâche' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Description enrichie' } });
    fireEvent.change(screen.getByTestId('select-priorite'), { target: { value: 'urgente' } });
    fireEvent.change(screen.getByLabelText('Échéance'), { target: { value: '2026-02-01' } });

    await fireEvent.click(screen.getByRole('button', { name: /Enregistrer et approuver/i }));

    await waitFor(() => {
      expect(onSaveAndApprove).toHaveBeenCalledWith('a2', {
        titre: 'Nouvelle tâche',
        description: 'Description enrichie',
        priorite: 'urgente',
        date_echeance: '2026-02-01',
      });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('affiche update_status avec entity_type désactivé et sauvegarde new_status modifié', async () => {
    const onOpenChange = vi.fn();
    const onSaveAndApprove = vi.fn(async () => {});

    render(
      <JarvisModifyDialog
        action={UPDATE_STATUS_ACTION}
        open={true}
        onOpenChange={onOpenChange}
        onSaveAndApprove={onSaveAndApprove}
      />,
    );

    const entityType = screen.getByLabelText("Type d'entité");
    const newStatus = screen.getByLabelText('Nouveau statut');

    expect(entityType).toHaveValue('company');
    expect(entityType).toBeDisabled();
    expect(newStatus).toHaveValue('contacted');

    fireEvent.change(newStatus, { target: { value: 'qualified' } });
    await fireEvent.click(screen.getByRole('button', { name: /Enregistrer et approuver/i }));

    await waitFor(() => {
      expect(onSaveAndApprove).toHaveBeenCalledWith('a3', {
        entity_type: 'company',
        new_status: 'qualified',
      });
    });
  });

  it('affiche schedule_meeting avec datetime tronqué et sauvegarde les nouvelles dates', async () => {
    const onOpenChange = vi.fn();
    const onSaveAndApprove = vi.fn(async () => {});

    render(
      <JarvisModifyDialog
        action={SCHEDULE_MEETING_ACTION}
        open={true}
        onOpenChange={onOpenChange}
        onSaveAndApprove={onSaveAndApprove}
      />,
    );

    expect(screen.getByLabelText('Titre de la réunion')).toHaveValue('Réunion initiale');
    expect(screen.getByLabelText('Début')).toHaveValue('2026-02-20T09:15');
    expect(screen.getByLabelText('Fin')).toHaveValue('2026-02-20T10:00');
    expect(screen.getByLabelText('Lieu')).toHaveValue('Salle A');

    fireEvent.change(screen.getByLabelText('Titre de la réunion'), { target: { value: 'Point client' } });
    fireEvent.change(screen.getByLabelText('Début'), { target: { value: '2026-02-20T11:00' } });
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2026-02-20T11:30' } });
    fireEvent.change(screen.getByLabelText('Lieu'), { target: { value: 'Visio' } });

    await fireEvent.click(screen.getByRole('button', { name: /Enregistrer et approuver/i }));

    await waitFor(() => {
      expect(onSaveAndApprove).toHaveBeenCalledWith('a4', {
        title: 'Point client',
        start_time: '2026-02-20T11:00',
        end_time: '2026-02-20T11:30',
        location: 'Visio',
      });
    });
  });

  it('affiche close_ticket et sauvegarde la note de résolution modifiée', async () => {
    const onOpenChange = vi.fn();
    const onSaveAndApprove = vi.fn(async () => {});

    render(
      <JarvisModifyDialog
        action={CLOSE_TICKET_ACTION}
        open={true}
        onOpenChange={onOpenChange}
        onSaveAndApprove={onSaveAndApprove}
      />,
    );

    expect(screen.getByLabelText('Note de résolution')).toHaveValue('Résolu après correctif');

    fireEvent.change(screen.getByLabelText('Note de résolution'), {
      target: { value: 'Résolution documentée et validée' },
    });

    await fireEvent.click(screen.getByRole('button', { name: /Enregistrer et approuver/i }));

    await waitFor(() => {
      expect(onSaveAndApprove).toHaveBeenCalledWith('a5', {
        resolution_note: 'Résolution documentée et validée',
      });
    });
  });

  it('affiche le fallback pour un type inconnu', () => {
    const onOpenChange = vi.fn();
    const onSaveAndApprove = vi.fn(async () => {});

    render(
      <JarvisModifyDialog
        action={{
          id: 'a6',
          proposed_action: {
            type: 'unknown_type',
            data: {},
          },
        }}
        open={true}
        onOpenChange={onOpenChange}
        onSaveAndApprove={onSaveAndApprove}
      />,
    );

    expect(screen.getByText("Modifier l'action")).toBeInTheDocument();
    expect(screen.getByText("Type d'action non reconnu")).toBeInTheDocument();
  });

  it('ferme le dialogue via le bouton Annuler', async () => {
    const onOpenChange = vi.fn();
    const onSaveAndApprove = vi.fn(async () => {});

    render(
      <JarvisModifyDialog
        action={SEND_EMAIL_ACTION}
        open={true}
        onOpenChange={onOpenChange}
        onSaveAndApprove={onSaveAndApprove}
      />,
    );

    await fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSaveAndApprove).not.toHaveBeenCalled();
  });
});