// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TaskCreatorModal } from './TaskCreatorModal';

const {
  TEAM_MEMBERS,
  CURRENT_PROFILE,
  CREATED_TASK,
  toastSuccess,
  toastError,
  mockMutate,
  mockUseCurrentProfile,
  mockUsePulseTaskCreate,
  mockFrom,
  mockOnOpenChange,
  mockOnTaskCreated,
  queryState,
} = vi.hoisted(() => ({
  TEAM_MEMBERS: [
    { id: 'p2', nom: 'Durand', prenom: 'Alice' },
    { id: 'p3', nom: 'Martin', prenom: 'Bob' },
  ],
  CURRENT_PROFILE: { id: 'p1', nom: 'Owner', prenom: 'Jane' },
  CREATED_TASK: { id: 'task1', titre: 'Nouvelle tâche' },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  mockMutate: vi.fn(),
  mockUseCurrentProfile: vi.fn(),
  mockUsePulseTaskCreate: vi.fn(),
  mockFrom: vi.fn(),
  mockOnOpenChange: vi.fn(),
  mockOnTaskCreated: vi.fn(),
  queryState: {
    mode: 'success' as 'loading' | 'success' | 'error',
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}));

vi.mock('@/hooks/calendar/useCalendarEventActions', () => ({
  usePulseTaskCreate: mockUsePulseTaskCreate,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => {
      if (queryState.mode === 'loading') {
        return new Promise(() => undefined);
      }
      if (queryState.mode === 'error') {
        return Promise.resolve({ data: null, error: { message: 'x' } });
      }
      return Promise.resolve({ data: TEAM_MEMBERS, error: null });
    }),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (
      onFulfilled?: (value: { data: typeof TEAM_MEMBERS | null; error: { message: string } | null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => {
      if (queryState.mode === 'loading') {
        return new Promise(() => undefined).then(onFulfilled, onRejected);
      }
      if (queryState.mode === 'error') {
        return Promise.resolve({ data: null, error: { message: 'x' } }).then(onFulfilled, onRejected);
      }
      return Promise.resolve({ data: TEAM_MEMBERS, error: null }).then(onFulfilled, onRejected);
    },
    catch: (onRejected?: (reason: unknown) => unknown) => {
      if (queryState.mode === 'error') {
        return Promise.reject({ message: 'x' }).catch(onRejected);
      }
      return Promise.resolve({ data: TEAM_MEMBERS, error: null }).catch(onRejected);
    },
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('lucide-react', () => ({
  CheckSquare: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="check-icon" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  Calendar: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="calendar-icon" {...props} />,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    autoFocus,
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    autoFocus?: boolean;
  }) => <input id={id} value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    id,
    value,
    onChange,
    placeholder,
    rows,
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    rows?: number;
  }) => <textarea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
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
    const items: Array<{ value: string; label: string }> = [];
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const childProps = child.props as { children?: React.ReactNode };
      React.Children.forEach(childProps.children, (grandChild) => {
        if (!React.isValidElement(grandChild)) return;
        const grandChildProps = grandChild.props as { value?: string; children?: React.ReactNode };
        if (typeof grandChildProps.value === 'string') {
          const text = React.Children.toArray(grandChildProps.children).join('');
          items.push({ value: grandChildProps.value, label: text });
        }
      });
    });

    return (
      <select aria-label="select" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
        <option value=""></option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    );
  },
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { value: string; children: React.ReactNode }) => <>{children}</>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    onSelect,
    selected,
  }: {
    mode?: string;
    selected?: Date;
    onSelect?: (date: Date | undefined) => void;
    locale?: unknown;
    initialFocus?: boolean;
  }) => (
    <div>
      <div data-testid="calendar-selected">{selected ? selected.toISOString().slice(0, 10) : 'none'}</div>
      <button type="button" onClick={() => onSelect?.(new Date('2025-03-15T00:00:00.000Z'))}>
        pick-date
      </button>
    </div>
  ),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const client = createQueryClient();

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function renderModal() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <TaskCreatorModal
        open={true}
        onOpenChange={mockOnOpenChange}
        conversationId="conv1"
        onTaskCreated={mockOnTaskCreated}
      />
    </QueryClientProvider>
  );
}

