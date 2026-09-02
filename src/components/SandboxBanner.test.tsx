import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, cleanup } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

const {
  AUTH_STATE,
  SANDBOX_STATE,
  mockFrom,
  mockSelect,
  mockEq,
  mockGte,
  mockLte,
  mockIn,
  mockOrder,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSingle,
  mockMaybeSingle,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const SANDBOX_STATE = {
    isSandbox: false,
    isLoading: false,
    isError: false,
    error: null as null | { message: string },
  };

  const createBuilder = () => {
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
      then: vi.fn((onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled as never, onRejected as never),
      ),
      catch: vi.fn((onRejected?: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected as never),
      ),
    };
    return builder;
  };

  const builder = createBuilder();

  const mockFrom = vi.fn(() => builder);

  return {
    AUTH_STATE,
    SANDBOX_STATE,
    mockFrom,
    mockSelect: builder.select,
    mockEq: builder.eq,
    mockGte: builder.gte,
    mockLte: builder.lte,
    mockIn: builder.in,
    mockOrder: builder.order,
    mockLimit: builder.limit,
    mockInsert: builder.insert,
    mockUpdate: builder.update,
    mockDelete: builder.delete,
    mockSingle: builder.single,
    mockMaybeSingle: builder.maybeSingle,
  };
});

vi.mock('lucide-react', () => ({
  AlertTriangle: (props: { className?: string }) =>
    React.createElement('svg', { 'data-testid': 'alert-triangle', className: props.className }),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock('@/hooks/auth/useIsSandboxProfile', () => ({
  useIsSandboxProfile: vi.fn((userId?: string) => {
    void userId;
    if (SANDBOX_STATE.isLoading) return undefined;
    if (SANDBOX_STATE.isError) return false;
    return SANDBOX_STATE.isSandbox;
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { SandboxBanner } from './SandboxBanner';

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

describe('SandboxBanner', () => {
  it('chargement (isLoading) → rendu null', () => {
    SANDBOX_STATE.isLoading = true;
    SANDBOX_STATE.isSandbox = false;
    SANDBOX_STATE.isError = false;
    SANDBOX_STATE.error = null;

    const Wrapper = createWrapper();

    const { result } = renderHook(() => SandboxBanner(), { wrapper: Wrapper });
    expect(result.current).toBeNull();

    const { container } = render(<SandboxBanner />, { wrapper: Wrapper });
    expect(container.firstChild).toBeNull();

    cleanup();
  });

  it('succès (isSandbox=true) → affiche le banner', () => {
    SANDBOX_STATE.isLoading = false;
    SANDBOX_STATE.isSandbox = true;
    SANDBOX_STATE.isError = false;
    SANDBOX_STATE.error = null;

    const Wrapper = createWrapper();

    const { result } = renderHook(() => SandboxBanner(), { wrapper: Wrapper });
    expect(result.current).not.toBeNull();

    render(<SandboxBanner />, { wrapper: Wrapper });

    expect(
      screen.getByText('Mode démo — aucune action destructive ne sera exécutée'),
    ).toBeInTheDocument();

    const icon = screen.getByTestId('alert-triangle');
    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute('class')).toContain('h-4');
    expect(icon.getAttribute('class')).toContain('w-4');

    cleanup();
  });

  it("erreur ({data:null, error:{message:'x'}}) → pas de banner (isError)", async () => {
    SANDBOX_STATE.isLoading = false;
    SANDBOX_STATE.isSandbox = false;
    SANDBOX_STATE.isError = true;
    SANDBOX_STATE.error = { message: 'x' };

    mockFrom.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockSingle.mockClear();
    mockMaybeSingle.mockClear();

    const Wrapper = createWrapper();

    const { container } = render(<SandboxBanner />, { wrapper: Wrapper });
    expect(container.firstChild).toBeNull();

    cleanup();
  });
});