// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useCsmPlaybooks,
  useCsmPlaybookSteps,
  useCsmPlaybookExecutions,
  useCsmPlaybookExecutionsByEtablissement,
  useCsmPlaybookDashboard,
  useUpsertPlaybook,
  useDeletePlaybook,
  useUpsertPlaybookStep,
  useDeletePlaybookStep,
  useEvaluatePlaybooksForEtablissement,
  useRunPlaybookEngine,
} from './useCsmPlaybooks';

const {
  PLAYBOOKS,
  STEPS,
  EXECUTIONS,
  ETAB_EXECUTIONS,
  DASHBOARD,
  UPSERTED_PLAYBOOK,
  UPSERTED_STEP,
  ENGINE_RESULT,
  mockFrom,
  mockRpc,
  mockInvoke,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  PLAYBOOKS: [
    {
      id: 'pb-1',
      name: 'Onboarding sensible',
      description: 'Séquence initiale',
      is_active: true,
      priority: 1,
      trigger_config: { segment: 'new' },
      cooldown_days: 7,
      category: 'onboarding',
      created_at: '2024-01-02T10:00:00Z',
      updated_at: '2024-01-03T10:00:00Z',
    },
    {
      id: 'pb-2',
      name: 'Relance risque',
      description: null,
      is_active: false,
      priority: 2,
      trigger_config: { health: 'risk' },
      cooldown_days: 14,
      category: 'retention',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-04T10:00:00Z',
    },
  ],
  STEPS: [
    {
      id: 'st-1',
      playbook_id: 'pb-1',
      step_order: 1,
      step_type: 'create_task',
      config: { title: 'Appeler le client' },
      delay_days: 0,
    },
    {
      id: 'st-2',
      playbook_id: 'pb-1',
      step_order: 2,
      step_type: 'send_email',
      config: { template: 'welcome' },
      delay_days: 2,
    },
  ],
  EXECUTIONS: [
    {
      id: 'ex-1',
      playbook_id: 'pb-1',
      etablissement_id: 'et-1',
      status: 'running',
      current_step_order: 1,
      next_action_at: '2024-02-01T09:00:00Z',
      started_at: '2024-01-31T09:00:00Z',
      completed_at: null,
      trigger_context: { source: 'score' },
      last_error: null,
    },
    {
      id: 'ex-2',
      playbook_id: 'pb-2',
      etablissement_id: 'et-2',
      status: 'completed',
      current_step_order: 2,
      next_action_at: null,
      started_at: '2024-01-20T09:00:00Z',
      completed_at: '2024-01-22T09:00:00Z',
      trigger_context: { source: 'manual' },
      last_error: null,
    },
  ],
  ETAB_EXECUTIONS: [
    {
      id: 'ex-3',
      playbook_id: 'pb-1',
      etablissement_id: 'et-42',
      status: 'pending',
      current_step_order: 1,
      next_action_at: '2024-02-05T09:00:00Z',
      started_at: '2024-02-01T09:00:00Z',
      completed_at: null,
      trigger_context: { source: 'etab' },
      last_error: null,
    },
  ],
  DASHBOARD: {
    total_playbooks: 2,
    active_playbooks: 1,
    pending_executions: 3,
    completed_30d: 5,
    failed_30d: 1,
    next_actions: [
      {
        id: 'na-1',
        playbook_id: 'pb-1',
        etablissement_id: 'et-1',
        current_step_order: 1,
        next_action_at: '2024-02-01T09:00:00Z',
        status: 'running',
        playbook_name: 'Onboarding sensible',
      },
    ],
  },
  UPSERTED_PLAYBOOK: {
    id: 'pb-new',
    name: 'Nouveau playbook',
    description: 'créé',
    is_active: true,
    priority: 3,
    trigger_config: { source: 'manual' },
    cooldown_days: 5,
    category: 'custom',
    created_at: '2024-03-01T08:00:00Z',
    updated_at: '2024-03-01T08:00:00Z',
  },
  UPSERTED_STEP: {
    id: 'st-new',
    playbook_id: 'pb-1',
    step_order: 3,
    step_type: 'create_alert',
    config: { severity: 'high' },
    delay_days: 1,
  },
  ENGINE_RESULT: {
    picked: 4,
    advanced: 2,
    completed: 1,
    failed: 1,
  },
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockInvoke: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

type SupabaseResult<T> = { data: T | null; error: { message: string } | null };

function createBuilder<T>(result: SupabaseResult<T>) {
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: SupabaseResult<T>) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('useCsmPlaybooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge les playbooks avec les bons tris et retourne les données métier', async () => {
    const builder = createBuilder({ data: PLAYBOOKS, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const { result } = renderHook(() => useCsmPlaybooks(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('csm_playbooks');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.order).toHaveBeenNthCalledWith(1, 'priority', { ascending: true });
    expect(builder.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false });
    expect(result.current.data).toEqual(PLAYBOOKS);
    expect(result.current.data?.[0].name).toBe('Onboarding sensible');
    expect(result.current.data?.[1].is_active).toBe(false);
  });

  it('passe en erreur si la récupération des playbooks échoue', async () => {
    const builder = createBuilder<{ id: string }[]>({ data: null, error: { message: 'lecture impossible' } });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const { result } = renderHook(() => useCsmPlaybooks(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('lecture impossible');
  });

  it('désactive la requête des étapes sans playbookId puis charge les étapes triées', async () => {
    const builder = createBuilder({ data: STEPS, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const disabled = renderHook(() => useCsmPlaybookSteps(undefined), {
      wrapper: createWrapper(client),
    });

    expect(disabled.result.current.fetchStatus).toBe('idle');
    expect(mockFrom).not.toHaveBeenCalled();

    const enabled = renderHook(() => useCsmPlaybookSteps('pb-1'), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(enabled.result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('csm_playbook_steps');
    expect(builder.eq).toHaveBeenCalledWith('playbook_id', 'pb-1');
    expect(builder.order).toHaveBeenCalledWith('step_order', { ascending: true });
    expect(enabled.result.current.data).toEqual(STEPS);
    expect(enabled.result.current.data?.map((s) => s.step_type)).toEqual(['create_task', 'send_email']);
  });

  it('charge les exécutions globales et limite à 100', async () => {
    const builder = createBuilder({ data: EXECUTIONS, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const { result } = renderHook(() => useCsmPlaybookExecutions(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('csm_playbook_executions');
    expect(builder.order).toHaveBeenCalledWith('started_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(100);
    expect(builder.eq).not.toHaveBeenCalled();
    expect(result.current.data?.[0].status).toBe('running');
  });

  it('filtre les exécutions par playbook quand un id est fourni', async () => {
    const builder = createBuilder({ data: EXECUTIONS, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const { result } = renderHook(() => useCsmPlaybookExecutions('pb-1'), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(builder.eq).toHaveBeenCalledWith('playbook_id', 'pb-1');
    expect(result.current.data).toEqual(EXECUTIONS);
  });

  it('charge les exécutions par établissement et reste désactivé sans id', async () => {
    const builder = createBuilder({ data: ETAB_EXECUTIONS, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const disabled = renderHook(() => useCsmPlaybookExecutionsByEtablissement(undefined), {
      wrapper: createWrapper(client),
    });

    expect(disabled.result.current.fetchStatus).toBe('idle');

    const enabled = renderHook(() => useCsmPlaybookExecutionsByEtablissement('et-42'), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(enabled.result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('csm_playbook_executions');
    expect(builder.eq).toHaveBeenCalledWith('etablissement_id', 'et-42');
    expect(builder.limit).toHaveBeenCalledWith(50);
    expect(enabled.result.current.data?.[0].etablissement_id).toBe('et-42');
  });

  it('charge le dashboard via rpc et expose les métriques utiles', async () => {
    mockRpc.mockResolvedValue({ data: DASHBOARD, error: null });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const { result } = renderHook(() => useCsmPlaybookDashboard(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_csm_playbook_dashboard');
    expect(result.current.data?.total_playbooks).toBe(2);
    expect(result.current.data?.active_playbooks).toBe(1);
    expect(result.current.data?.next_actions[0].playbook_name).toBe('Onboarding sensible');
  });

  it('remonte une erreur dashboard si le rpc échoue', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc indisponible' } });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const { result } = renderHook(() => useCsmPlaybookDashboard(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('rpc indisponible');
  });

  it('upsert un playbook, invalide les requêtes et affiche un toast de succès', async () => {
    const builder = createBuilder({ data: UPSERTED_PLAYBOOK, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useUpsertPlaybook(), {
      wrapper: createWrapper(client),
    });

    const payload = {
      name: 'Nouveau playbook',
      priority: 3,
      is_active: true,
      trigger_config: { source: 'manual' },
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('csm_playbooks');
    expect(builder.upsert).toHaveBeenCalledWith([payload]);
    expect(builder.select).toHaveBeenCalledWith();
    expect(builder.single).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-playbooks'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-playbook-dashboard'] });
    expect(toastSuccess).toHaveBeenCalledWith('Playbook enregistré');
  });

  it('supprime un playbook et transmet le bon id à Supabase', async () => {
    const builder = createBuilder<null>({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDeletePlaybook(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('pb-2');
    });

    expect(mockFrom).toHaveBeenCalledWith('csm_playbooks');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'pb-2');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-playbooks'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-playbook-dashboard'] });
    expect(toastSuccess).toHaveBeenCalledWith('Playbook supprimé');
  });

  it('upsert une étape avec onConflict et invalide la clé du playbook concerné', async () => {
    const builder = createBuilder({ data: UPSERTED_STEP, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useUpsertPlaybookStep(), {
      wrapper: createWrapper(client),
    });

    const payload = {
      playbook_id: 'pb-1',
      step_order: 3,
      step_type: 'create_alert' as const,
      config: { severity: 'high' },
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockFrom).toHaveBeenCalledWith('csm_playbook_steps');
    expect(builder.upsert).toHaveBeenCalledWith([payload], { onConflict: 'playbook_id,step_order' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-playbook-steps', 'pb-1'] });
    expect(toastSuccess).toHaveBeenCalledWith('Étape enregistrée');
  });

  it('supprime une étape et invalide la requête des étapes du playbook', async () => {
    const builder = createBuilder<null>({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDeletePlaybookStep(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'st-2', playbook_id: 'pb-1' });
    });

    expect(mockFrom).toHaveBeenCalledWith('csm_playbook_steps');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'st-2');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-playbook-steps', 'pb-1'] });
    expect(toastSuccess).toHaveBeenCalledWith('Étape supprimée');
  });

  it('évalue les playbooks pour un établissement et affiche le message pluriel correct', async () => {
    mockRpc.mockResolvedValue({ data: 2, error: null });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useEvaluatePlaybooksForEtablissement(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('et-9');
    });

    expect(mockRpc).toHaveBeenCalledWith('evaluate_csm_playbooks_for_etablissement', {
      _etablissement_id: 'et-9',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-playbook-executions'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-playbook-dashboard'] });
    expect(toastSuccess).toHaveBeenCalledWith('2 playbooks déclenchés');
  });

  it('affiche le message aucun playbook éligible quand le rpc retourne 0', async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const { result } = renderHook(() => useEvaluatePlaybooksForEtablissement(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('et-10');
    });

    expect(toastSuccess).toHaveBeenCalledWith('Aucun playbook éligible');
  });

  it('déclenche le worker, invalide les requêtes et compose le résumé métier', async () => {
    mockInvoke.mockResolvedValue({ data: ENGINE_RESULT, error: null });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useRunPlaybookEngine(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockInvoke).toHaveBeenCalledWith('csm-playbook-engine', { body: {} });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-playbook-executions'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['csm-playbook-dashboard'] });
    expect(toastSuccess).toHaveBeenCalledWith(
      'Worker exécuté : 4 traités · 2 avancés · 1 terminés · 1 échoués',
    );
  });

  it('affiche les erreurs de mutation via toast.error', async () => {
    const failingBuilder = createBuilder<{ id: string }>({ data: null, error: { message: 'échec upsert' } });
    mockFrom.mockReturnValue(failingBuilder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });

    const { result } = renderHook(() => useUpsertPlaybook(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          name: 'Erreur playbook',
          priority: 1,
        }),
      ).rejects.toThrow('échec upsert');
    });

    expect(toastError).toHaveBeenCalledWith('Erreur : échec upsert');
  });
});