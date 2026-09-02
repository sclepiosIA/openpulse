import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormPreview } from './FormPreview';

const { MOCK_USER, mockFrom, mockNavigate, toast, formFieldRendererCalls, LOCAL_ROWS_OK, LOCAL_ERR_MESSAGE } =
  vi.hoisted(() => {
    const formFieldRendererCalls: Array<{
      fieldId: string;
      value: string;
      disabled: boolean;
      onChange: (v: string) => void;
    }> = [];

    const MOCK_USER = {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    };

    const mockNavigate = vi.fn();

    const toast = {
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      loading: vi.fn(),
      promise: vi.fn(),
      dismiss: vi.fn(),
      custom: vi.fn(),
    };

    const LOCAL_ROWS_OK = [{ id: 'r1' }];
    const LOCAL_ERR_MESSAGE = 'x';

    const makeThenable = <T,>(getValue: () => Promise<T>) => ({
      then: (onFulfilled?: ((v: T) => unknown) | undefined, onRejected?: ((e: unknown) => unknown) | undefined) =>
        getValue().then(onFulfilled as never, onRejected as never),
      catch: (onRejected?: ((e: unknown) => unknown) | undefined) => getValue().catch(onRejected as never),
    });

    type BuilderResult = { data: null; error: null };

    const builderFactory = () => {
      const stableResult: BuilderResult = { data: null, error: null };

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
        'contains',
        'overlaps',
        'like',
        'ilike',
        'is',
        'order',
        'range',
        'limit',
        'insert',
        'update',
        'upsert',
        'delete',
        'match',
      ] as const;

      for (const m of chainMethods) builder[m] = vi.fn(() => builder);

      builder.single = vi.fn(async () => stableResult);
      builder.maybeSingle = vi.fn(async () => stableResult);

      const thenable = makeThenable(() => Promise.resolve(stableResult));
      builder.then = thenable.then;
      builder.catch = thenable.catch;

      return builder;
    };

    const mockFrom = vi.fn(() => builderFactory());

    return {
      MOCK_USER,
      mockFrom,
      mockNavigate,
      toast,
      formFieldRendererCalls,
      LOCAL_ROWS_OK,
      LOCAL_ERR_MESSAGE,
    };
  });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'p' }, error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'u' } })),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children }: { children: React.ReactNode }) => React.createElement('a', null, children),
  useParams: () => ({}),
  useLocation: () => ({ pathname: '/' }),
}));

vi.mock('sonner', () => ({
  toast,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('div', { 'data-testid': 'card', className }, children),
  CardHeader: ({ children }: { children: React.ReactNode }) => React.createElement('header', null, children),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('h2', { className }, children),
  CardDescription: ({ children }: { children: React.ReactNode }) => React.createElement('p', null, children),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('section', { className }, children),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    className?: string;
  }) => React.createElement('button', { disabled, className }, children),
}));

vi.mock('./FormFieldRenderer', () => ({
  FormFieldRenderer: ({
    field,
    value,
    onChange,
    disabled,
  }: {
    field: { id: string; label?: string };
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
  }) => {
    formFieldRendererCalls.push({ fieldId: field.id, value, disabled: Boolean(disabled), onChange });
    const label = field.label ?? `field-${field.id}`;
    return React.createElement('label', null, [
      React.createElement('span', { key: 't' }, label),
      React.createElement('input', {
        key: 'i',
        'aria-label': label,
        disabled,
        value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.currentTarget.value),
      }),
    ]);
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => MOCK_USER,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => MOCK_USER,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => MOCK_USER,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function wrapWithQueryClient(ui: React.ReactElement, client: QueryClient) {
  return React.createElement(QueryClientProvider, { client }, ui);
}

describe('FormPreview', () => {
  it('affiche le titre, la description, le visuel cover, rend les champs en lecture seule et conserve les valeurs internes', () => {
    const client = createQueryClient();

    const form = {
      id: 'f1',
      title: 'Formulaire test',
      description: 'Description courte',
      cover_image_url: 'https://example.test/cover.png',
      form_fields: [
        { id: 'a', label: 'Prénom', type: 'text' },
        { id: 'b', label: 'Nom', type: 'text' },
      ],
    };

    render(wrapWithQueryClient(React.createElement(FormPreview, { form }), client));

    expect(screen.getByText('Formulaire test')).toBeTruthy();
    expect(screen.getByText('Description courte')).toBeTruthy();
    expect(document.querySelector('.h-32.rounded-t-lg')).toBeTruthy();

    const submit = screen.getByRole('button', { name: 'Envoyer (aperçu)' });
    expect(submit).toBeDisabled();

    const inputA = screen.getByLabelText('Prénom') as HTMLInputElement;
    const inputB = screen.getByLabelText('Nom') as HTMLInputElement;

    expect(inputA.disabled).toBe(true);
    expect(inputB.disabled).toBe(true);
    expect(inputA.value).toBe('');
    expect(inputB.value).toBe('');

    fireEvent.change(inputA, { target: { value: 'Ada' } });

    const lastValueA = [...formFieldRendererCalls].reverse().find((c) => c.fieldId === 'a')?.value;
    const lastValueB = [...formFieldRendererCalls].reverse().find((c) => c.fieldId === 'b')?.value;

    expect(lastValueA).toBe('Ada');
    expect(lastValueB).toBe('');
  });

  it("ne rend pas la description ni le bandeau cover si absents (description undefined et cover_image_url null)", () => {
    const client = createQueryClient();

    const form = {
      id: 'f2',
      title: 'Sans extras',
      cover_image_url: null as unknown as string,
      description: undefined as unknown as string,
      form_fields: [{ id: 'x', label: 'Email', type: 'email' }],
    };

    render(wrapWithQueryClient(React.createElement(FormPreview, { form }), client));

    expect(screen.getByText('Sans extras')).toBeTruthy();
    expect(document.querySelector('.h-32.rounded-t-lg')).toBeNull();
    expect(screen.queryByText('Description courte')).toBeNull();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('hook (renderHook + QueryClientProvider): chargement -> succès -> erreur', async () => {
    const { renderHook, waitFor } = await import('@testing-library/react');
    const { useQuery } = await import('@tanstack/react-query');

    const client = createQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children);

    function useLocalQuery(mode: 'ok' | 'err') {
      return useQuery({
        queryKey: ['local', mode],
        queryFn: async () => {
          await Promise.resolve();
          if (mode === 'err') throw new Error(LOCAL_ERR_MESSAGE);
          return LOCAL_ROWS_OK;
        },
      });
    }

    const h1 = renderHook(() => useLocalQuery('ok'), { wrapper });
    expect(h1.result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(h1.result.current.isSuccess).toBe(true);
    });
    expect(h1.result.current.data).toEqual(LOCAL_ROWS_OK);

    const h2 = renderHook(() => useLocalQuery('err'), { wrapper });

    await waitFor(() => {
      expect(h2.result.current.isError).toBe(true);
    });
    expect((h2.result.current.error as Error).message).toBe(LOCAL_ERR_MESSAGE);

    cleanup();
  });
});