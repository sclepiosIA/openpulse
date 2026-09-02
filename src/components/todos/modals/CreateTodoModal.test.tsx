import React from 'react';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Stable hoisted mocks and shared state (must be hoisted for stable references)
const {
  MOCK_PROJECTS,
  MOCK_ETABS,
  MOCK_PROFILES,
  MOCK_RD_STORIES,
  MOCK_SUPPORT_TICKETS,
  projectsStateRef,
  etablissementsStateRef,
  profilesStateRef,
  rdStoriesStateRef,
  supportTicketsStateRef,
  createTodoStateRef,
  toastFns,
  supabaseMocks,
} = vi.hoisted(() => {
  const MOCK_PROJECTS = [{ id: 'p1', name: 'Projet A', color: '#000000' }];
  const MOCK_ETABS = [{ id: 'e1', nom: 'Etablissement 1' }];
  const MOCK_PROFILES = [{ id: 'u1', prenom: 'Jean', nom: 'Dupont' }];
  const MOCK_RD_STORIES = [{ id: 's1', titre: 'User Story 1', projet_nom: 'Projet A' }];
  const MOCK_SUPPORT_TICKETS = [{ id: 't1', numero_ticket: 'T-123', titre: 'Ticket 1' }];

  const projectsStateRef = { current: { data: MOCK_PROJECTS, isLoading: false, isError: false, error: null } };
  const etablissementsStateRef = { current: { data: MOCK_ETABS, isLoading: false, isError: false, error: null } };
  const profilesStateRef = { current: { data: MOCK_PROFILES, isLoading: false, isError: false, error: null } };
  const rdStoriesStateRef = { current: { data: MOCK_RD_STORIES, isLoading: false, isError: false, error: null } };
  const supportTicketsStateRef = { current: { data: MOCK_SUPPORT_TICKETS, isLoading: false, isError: false, error: null } };

  const mutateAsyncSuccess = vi.fn(async (payload) => ({ id: 'newtodo', ...payload }));
  const mutateAsyncReject = vi.fn(async () => { throw { message: 'mutation failed' }; });

  const createTodoStateRef = { current: { mutateAsync: mutateAsyncSuccess, isPending: false } };

  const toastError = vi.fn();
  const toastSuccess = vi.fn();

  // Supabase builder mock (chainable & thenable)
  const builder = {
    _res: null,
    select() { return this; },
    eq() { return this; },
    gte() { return this; },
    lte() { return this; },
    in() { return this; },
    order() { return this; },
    limit() { return this; },
    insert() { return this; },
    update() { return this; },
    delete() { return this; },
    single() {
      return Promise.resolve(this._res);
    },
    maybeSingle() {
      return Promise.resolve(this._res);
    },
    then(onFulfilled: any) {
      return Promise.resolve(this._res).then(onFulfilled);
    },
    catch(onRejected: any) {
      return Promise.resolve(this._res).catch(onRejected);
    },
  };

  const mockFrom = vi.fn(() => builder);
  const supabaseMocks = { mockFrom, builder };

  return {
    MOCK_PROJECTS,
    MOCK_ETABS,
    MOCK_PROFILES,
    MOCK_RD_STORIES,
    MOCK_SUPPORT_TICKETS,
    projectsStateRef,
    etablissementsStateRef,
    profilesStateRef,
    rdStoriesStateRef,
    supportTicketsStateRef,
    createTodoStateRef,
    toastFns: { toastError, toastSuccess },
    supabaseMocks,
  };
});

// Mock supabase client per rules
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: supabaseMocks.mockFrom,
      auth: { user: vi.fn() },
    },
  };
});

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: toastFns.toastError,
    success: toastFns.toastSuccess,
  },
}));

// Mock hooks used by the component returning stable refs
vi.mock('@/hooks/tasks/usePersonalTodos', () => ({
  useCreatePersonalTodo: () => createTodoStateRef.current,
}));

