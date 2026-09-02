/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardLayout } from './useDashboardLayout';
import { DEFAULT_LAYOUT, DASHBOARD_TEMPLATES } from './useDashboardLayout.registry';
import { toast } from 'sonner';
import { debug } from '@/lib/debug';
import { fromExtended } from '@/lib/supabaseTyped';

const {
  AUTH_STATE,
  SAVED_LAYOUT,
  DEFAULT_MERGED_LAYOUT,
  TEMPLATE_APPLIED_LAYOUT,
  BUILDER,
  mockFrom,
  mockUseAuth,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
  mockGetWidgetDefinition,
  mockGetWidgetsByCategory,
  mockMergeRegistryWithLayout,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const SAVED_LAYOUT = {
    widgets: [
      { id: 'w1', visible: true, order: 1, size: 'S', settings: { color: 'blue' } },
      { id: 'w2', visible: false, order: 0, size: 'M', settings: { range: 7 } },
    ],
    columns: 3,
    theme: 'compact',
  };

  const DEFAULT_MERGED_LAYOUT = {
    widgets: [
      { id: 'w1', visible: true, order: 0, size: 'S', settings: {} },
      { id: 'w2', visible: false, order: 1, size: 'M', settings: {} },
      { id: 'w3', visible: false, order: 2, size: 'L', settings: {} },
    ],
    columns: 2,
    theme: 'comfortable',
  };

  const TEMPLATE_APPLIED_LAYOUT = {
    widgets: [
      { id: 'w2', visible: true, order: 0, size: 'M' },
      { id: 'w1', visible: true, order: 1, size: 'S' },
      { id: 'w3', visible: false, order: 2, size: 'L' },
    ],
    columns: 2,
    theme: 'comfortable',
  };

  const BUILDER = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  BUILDER.select.mockImplementation(() => BUILDER);
  BUILDER.eq.mockImplementation(() => BUILDER);
  BUILDER.gte.mockImplementation(() => BUILDER);
  BUILDER.lte.mockImplementation(() => BUILDER);
  BUILDER.in.mockImplementation(() => BUILDER);
  BUILDER.order.mockImplementation(() => BUILDER);
  BUILDER.limit.mockImplementation(() => BUILDER);
  BUILDER.insert.mockImplementation(() => BUILDER);
  BUILDER.update.mockImplementation(() => BUILDER);
  BUILDER.delete.mockImplementation(() => BUILDER);
  BUILDER.then.mockImplementation((resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: null, error: null })));
  BUILDER.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  const mockFrom = vi.fn(() => BUILDER);
  const mockUseAuth = vi.fn(() => AUTH_STATE);
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockDebugError = vi.fn();
  const mockGetWidgetDefinition = vi.fn((id: string) => ({ id, name: `Widget ${id}` }));
  const mockGetWidgetsByCategory = vi.fn(() => [{ id: 'w1' }, { id: 'w2' }]);
  const mockMergeRegistryWithLayout = vi.fn((layout: typeof SAVED_LAYOUT | null) => {
    if (!layout) return DEFAULT_MERGED_LAYOUT;
    return {
      widgets: layout.widgets
        .map((widget) => ({
          ...widget,
          settings: widget.settings ?? {},
        }))
        .sort((a, b) => a.order - b.order),
      columns: layout.columns,
      theme: layout.theme,
    };
  });

  return {
    AUTH_STATE,
    SAVED_LAYOUT,
    DEFAULT_MERGED_LAYOUT,
    TEMPLATE_APPLIED_LAYOUT,
    BUILDER,
    mockFrom,
    mockUseAuth,
    mockToastSuccess,
    mockToastError,
    mockDebugError,
    mockGetWidgetDefinition,
    mockGetWidgetsByCategory,
    mockMergeRegistryWithLayout,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFrom,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock('./useDashboardLayout.registry', () => ({
  WIDGET_REGISTRY: {
    w1: { defaultSize: 'S', category: 'main' },
    w2: { defaultSize: 'M', category: 'secondary' },
    w3: { defaultSize: 'L', category: 'secondary' },
  },
  DASHBOARD_TEMPLATES: {
    teamFocus: {
      id: 'teamFocus',
      name: 'Team Focus',
      widgets: ['w2', 'w1'],
    },
  },
  DEFAULT_LAYOUT: DEFAULT_MERGED_LAYOUT,
  LAYOUT_TEMPLATES: {},
  getWidgetDefinition: mockGetWidgetDefinition,
  getWidgetsByCategory: mockGetWidgetsByCategory,
  mergeRegistryWithLayout: mockMergeRegistryWithLayout,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useDashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    BUILDER.select.mockImplementation(() => BUILDER);
    BUILDER.eq.mockImplementation(() => BUILDER);
    BUILDER.gte.mockImplementation(() => BUILDER);
    BUILDER.lte.mockImplementation(() => BUILDER);
    BUILDER.in.mockImplementation(() => BUILDER);
    BUILDER.order.mockImplementation(() => BUILDER);
    BUILDER.limit.mockImplementation(() => BUILDER);
    BUILDER.insert.mockImplementation(() => BUILDER);
    BUILDER.update.mockImplementation(() => BUILDER);
    BUILDER.delete.mockImplementation(() => BUILDER);
    BUILDER.upsert.mockResolvedValue({ error: null });
    BUILDER.single.mockResolvedValue({ data: null, error: null });
    BUILDER.maybeSingle.mockResolvedValue({ data: { layout: SAVED_LAYOUT }, error: null });
    mockFrom.mockImplementation(() => BUILDER);
    mockUseAuth.mockImplementation(() => AUTH_STATE);
  });

  it('charge le layout sauvegardé puis expose les valeurs métier triées et fusionnées', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDashboardLayout('direction'), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(fromExtended).toHaveBeenCalledWith('dashboard_layouts');

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(BUILDER.select).toHaveBeenCalledWith('layout');
    expect(BUILDER.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(BUILDER.eq).toHaveBeenCalledWith('team', 'direction');

    expect(result.current.layout.columns).toBe(3);
    expect(result.current.layout.theme).toBe('compact');
    expect(result.current.visibleWidgets.map((widget) => widget.id)).toEqual(['w1']);
    expect(result.current.availableWidgets.map((widget) => widget.id)).toEqual(['w2']);
    expect(result.current.allWidgets.map((widget) => widget.id)).toEqual(['w2', 'w1']);
    expect(result.current.activeWidgets).toEqual(result.current.visibleWidgets);
    expect(result.current.getWidgetSettings('w1')).toEqual({ color: 'blue' });
  });

  it('permet de modifier puis sauvegarder le layout en mode édition', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDashboardLayout('direction'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.startEdit();
    });

    expect(result.current.isEditMode).toBe(true);

    await act(async () => {
      result.current.toggleWidgetVisibility('w2');
      result.current.updateWidgetSize('w1', 'L');
      result.current.updateColumns(4);
    });

    expect(result.current.layout.columns).toBe(4);
    expect(result.current.visibleWidgets.map((widget) => widget.id)).toEqual(['w2', 'w1']);
    expect(result.current.layout.widgets.find((widget) => widget.id === 'w1')?.size).toBe('L');

    await act(async () => {
      result.current.saveLayout();
    });

    await waitFor(() => {
      expect(BUILDER.upsert).toHaveBeenCalledTimes(1);
    });

    expect(BUILDER.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        team: 'direction',
        layout: expect.objectContaining({
          columns: 4,
          widgets: expect.arrayContaining([
            expect.objectContaining({ id: 'w1', size: 'L' }),
            expect.objectContaining({ id: 'w2', visible: true }),
          ]),
        }),
        updated_at: expect.any(String),
      }),
      { onConflict: 'user_id,team' }
    );

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Dashboard personnalisé sauvegardé');
    });

    await waitFor(() => {
      expect(result.current.isEditMode).toBe(false);
    });
  });

  it('passe en erreur de mutation et affiche le toast erreur si la sauvegarde échoue', async () => {
    BUILDER.upsert.mockResolvedValueOnce({ error: { message: 'x' } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDashboardLayout('direction'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.updateWidgetSettings('w1', { density: 'high' });
    });

    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });

    expect(BUILDER.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({
          widgets: expect.arrayContaining([
            expect.objectContaining({
              id: 'w1',
              settings: expect.objectContaining({ color: 'blue', density: 'high' }),
            }),
          ]),
        }),
      }),
      { onConflict: 'user_id,team' }
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erreur lors de la sauvegarde');
    });

    expect(debug.error).toHaveBeenCalled();
  });

  it('applique un template puis sauvegarde le nouvel ordre et la visibilité', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDashboardLayout('direction'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.applyTemplate('teamFocus');
    });

    await waitFor(() => {
      expect(BUILDER.upsert).toHaveBeenCalledTimes(1);
    });

    const payload = BUILDER.upsert.mock.calls[0]?.[0];
    expect(payload.layout).toEqual(TEMPLATE_APPLIED_LAYOUT);
    expect(payload.layout.widgets.map((widget: { id: string }) => widget.id)).toEqual(['w2', 'w1', 'w3']);
    expect(payload.layout.widgets.filter((widget: { visible: boolean }) => widget.visible).map((widget: { id: string }) => widget.id)).toEqual(['w2', 'w1']);
    expect(toast.success).toHaveBeenCalledWith(`Template "${DASHBOARD_TEMPLATES.teamFocus.name}" appliqué`);
  });

  it('retombe sur le layout par défaut si la récupération échoue côté lecture', async () => {
    BUILDER.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDashboardLayout('direction'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(debug.error).toHaveBeenCalled();
    expect(result.current.layout).toEqual(DEFAULT_LAYOUT);
    expect(result.current.visibleWidgets.map((widget) => widget.id)).toEqual(['w1']);
    expect(result.current.availableWidgets.map((widget) => widget.id)).toEqual(['w2', 'w3']);
  });
});