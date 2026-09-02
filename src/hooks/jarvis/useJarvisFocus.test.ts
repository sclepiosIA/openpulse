import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import { useJarvisFocus } from './useJarvisFocus';

const {
  ETAB,
  locationRef,
  mockFrom,
  mockMaybeSingle,
  getItemMock,
  setItemMock,
  removeItemMock,
} = vi.hoisted(() => {
  const ETAB = { id: 'e1', nom: 'Clinique Test' };
  const locationRef = { pathname: '/' };
  const mockMaybeSingle = vi.fn(() =>
    Promise.resolve({ data: null, error: null })
  );
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
    'upsert',
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = mockMaybeSingle;
  builder.single = mockMaybeSingle;
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
  builder.catch = () => builder;
  const mockFrom = vi.fn(() => builder);
  return {
    ETAB,
    locationRef,
    mockFrom,
    mockMaybeSingle,
    getItemMock: vi.fn((): string | null => null),
    setItemMock: vi.fn(),
    removeItemMock: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/hooks/shared/useAuth', () => {
  const AUTH = { user: { id: 'u1', email: 't@t.co' }, isLoading: false };
  return { useAuth: () => AUTH };
});

vi.mock('@/lib/safeStorage', () => ({
  safeStorage: {
    getItem: getItemMock,
    setItem: setItemMock,
    removeItem: removeItemMock,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => locationRef,
  useNavigate: () => vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('useJarvisFocus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationRef.pathname = '/';
  });

  it('démarre en mode general sans focus ni pin sur la route racine', () => {
    const { result } = renderHook(() => useJarvisFocus(), {
      wrapper: createWrapper(),
    });

    expect(result.current.currentMode).toBe('general');
    expect(result.current.hasFocus).toBe(false);
    expect(result.current.isPinned).toBe(false);
    expect(result.current.recentActivities).toEqual([]);
    expect(result.current.isAnalyzing).toBe(false);
  });

  it('détecte le mode emails depuis la route /emails', () => {
    locationRef.pathname = '/emails';
    const { result } = renderHook(() => useJarvisFocus(), {
      wrapper: createWrapper(),
    });

    expect(result.current.currentMode).toBe('emails');
    expect(result.current.hasFocus).toBe(true);
  });

  it('extrait le task_id depuis /taches/:id et enregistre une activité de vue', () => {
    locationRef.pathname = '/taches/a1b2c3d4';
    const { result } = renderHook(() => useJarvisFocus(), {
      wrapper: createWrapper(),
    });

    expect(result.current.currentMode).toBe('tasks');
    expect(result.current.focusContext.task_id).toBe('a1b2c3d4');
    expect(result.current.recentActivities.length).toBeGreaterThanOrEqual(1);
    expect(result.current.recentActivities[0].entity_type).toBe('task');
    expect(result.current.recentActivities[0].entity_id).toBe('a1b2c3d4');
    expect(result.current.recentActivities[0].type).toBe('view');
  });

  it('togglePin épingle le focus et le persiste dans safeStorage', () => {
    const { result } = renderHook(() => useJarvisFocus(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.togglePin();
    });

    expect(result.current.isPinned).toBe(true);
    expect(setItemMock).toHaveBeenCalledWith(
      'jarvis_focus_context',
      expect.stringContaining('"isPinned":true')
    );
  });

  it('focusOnEtablissement (épinglé) charge les données et passe en mode crm', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: ETAB, error: null });
    const { result } = renderHook(() => useJarvisFocus(), {
      wrapper: createWrapper(),
    });

    // pin=true pour que l'effet de route ne réinitialise pas le mode après le focus
    await act(async () => {
      await result.current.focusOnEtablissement('e1', true);
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(result.current.currentMode).toBe('crm');
    expect(result.current.focusContext.etablissement_id).toBe('e1');
    expect(result.current.focusContext.etablissement_name).toBe(
      'Clinique Test'
    );
    expect(result.current.isPinned).toBe(true);
    expect(result.current.hasFocus).toBe(true);
  });

  it("focusOnEtablissement en erreur ne modifie pas l'état", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'x' },
    });
    const { result } = renderHook(() => useJarvisFocus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.focusOnEtablissement('e-inconnu');
    });

    expect(result.current.currentMode).toBe('general');
    expect(result.current.focusContext.etablissement_name).toBeUndefined();
  });

  it('focusOnThread définit le mode emails avec le sujet en contexte additionnel', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'th1',
        subject: 'Sujet brut',
        ai_generated_title: 'Titre IA',
        etablissement_id: 'e1',
      },
      error: null,
    });
    const { result } = renderHook(() => useJarvisFocus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.focusOnThread('th1', true);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(result.current.currentMode).toBe('emails');
    expect(result.current.focusContext.thread_id).toBe('th1');
    expect(result.current.focusContext.etablissement_id).toBe('e1');
    expect(result.current.isPinned).toBe(true);
    expect(result.current.focusContext.additional_context).toEqual({
      email_subject: 'Titre IA',
    });
  });

  it('clearFocus remet le mode general et supprime la persistance', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: ETAB, error: null });
    const { result } = renderHook(() => useJarvisFocus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.focusOnEtablissement('e1', true);
    });
    expect(result.current.currentMode).toBe('crm');

    act(() => {
      result.current.clearFocus();
    });

    expect(result.current.currentMode).toBe('general');
    expect(result.current.isPinned).toBe(false);
    expect(removeItemMock).toHaveBeenCalledWith('jarvis_focus_context');
  });

  it("recordActivity ajoute une activité et getContextPrompt l'inclut", () => {
    const { result } = renderHook(() => useJarvisFocus(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.recordActivity('etablissement', 'e1', 'Clinique Test');
    });

    expect(result.current.recentActivities[0]).toMatchObject({
      type: 'action',
      entity_type: 'etablissement',
      entity_id: 'e1',
      entity_name: 'Clinique Test',
    });
    expect(result.current.recentActivities[0].timestamp).toBeInstanceOf(Date);

    const prompt = result.current.getContextPrompt();
    expect(prompt).toContain('mode "general"');
    expect(prompt).toContain('Récemment consulté : etablissement.');
  });

  it('getContextPrompt mentionne le focus épinglé et le nom de l’établissement', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: ETAB, error: null });
    const { result } = renderHook(() => useJarvisFocus(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.focusOnEtablissement('e1', true);
    });

    const prompt = result.current.getContextPrompt();
    expect(prompt).toContain('[FOCUS ÉPINGLÉ]');
    expect(prompt).toContain('mode "crm"');
    expect(prompt).toContain('l\'établissement "Clinique Test"');
    expect(prompt).toContain(
      'Toutes les requêtes sans contexte concernent cet établissement.'
    );
  });

  it('analyzeCurrentContext retourne le contexte de base en mode general', async () => {
    const { result } = renderHook(() => useJarvisFocus(), {
      wrapper: createWrapper(),
    });

    let context: Record<string, unknown> = {};
    await act(async () => {
      context = await result.current.analyzeCurrentContext();
    });

    expect(context.current_mode).toBe('general');
    expect(context.current_route).toBe('/');
    expect(context.is_pinned).toBe(false);
    expect(Array.isArray(context.recent_activities)).toBe(true);

    await waitFor(() => {
      expect(result.current.isAnalyzing).toBe(false);
    });
  });
});