vi.mock('@/hooks/tasks/useTodoProjects', () => ({
  useTodoProjects: () => projectsStateRef.current,
}));

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: () => etablissementsStateRef.current,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useActiveProfiles: () => profilesStateRef.current,
}));

vi.mock('@/hooks/rd/useRDUserStoriesSelect', () => ({
  useRDUserStoriesSelect: () => rdStoriesStateRef.current,
}));

vi.mock('@/hooks/support/useSupportTicketsSelect', () => ({
  useSupportTicketsSelect: () => supportTicketsStateRef.current,
}));

// Mock utility cn to just join truthy args with space
vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

// Mock lucide-react icons as simple spans to avoid DOM noise
vi.mock('lucide-react', () => {
  const Icon = ({ children }: any) => /*#__PURE__*/ React.createElement('span', null, children || '');
  return {
    CalendarIcon: Icon,
    Flag: Icon,
    Building2: Icon,
    Loader2: Icon,
    User: Icon,
    Users: Icon,
    ChevronDown: Icon,
    Link2: Icon,
    Lightbulb: Icon,
    Headphones: Icon,
  };
});

// Mock UI primitives to simple accessible elements with basic behaviors

vi.mock('@/components/ui/dialog', () => {
  const Dialog = ({ children, onOpenChange, open }: any) => /*#__PURE__*/ React.createElement('div', { 'data-testid': 'dialog', 'data-open': open ? 'true' : 'false' }, children);
  const DialogContent = ({ children, ...props }: any) => /*#__PURE__*/ React.createElement('div', { ...props }, children);
  const DialogHeader = ({ children }: any) => /*#__PURE__*/ React.createElement('div', null, children);
  const DialogTitle = ({ children }: any) => /*#__PURE__*/ React.createElement('h1', null, children);
  const DialogFooter = ({ children }: any) => /*#__PURE__*/ React.createElement('div', null, children);
  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
});

vi.mock('@/components/ui/button', () => {
  return {
    Button: ({ children, ...props }: any) => /*#__PURE__*/ React.createElement('button', { ...props }, children),
  };
});

vi.mock('@/components/ui/input', () => {
  return {
    Input: ({ id, value, onChange, placeholder, autoFocus, className, ...props }: any) =>
      /*#__PURE__*/ React.createElement('input', {
        id,
        value,
        onChange,
        placeholder,
        'data-testid': id || 'input',
        autoFocus,
        className,
        ...props,
      }),
  };
});

vi.mock('@/components/ui/textarea', () => {
  return {
    Textarea: ({ id, value, onChange, placeholder, ...props }: any) =>
      /*#__PURE__*/ React.createElement('textarea', { id, value, onChange, placeholder, 'data-testid': id || 'textarea', ...props }),
  };
});

vi.mock('@/components/ui/label', () => {
  return {
    Label: ({ children, htmlFor, ...props }: any) => /*#__PURE__*/ React.createElement('label', { htmlFor, ...props }, children),
  };
});

vi.mock('@/components/ui/calendar', () => {
  return {
    Calendar: ({ mode, selected, onSelect }: any) =>
      /*#__PURE__*/ React.createElement('input', {
        type: 'date',
        'data-testid': 'calendar',
        value: selected ? selected.toISOString().slice(0, 10) : '',
        onChange: (e: any) => onSelect(new Date(e.target.value)),
      }),
  };
});

// RadioGroup with context to allow RadioGroupItem to call onValueChange
vi.mock('@/components/ui/radio-group', () => {
  const ReactLocal = React;
  const RadioContext = ReactLocal.createContext<any>(null);

  const RadioGroup = ({ value, onValueChange, children, ...props }: any) =>
    /*#__PURE__*/ ReactLocal.createElement(RadioContext.Provider, { value: { value, onValueChange } }, /*#__PURE__*/ ReactLocal.createElement('div', { ...props }, children));

  const RadioGroupItem = ({ value, id }: any) =>
    /*#__PURE__*/ ReactLocal.createElement(RadioContext.Consumer, null, (ctx) =>
      /*#__PURE__*/ ReactLocal.createElement('input', {
        type: 'radio',
        id,
        value,
        checked: ctx?.value === value,
        onChange: () => ctx?.onValueChange(value),
        'data-testid': id || `radio-${value}`,
      }),
    );

  return { RadioGroup, RadioGroupItem };
});

