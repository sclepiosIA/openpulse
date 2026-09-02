import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlansDeveloppement, usePlanActions } from './usePlansDeveloppement';

const {
  PLAN_ROWS,
  ACTION_ROWS,
  CREATED_PLAN,
  UPDATED_PLAN,
  CREATED_ACTION,
  UPDATED_ACTION,
  AUTH_STATE,
  toastSuccess,
  toastError,
  sanitizeSupabaseErrorMock,
  mockFrom,
} = vi.hoisted(() => ({
  PLAN_ROWS: [
    {
      id: 'plan-1',
      profile_id: 'profile-1',
      manager_id: 'manager-1',
      statut: 'en_cours',
      progression: 50,
      created_at: '2024-01-02',
      profile: { id: 'profile-1', nom: 'Doe', prenom: 'Jane' },
      manager: { id: 'manager-1', nom: 'Boss', prenom: 'John' },
    },
    {
      id: 'plan-2',
      profile_id: 'profile-2',
      manager_id: 'manager-1',
      statut: 'termine',
      progression: 100,
      created_at: '2024-01-01',
      profile: { id: 'profile-2', nom: 'Smith', prenom: 'Anna' },
      manager: { id: 'manager-1', nom: 'Boss', prenom: 'John' },
    },
  ],
  ACTION_ROWS: [
    {
      id: 'action-1',
      plan_id: 'plan-1',
      statut: 'a_faire',
      priorite: 1,
      date_prevue: '2024-02-01',
      competence: { id: 'comp-1', nom: 'React', categorie: 'tech' },
      certification: null,
    },
    {
      id: 'action-2',
      plan_id: 'plan-1',
      statut: 'en_cours',
      priorite: 2,
      date_prevue: '2024-02-10',
      competence: { id: 'comp-2', nom: 'TypeScript', categorie: 'tech' },
      certification: null,
    },
    {
      id: 'action-3',
      plan_id: 'plan-1',
      statut: 'termine',
      priorite: 3,
      date_prevue: '2024-02-20',
      competence: null,
      certification: { id: 'cert-1', nom: 'Cert A', organisme: 'Org' },
    },
    {
      id: 'action-4',
      plan_id: 'plan-1',
      statut: 'annule',
      priorite: 4,
      date_prevue: '2024-03-01',
      competence: null,
      certification: null,
    },
  ],
  CREATED_PLAN: {
    id: 'plan-created',
    profile_id: 'profile-9',
    manager_id: 'manager-1',
    statut: 'a_demarrer',
    progression: 0,
  },
  UPDATED_PLAN: {
    id: 'plan-1',
    statut: 'termine',
    progression: 100,
  },
  CREATED_ACTION: {
    id: 'action-created',
    plan_id: 'plan-1',
    statut: 'a_faire',
  },
  UPDATED_ACTION: {
    id: 'action-2',
    statut: 'termine',
  },
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  sanitizeSupabaseErrorMock: vi.fn((error: Error | { message?: string }) => error.message ?? 'sanitized error'),
  mockFrom: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
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

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type SupabaseResponse = { data: unknown; error: { message: string } | null };

function createThenableBuilder(config: {
  response?: SupabaseResponse;
  singleResponse?: SupabaseResponse;
  maybeSingleResponse?: SupabaseResponse;
}) {
  let currentResponse = config.response ?? { data: null, error: null };
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
    not: vi.fn(() => builder),
    single: vi.fn(async () => config.singleResponse ?? currentResponse),
    maybeSingle: vi.fn(async () => config.maybeSingleResponse ?? currentResponse),
    then: (onFulfilled: (value: SupabaseResponse) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(currentResponse).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(currentResponse).catch(onRejected),
  };
  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('usePlansDeveloppement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge les plans avec filtres puis expose les données métier', async () => {
    const plansBuilder = createThenableBuilder({
      response: { data: PLAN_ROWS, error: null },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'plans_developpement') return plansBuilder;
      return createThenableBuilder({ response: { data: [], error: null } });
    });

    const { result } = renderHook(
      () => usePlansDeveloppement({ profileId: 'profile-1', managerId: 'manager-1', statut: 'en_cours' }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.plans).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('plans_developpement');
    expect(plansBuilder.select).toHaveBeenCalled();
    expect(plansBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(plansBuilder.eq).toHaveBeenCalledWith('profile_id', 'profile-1');
    expect(plansBuilder.eq).toHaveBeenCalledWith('manager_id', 'manager-1');
    expect(plansBuilder.eq).toHaveBeenCalledWith('statut', 'en_cours');
    expect(result.current.error).toBeNull();
    expect(result.current.plans).toEqual(PLAN_ROWS);
    expect(result.current.plans[0].profile.prenom).toBe('Jane');
    expect(result.current.plans[1].progression).toBe(100);
  });

  it('remonte une erreur de chargement des plans', async () => {
    const plansBuilder = createThenableBuilder({
      response: { data: null, error: { message: 'x' } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'plans_developpement') return plansBuilder;
      return createThenableBuilder({ response: { data: [], error: null } });
    });

    const { result } = renderHook(() => usePlansDeveloppement(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.plans).toEqual([]);
    expect(result.current.error?.message).toBe('x');
  });

  it('crée, met à jour et supprime un plan avec invalidation et toasts', async () => {
    const plansQueryBuilder = createThenableBuilder({
      response: { data: PLAN_ROWS, error: null },
    });
    const createPlanBuilder = createThenableBuilder({
      singleResponse: { data: CREATED_PLAN, error: null },
    });
    const updatePlanBuilder = createThenableBuilder({
      singleResponse: { data: UPDATED_PLAN, error: null },
    });
    const deletePlanBuilder = createThenableBuilder({
      response: { data: null, error: null },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table !== 'plans_developpement') {
        return createThenableBuilder({ response: { data: [], error: null } });
      }

      const builder = createThenableBuilder({ response: { data: PLAN_ROWS, error: null } });

      builder.select = vi.fn((...args: unknown[]) => {
        if (createPlanBuilder.insert.mock.calls.length > 0 && createPlanBuilder.select.mock.calls.length === 0) {
          return createPlanBuilder;
        }
        if (updatePlanBuilder.update.mock.calls.length > 0 && updatePlanBuilder.select.mock.calls.length === 0) {
          return updatePlanBuilder;
        }
        return plansQueryBuilder;
      });

      builder.insert = vi.fn((payload: unknown) => {
        createPlanBuilder.insert(payload);
        return createPlanBuilder;
      });

      builder.update = vi.fn((payload: unknown) => {
        updatePlanBuilder.update(payload);
        return updatePlanBuilder;
      });

      builder.delete = vi.fn(() => deletePlanBuilder);

      return builder;
    });

    const { result } = renderHook(() => usePlansDeveloppement(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createPlan.mutateAsync({
        profile_id: 'profile-9',
        manager_id: 'manager-1',
        statut: 'a_demarrer',
      });
    });

    expect(createPlanBuilder.insert).toHaveBeenCalledWith({
      profile_id: 'profile-9',
      manager_id: 'manager-1',
      statut: 'a_demarrer',
    });
    expect(toastSuccess).toHaveBeenCalledWith('Plan de développement créé');

    await act(async () => {
      await result.current.updatePlan.mutateAsync({
        id: 'plan-1',
        statut: 'termine',
        progression: 100,
      });
    });

    expect(updatePlanBuilder.update).toHaveBeenCalledWith({
      statut: 'termine',
      progression: 100,
    });
    expect(updatePlanBuilder.eq).toHaveBeenCalledWith('id', 'plan-1');
    expect(toastSuccess).toHaveBeenCalledWith('Plan mis à jour');

    await act(async () => {
      await result.current.deletePlan.mutateAsync('plan-1');
    });

    expect(deletePlanBuilder.eq).toHaveBeenCalledWith('id', 'plan-1');
    expect(toastSuccess).toHaveBeenCalledWith('Plan supprimé');
  });

  it('affiche une erreur toastée quand la création échoue', async () => {
    const plansBuilder = createThenableBuilder({
      response: { data: PLAN_ROWS, error: null },
    });
    const createPlanBuilder = createThenableBuilder({
      singleResponse: { data: null, error: { message: 'x' } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table !== 'plans_developpement') {
        return createThenableBuilder({ response: { data: [], error: null } });
      }

      const builder = createThenableBuilder({ response: { data: PLAN_ROWS, error: null } });
      builder.select = vi.fn(() => plansBuilder);
      builder.insert = vi.fn((payload: unknown) => {
        createPlanBuilder.insert(payload);
        return createPlanBuilder;
      });
      return builder;
    });

    const { result } = renderHook(() => usePlansDeveloppement(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(
        result.current.createPlan.mutateAsync({
          profile_id: 'profile-9',
        })
      ).rejects.toMatchObject({ message: 'x' });
    });

    expect(sanitizeSupabaseErrorMock).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('x');
  });
});

describe('usePlanActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge les actions et calcule les statistiques métier', async () => {
    const actionsBuilder = createThenableBuilder({
      response: { data: ACTION_ROWS, error: null },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'plan_developpement_actions') return actionsBuilder;
      return createThenableBuilder({ response: { data: [], error: null } });
    });

    const { result } = renderHook(() => usePlanActions('plan-1'), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.actions).toEqual([]);
    expect(result.current.stats).toEqual({
      total: 0,
      aFaire: 0,
      enCours: 0,
      terminees: 0,
      annulees: 0,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('plan_developpement_actions');
    expect(actionsBuilder.eq).toHaveBeenCalledWith('plan_id', 'plan-1');
    expect(actionsBuilder.order).toHaveBeenNthCalledWith(1, 'priorite', { ascending: true });
    expect(actionsBuilder.order).toHaveBeenNthCalledWith(2, 'date_prevue', { ascending: true });
    expect(result.current.actions).toEqual(ACTION_ROWS);
    expect(result.current.stats).toEqual({
      total: 4,
      aFaire: 1,
      enCours: 1,
      terminees: 1,
      annulees: 1,
    });
  });

  it('remonte une erreur de chargement des actions', async () => {
    const actionsBuilder = createThenableBuilder({
      response: { data: null, error: { message: 'x' } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'plan_developpement_actions') return actionsBuilder;
      return createThenableBuilder({ response: { data: [], error: null } });
    });

    const { result } = renderHook(() => usePlanActions('plan-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.actions).toEqual([]);
    expect(result.current.error?.message).toBe('x');
  });

  it('crée, met à jour et supprime une action en mettant à jour la progression du plan', async () => {
    const initialActionsBuilder = createThenableBuilder({
      response: { data: ACTION_ROWS, error: null },
    });
    const createActionBuilder = createThenableBuilder({
      singleResponse: { data: CREATED_ACTION, error: null },
    });
    const updateActionBuilder = createThenableBuilder({
      singleResponse: { data: UPDATED_ACTION, error: null },
    });
    const deleteActionBuilder = createThenableBuilder({
      response: { data: null, error: null },
    });
    const progressionSelectBuilder = createThenableBuilder({
      response: {
        data: [
          { statut: 'termine' },
          { statut: 'termine' },
          { statut: 'en_cours' },
        ],
        error: null,
      },
    });
    const progressionUpdateBuilder = createThenableBuilder({
      response: { data: null, error: null },
    });
    const plansQueryBuilder = createThenableBuilder({
      response: { data: PLAN_ROWS, error: null },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'plan_developpement_actions') {
        const builder = createThenableBuilder({ response: { data: ACTION_ROWS, error: null } });

        builder.select = vi.fn((arg?: string) => {
          if (arg === 'statut') return progressionSelectBuilder;
          if (createActionBuilder.insert.mock.calls.length > 0 && createActionBuilder.select.mock.calls.length === 0) {
            return createActionBuilder;
          }
          if (updateActionBuilder.update.mock.calls.length > 0 && updateActionBuilder.select.mock.calls.length === 0) {
            return updateActionBuilder;
          }
          return initialActionsBuilder;
        });

        builder.insert = vi.fn((payload: unknown) => {
          createActionBuilder.insert(payload);
          return createActionBuilder;
        });

        builder.update = vi.fn((payload: unknown) => {
          updateActionBuilder.update(payload);
          return updateActionBuilder;
        });

        builder.delete = vi.fn(() => deleteActionBuilder);

        return builder;
      }

      if (table === 'plans_developpement') {
        const builder = createThenableBuilder({ response: { data: PLAN_ROWS, error: null } });
        builder.select = vi.fn(() => plansQueryBuilder);
        builder.update = vi.fn((payload: unknown) => {
          progressionUpdateBuilder.update(payload);
          return progressionUpdateBuilder;
        });
        return builder;
      }

      return createThenableBuilder({ response: { data: [], error: null } });
    });

    const { result } = renderHook(() => usePlanActions('plan-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createAction.mutateAsync({
        plan_id: 'plan-1',
        statut: 'a_faire',
      });
    });

    expect(createActionBuilder.insert).toHaveBeenCalledWith({
      plan_id: 'plan-1',
      statut: 'a_faire',
    });
    expect(progressionSelectBuilder.eq).toHaveBeenCalledWith('plan_id', 'plan-1');
    expect(progressionSelectBuilder.not).toHaveBeenCalledWith('statut', 'eq', 'annule');
    expect(progressionSelectBuilder.limit).toHaveBeenCalledWith(100);
    expect(progressionUpdateBuilder.update).toHaveBeenCalledWith({ progression: 67 });
    expect(progressionUpdateBuilder.eq).toHaveBeenCalledWith('id', 'plan-1');
    expect(toastSuccess).toHaveBeenCalledWith('Action ajoutée');

    await act(async () => {
      await result.current.updateAction.mutateAsync({
        id: 'action-2',
        statut: 'termine',
      });
    });

    expect(updateActionBuilder.update).toHaveBeenCalledWith({ statut: 'termine' });
    expect(updateActionBuilder.eq).toHaveBeenCalledWith('id', 'action-2');
    expect(toastSuccess).toHaveBeenCalledWith('Action mise à jour');

    await act(async () => {
      await result.current.deleteAction.mutateAsync('action-2');
    });

    expect(deleteActionBuilder.eq).toHaveBeenCalledWith('id', 'action-2');
    expect(toastSuccess).toHaveBeenCalledWith('Action supprimée');
  });

  it('toast une erreur quand la mutation action échoue', async () => {
    const actionsBuilder = createThenableBuilder({
      response: { data: ACTION_ROWS, error: null },
    });
    const createActionBuilder = createThenableBuilder({
      singleResponse: { data: null, error: { message: 'x' } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'plan_developpement_actions') {
        const builder = createThenableBuilder({ response: { data: ACTION_ROWS, error: null } });
        builder.select = vi.fn(() => actionsBuilder);
        builder.insert = vi.fn((payload: unknown) => {
          createActionBuilder.insert(payload);
          return createActionBuilder;
        });
        return builder;
      }
      return createThenableBuilder({ response: { data: [], error: null } });
    });

    const { result } = renderHook(() => usePlanActions('plan-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(
        result.current.createAction.mutateAsync({
          plan_id: 'plan-1',
          statut: 'a_faire',
        })
      ).rejects.toMatchObject({ message: 'x' });
    });

    expect(sanitizeSupabaseErrorMock).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('x');
  });
});