describe('TaskCreatorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryState.mode = 'success';

    mockUseCurrentProfile.mockReturnValue({
      data: CURRENT_PROFILE,
      isLoading: false,
      isError: false,
    });

    mockUsePulseTaskCreate.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    mockMutate.mockImplementation(
      (
        _payload: {
          titre: string;
          description: string;
          priorite: string;
          echeance: string | null;
          responsable_id: string;
        },
        options?: { onSuccess?: (data: typeof CREATED_TASK) => void }
      ) => {
        options?.onSuccess?.(CREATED_TASK);
      }
    );
  });

  it('passe par loading puis success pour la query des membres et retourne les données métier stables', async () => {
    queryState.mode = 'loading';
    const wrapper = createWrapper();

    const { result, rerender } = renderHook(
      () =>
        useQuery({
          queryKey: ['profiles-for-assignment-hook'],
          queryFn: async () => {
            const { supabase } = await import('@/integrations/supabase/client');
            const { data, error } = await supabase.from('profiles').select('id, nom, prenom').order('nom');
            if (error) throw error;
            return data || [];
          },
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.fetchStatus).toBe('fetching');

    queryState.mode = 'success';
    rerender();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(TEAM_MEMBERS);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  it('affiche les membres assignables et crée une tâche avec les valeurs métier attendues', async () => {
    renderModal();

    expect(screen.getByText('Créer une tâche')).toBeInTheDocument();
    expect(screen.getByText('La tâche sera automatiquement liée à votre message')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alice Durand')).toBeInTheDocument();
      expect(screen.getByText('Bob Martin')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Titre *');
    const descriptionInput = screen.getByLabelText('Description');
    const selects = screen.getAllByLabelText('select');

    fireEvent.change(titleInput, { target: { value: '  Nouvelle tâche  ' } });
    fireEvent.change(descriptionInput, { target: { value: '  Détails utiles  ' } });
    fireEvent.change(selects[0], { target: { value: 'urgente' } });
    fireEvent.click(screen.getByText('pick-date'));
    fireEvent.change(selects[1], { target: { value: 'p2' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Créer'));
    });

    expect(mockMutate).toHaveBeenCalledWith(
      {
        titre: 'Nouvelle tâche',
        description: 'Détails utiles',
        priorite: 'Critique',
        echeance: '2025-03-15',
        responsable_id: 'p2',
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    );
    expect(toastSuccess).toHaveBeenCalledWith('Tâche créée');
    expect(mockOnTaskCreated).toHaveBeenCalledWith(CREATED_TASK);

    await waitFor(() => {
      expect(titleInput).toHaveValue('');
      expect(descriptionInput).toHaveValue('');
    });

    expect(screen.getByTestId('calendar-selected')).toHaveTextContent('none');
  });

  it('utilise la description par défaut, la priorité normale et le profil courant si aucun assigné', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText('Titre *'), { target: { value: 'Tâche simple' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Créer'));
    });

    expect(mockMutate).toHaveBeenCalledWith(
      {
        titre: 'Tâche simple',
        description: 'Créée depuis Pulse',
        priorite: 'Normale',
        echeance: null,
        responsable_id: 'p1',
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    );
  });

  it('empêche la création sans titre et sans profil courant', async () => {
    mockUseCurrentProfile.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });

    renderModal();

    await act(async () => {
      fireEvent.click(screen.getByText('Créer'));
    });

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('désactive le bouton pendant la mutation et affiche le loader', () => {
    mockUsePulseTaskCreate.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    });

    renderModal();

    const createButton = screen.getByText('Créer').closest('button');
    expect(createButton).toBeDisabled();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('ferme via Annuler, appelle onOpenChange(false) et réinitialise le formulaire', async () => {
    renderModal();

    const titleInput = screen.getByLabelText('Titre *');
    const descriptionInput = screen.getByLabelText('Description');

    fireEvent.change(titleInput, { target: { value: 'À effacer' } });
    fireEvent.change(descriptionInput, { target: { value: 'Texte' } });

    fireEvent.click(screen.getByText('Annuler'));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(titleInput).toHaveValue('');
    expect(descriptionInput).toHaveValue('');
  });

  it('remonte une erreur de query quand supabase renvoie { data:null, error:{ message:"x" } }', async () => {
    queryState.mode = 'error';
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['profiles-for-assignment-error'],
          queryFn: async () => {
            const { supabase } = await import('@/integrations/supabase/client');
            const { data, error } = await supabase.from('profiles').select('id, nom, prenom').order('nom');
            if (error) throw error;
            return data || [];
          },
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: 'x' });
  });
});