// Select implementation with context so SelectItem can trigger onValueChange
vi.mock('@/components/ui/select', () => {
  const ReactLocal = React;
  const SelectContext = ReactLocal.createContext<any>(null);

  const Select = ({ value, onValueChange, children }: any) =>
    /*#__PURE__*/ ReactLocal.createElement(SelectContext.Provider, { value: { value, onValueChange } }, /*#__PURE__*/ ReactLocal.createElement('div', null, children));

  const SelectTrigger = ({ children, ...props }: any) => /*#__PURE__*/ ReactLocal.createElement('button', { type: 'button', ...props }, children);
  const SelectValue = ({ placeholder }: any) => /*#__PURE__*/ ReactLocal.createElement('span', null, placeholder || '');
  const SelectContent = ({ children }: any) => /*#__PURE__*/ ReactLocal.createElement('div', null, children);
  const SelectItem = ({ value, children }: any) =>
    /*#__PURE__*/ ReactLocal.createElement(SelectContext.Consumer, null, (ctx) =>
      /*#__PURE__*/ ReactLocal.createElement('button', {
        type: 'button',
        'data-value': value,
        onClick: () => ctx?.onValueChange(value),
      }, children),
    );

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

vi.mock('@/components/ui/popover', () => {
  return {
    Popover: ({ children }: any) => /*#__PURE__*/ React.createElement('div', null, children),
    PopoverContent: ({ children }: any) => /*#__PURE__*/ React.createElement('div', null, children),
    PopoverTrigger: ({ children, asChild }: any) => (asChild ? children : /*#__PURE__*/ React.createElement('div', null, children)),
  };
});

vi.mock('@/components/ui/collapsible', () => {
  return {
    Collapsible: ({ children, open, onOpenChange }: any) => /*#__PURE__*/ React.createElement('div', null, children),
    CollapsibleContent: ({ children }: any) => /*#__PURE__*/ React.createElement('div', null, children),
    CollapsibleTrigger: ({ children, asChild }: any) => (asChild ? children : /*#__PURE__*/ React.createElement('div', null, children)),
  };
});

// Now import the component under test (after mocks)
import { CreateTodoModal } from './CreateTodoModal';
import { useTodoProjects } from '@/hooks/tasks/useTodoProjects';

describe('CreateTodoModal', () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  const Wrapper = ({ children }: any) => {
    const qc = createQueryClient();
    return /*#__PURE__*/ React.createElement(QueryClientProvider, { client: qc }, children);
  };

  afterEach(() => {
    // Reset shared states to defaults
    projectsStateRef.current = { data: MOCK_PROJECTS, isLoading: false, isError: false, error: null };
    etablissementsStateRef.current = { data: MOCK_ETABS, isLoading: false, isError: false, error: null };
    profilesStateRef.current = { data: MOCK_PROFILES, isLoading: false, isError: false, error: null };
    rdStoriesStateRef.current = { data: MOCK_RD_STORIES, isLoading: false, isError: false, error: null };
    supportTicketsStateRef.current = { data: MOCK_SUPPORT_TICKETS, isLoading: false, isError: false, error: null };
    createTodoStateRef.current = { mutateAsync: createTodoStateRef.current.mutateAsync, isPending: false };
    vi.clearAllMocks();
  });

  it('renders options and calls mutateAsync with expected payload on submit', async () => {
    // Ensure createTodo mutateAsync is the success mock and not pending
    const spyMutate = vi.fn(async (payload) => ({ id: 'newtodo', ...payload }));
    createTodoStateRef.current = { mutateAsync: spyMutate, isPending: false };

    const onOpenChange = vi.fn();

    // Render component with defaults for project and etablissement
    await act(async () => {
      render(
        /*#__PURE__*/ React.createElement(Wrapper, null,
          /*#__PURE__*/ React.createElement(CreateTodoModal, { open: true, onOpenChange, defaultProjectId: 'p1', defaultEtablissementId: 'e1' })
        ),
      );
    });

    // Title input should be present; type a title
    const titleInput = screen.getByTestId('title') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: '  Ma tâche  ' } });
    });

    // Description
    const desc = screen.getByTestId('description') as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(desc, { target: { value: ' Détails ' } });
    });

    // Submit button - find by type=submit
    const submitButton = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('type') === 'submit');
    expect(submitButton).toBeTruthy();

    // Click submit and await mutation
    await act(async () => {
      (submitButton as HTMLButtonElement).click();
    });

    // Assert mutateAsync called once with trimmed values and defaults
    expect(spyMutate).toHaveBeenCalledTimes(1);
    const calledWith = spyMutate.mock.calls[0][0];
    expect(calledWith).toMatchObject({
      title: 'Ma tâche',
      description: 'Détails',
      project_id: 'p1',
      etablissement_id: 'e1',
      priority: 'medium',
      assigned_to: null,
      rd_user_story_id: null,
      support_ticket_id: null,
      visibility: 'personal',
    });

    // onOpenChange should be called with false to close
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables submit when title is empty or when mutation is pending', async () => {
    const onOpenChange = vi.fn();

    // Case 1: no title -> submit disabled
    await act(async () => {
      render(
        /*#__PURE__*/ React.createElement(Wrapper, null,
          /*#__PURE__*/ React.createElement(CreateTodoModal, { open: true, onOpenChange })
        ),
      );
    });

    const submitButton1 = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('type') === 'submit') as HTMLButtonElement;
    // Title empty by default -> disabled
    expect(submitButton1.disabled).toBe(true);

    // Case 2: mutation pending disables regardless of title
    createTodoStateRef.current = { mutateAsync: createTodoStateRef.current.mutateAsync, isPending: true };

    // Rerender component to pick up isPending change
    await act(async () => {
      render(
        /*#__PURE__*/ React.createElement(Wrapper, null,
          /*#__PURE__*/ React.createElement(CreateTodoModal, { open: true, onOpenChange })
        ),
      );
    });

    const submitButton2 = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('type') === 'submit') as HTMLButtonElement;
    expect(submitButton2.disabled).toBe(true);
  });

  it('renderHook with QueryClientProvider: projects hook loading -> success -> error states', async () => {
    const client = createQueryClient();
    const wrapper = ({ children }: any) => /*#__PURE__*/ React.createElement(QueryClientProvider, { client }, children);

    // Loading state
    projectsStateRef.current = { data: null, isLoading: true, isError: false, error: null };
    const hookResultLoading = renderHook(() => useTodoProjects(), { wrapper });
    expect(hookResultLoading.result.current.isLoading).toBe(true);
    expect(hookResultLoading.result.current.data).toBeNull();

    // Success state
    projectsStateRef.current = { data: MOCK_PROJECTS, isLoading: false, isError: false, error: null };
    const hookResultSuccess = renderHook(() => useTodoProjects(), { wrapper });
    expect(hookResultSuccess.result.current.isLoading).toBe(false);
    expect(Array.isArray(hookResultSuccess.result.current.data)).toBe(true);
    expect(hookResultSuccess.result.current.data[0]).toMatchObject({ id: 'p1', name: 'Projet A' });

    // Error state
    projectsStateRef.current = { data: null, isLoading: false, isError: true, error: { message: 'fetch failed' } };
    const hookResultError = renderHook(() => useTodoProjects(), { wrapper });
    expect(hookResultError.result.current.isError).toBe(true);
    expect(hookResultError.result.current.error).toMatchObject({ message: 'fetch failed' });
  });
});