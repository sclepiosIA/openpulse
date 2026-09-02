// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionalActionsDialog } from './TransactionalActionsDialog';

const {
  AUTH_STATE,
  TOAST_SUCCESS,
  TOAST_ERROR,
  ETABS_ROWS,
  DEFAULT_CALENDAR,
  INSERTED_CALENDAR,
  fromCalls,
  insertCalls,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'u@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const TOAST_SUCCESS = vi.fn();
  const TOAST_ERROR = vi.fn();

  const ETABS_ROWS = [
    { id: 'et1', nom: 'Alpha' },
    { id: 'et2', nom: 'Beta' },
  ];

  const DEFAULT_CALENDAR = { id: 'cal-1' };
  const INSERTED_CALENDAR = { id: 'cal-created' };

  const fromCalls: string[] = [];
  const insertCalls: Array<{ table: string; payload: unknown }> = [];

  const mockFrom = vi.fn((table: string) => {
    fromCalls.push(table);

    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let insertedPayload: unknown = null;
    let selectColumns = '';

    const resultForAwait = () => {
      if (mode === 'insert') {
        if (table === 'personal_todos') return Promise.resolve({ data: null, error: null });
        if (table === 'calendar_events') return Promise.resolve({ data: null, error: null });
        if (table === 'contacts') return Promise.resolve({ data: null, error: null });
        if (table === 'calendars') return Promise.resolve({ data: INSERTED_CALENDAR, error: null });
        return Promise.resolve({ data: null, error: null });
      }

      if (table === 'etablissements') {
        return Promise.resolve({ data: ETABS_ROWS, error: null });
      }

      if (table === 'calendars') {
        if (selectColumns === 'id') {
          return Promise.resolve({ data: DEFAULT_CALENDAR, error: null });
        }
      }

      return Promise.resolve({ data: [], error: null });
    };

    const builder = {
      select: vi.fn((columns?: string) => {
        selectColumns = columns ?? '';
        mode = 'select';
        return builder;
      }),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn((payload: unknown) => {
        mode = 'insert';
        insertedPayload = payload;
        insertCalls.push({ table, payload });
        return builder;
      }),
      update: vi.fn(() => {
        mode = 'update';
        return builder;
      }),
      delete: vi.fn(() => {
        mode = 'delete';
        return builder;
      }),
      single: vi.fn(() => resultForAwait()),
      maybeSingle: vi.fn(() => resultForAwait()),
      then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        resultForAwait().then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => resultForAwait().catch(onRejected),
    };

    return builder;
  });

  return {
    AUTH_STATE,
    TOAST_SUCCESS,
    TOAST_ERROR,
    ETABS_ROWS,
    DEFAULT_CALENDAR,
    INSERTED_CALENDAR,
    fromCalls,
    insertCalls,
    mockFrom,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: TOAST_SUCCESS,
    error: TOAST_ERROR,
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-root">{children}</div>,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h1 className={className}>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" data-variant={variant} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    className,
  }: {
    checked?: boolean;
    onCheckedChange?: () => void;
    className?: string;
  }) => (
    <input
      aria-label="checkbox"
      className={className}
      type="checkbox"
      checked={Boolean(checked)}
      onChange={() => onCheckedChange?.()}
    />
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
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
  }) => <div data-value={value} data-onchange={Boolean(onValueChange)}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-testid={`select-item-${value}`}>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  Loader2: (props: Record<string, unknown>) => <svg data-testid="loader" {...props} />,
  CalendarPlus: (props: Record<string, unknown>) => <svg data-testid="calendar-icon" {...props} />,
  ListChecks: (props: Record<string, unknown>) => <svg data-testid="tasks-icon" {...props} />,
  UserPlus: (props: Record<string, unknown>) => <svg data-testid="contacts-icon" {...props} />,
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('TransactionalActionsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCalls.length = 0;
    insertCalls.length = 0;
  });

  it('affiche les tâches et crée des todos avec les valeurs métier transformées', async () => {
    const onClose = vi.fn();

    renderWithClient(
      <TransactionalActionsDialog
        action="tasks"
        parsed={{
          tasks: [
            { title: 'Relancer client', due: '2025-03-10T12:00:00Z', priority: 'high', assignee: 'Ana' },
            { title: 'Préparer devis', due: null, priority: 'weird' },
          ],
        }}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Créer des tâches')).toBeInTheDocument();
    expect(screen.getByText('Relancer client')).toBeInTheDocument();
    expect(screen.getByText(/Échéance : 2025-03-10T12:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText(/Sans échéance/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Créer 2 éléments'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('personal_todos');
    });

    const todoInsert = insertCalls.find((call) => call.table === 'personal_todos');
    expect(todoInsert).toBeTruthy();
    expect(todoInsert?.payload).toEqual([
      {
        user_id: 'u1',
        title: 'Relancer client',
        due_date: '2025-03-10',
        priority: 'high',
        visibility: 'personal',
      },
      {
        user_id: 'u1',
        title: 'Préparer devis',
        due_date: null,
        priority: 'medium',
        visibility: 'personal',
      },
    ]);

    expect(TOAST_SUCCESS).toHaveBeenCalledWith('2 tâche(s) créée(s) dans Mon Todo');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('affiche les événements et crée des entrées agenda avec le calendrier utilisateur', async () => {
    const onClose = vi.fn();

    renderWithClient(
      <TransactionalActionsDialog
        action="events"
        parsed={{
          events: [
            {
              title: 'Démo produit',
              start: '2025-04-12T09:30:00Z',
              end: '2025-04-12T10:15:00Z',
              location: 'Salle A',
              description: 'Présentation',
            },
          ],
        }}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Créer des événements')).toBeInTheDocument();
    expect(screen.getByText('Démo produit')).toBeInTheDocument();
    expect(screen.getByText(/Salle A/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Créer 1 élément'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('calendars');
      expect(mockFrom).toHaveBeenCalledWith('calendar_events');
    });

    const eventInsert = insertCalls.find((call) => call.table === 'calendar_events');
    expect(eventInsert?.payload).toEqual([
      {
        calendar_id: 'cal-1',
        title: 'Démo produit',
        description: 'Présentation',
        location: 'Salle A',
        start_time: '2025-04-12T09:30:00.000Z',
        end_time: '2025-04-12T10:15:00.000Z',
        created_by: 'u1',
      },
    ]);

    expect(TOAST_SUCCESS).toHaveBeenCalledWith('1 événement(s) créé(s) dans l\'agenda');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('charge les établissements pour les contacts et affiche leurs options', async () => {
    const onClose = vi.fn();

    renderWithClient(
      <TransactionalActionsDialog
        action="contacts"
        parsed={{
          contacts: [
            { name: 'Marie Curie', email: 'm@c.fr', role: 'Direction', phone: '0102' },
          ],
        }}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Créer des contacts')).toBeInTheDocument();
    expect(screen.getByText('Établissement de rattachement')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('select-item-et1')).toBeInTheDocument();
      expect(screen.getByTestId('select-item-et2')).toBeInTheDocument();
    });

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('gère une erreur Supabase sur le chargement des établissements en laissant la requête en erreur', async () => {
    mockFrom.mockImplementationOnce((table: string) => {
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
        single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'x' } })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { message: 'x' } })),
        then: (onFulfilled: (value: { data: null; error: { message: string } }) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve({ data: null, error: { message: 'x' } }).then(onFulfilled, onRejected),
        catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'x' } }).catch(onRejected),
      };
      if (table === 'etablissements') return builder;
      return mockFrom.getMockImplementation()?.(table);
    });

    const onClose = vi.fn();

    renderWithClient(
      <TransactionalActionsDialog
        action="contacts"
        parsed={{
          contacts: [{ nom: 'Durand', prenom: 'Paul' }],
        }}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Créer des contacts')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('select-item-et1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('select-item-et2')).not.toBeInTheDocument();
    });
  });
});