/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SocialComposer from './SocialComposer';

const {
  BRANDS,
  ACCOUNTS,
  AUTH_STATE,
  ROLE_STATE,
  BRANDS_QUERY_LOADING,
  BRANDS_QUERY_SUCCESS,
  BRANDS_QUERY_ERROR,
  ACCOUNTS_QUERY_EMPTY,
  ACCOUNTS_QUERY_SUCCESS,
  toastSuccess,
  toastError,
  toastWarning,
  mockInvoke,
  mockInsert,
  mockFrom,
} = vi.hoisted(() => {
  const BRANDS = [
    { id: 'b1', name: 'Marque A' },
    { id: 'b2', name: 'Marque B' },
  ];
  const ACCOUNTS = [
    { id: 'a1', platform: 'facebook', display_name: 'Page FB' },
    { id: 'a2', platform: 'instagram', display_name: 'Compte IG' },
  ];
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };
  const ROLE_STATE = {
    role: 'marketing',
    isLoading: false,
  };
  const BRANDS_QUERY_LOADING = {
    isLoading: true,
    isError: false,
    error: null,
    data: undefined as typeof BRANDS | undefined,
  };
  const BRANDS_QUERY_SUCCESS = {
    isLoading: false,
    isError: false,
    error: null,
    data: BRANDS,
  };
  const BRANDS_QUERY_ERROR = {
    isLoading: false,
    isError: true,
    error: new Error('x'),
    data: undefined as typeof BRANDS | undefined,
  };
  const ACCOUNTS_QUERY_EMPTY = {
    isLoading: false,
    isError: false,
    error: null,
    data: [] as typeof ACCOUNTS,
  };
  const ACCOUNTS_QUERY_SUCCESS = {
    isLoading: false,
    isError: false,
    error: null,
    data: ACCOUNTS,
  };
  return {
    BRANDS,
    ACCOUNTS,
    AUTH_STATE,
    ROLE_STATE,
    BRANDS_QUERY_LOADING,
    BRANDS_QUERY_SUCCESS,
    BRANDS_QUERY_ERROR,
    ACCOUNTS_QUERY_EMPTY,
    ACCOUNTS_QUERY_SUCCESS,
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    mockInvoke: vi.fn(),
    mockInsert: vi.fn(),
    mockFrom: vi.fn(),
  };
});

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock('lucide-react', () => {
  const Icon = () => <svg />;
  return {
    Send: Icon,
    Clock: Icon,
    Loader2: Icon,
    Image: Icon,
    X: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild,
    disabled,
    onClick,
    variant,
    size,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    disabled?: boolean;
    onClick?: () => void | Promise<void>;
    variant?: string;
    size?: string;
  }) => {
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ children?: React.ReactNode }>;
      return React.cloneElement(child, {
        children: <span>{child.props.children}</span>,
      });
    }
    return (
      <button type="button" disabled={disabled} onClick={onClick} data-variant={variant} data-size={size}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    id,
    value,
    onChange,
    placeholder,
    rows,
    maxLength,
  }: {
    id?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
    rows?: number;
    maxLength?: number;
  }) => (
    <textarea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} maxLength={maxLength} />
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    type,
  }: {
    id?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    type?: string;
  }) => <input id={id} value={value} onChange={onChange} placeholder={placeholder} type={type} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: () => void;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => {
        onCheckedChange?.();
      }}
    />
  ),
}));

vi.mock('@/components/ui/select', () => {
  const SelectCtx = React.createContext<(value: string) => void>(() => {});
  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <SelectCtx.Provider value={(v: string) => onValueChange?.(v)}>
      <div data-select-value={value}>{children}</div>
    </SelectCtx.Provider>
  );
  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;
  const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => {
    const onChange = React.useContext(SelectCtx);
    return (
      <button type="button" onClick={() => onChange(value)}>
        {children}
      </button>
    );
  };
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

vi.mock('@/components/shared/PageDataState', () => ({
  PageDataState: ({
    isLoading,
    isError,
    error,
    loadingLabel,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    loadingLabel: string;
    children: React.ReactNode;
  }) => {
    if (isLoading) return <div>{loadingLabel}</div>;
    if (isError) return <div>{error?.message}</div>;
    return <>{children}</>;
  },
}));

vi.mock('@/components/social/PlatformBadge', () => ({
  PlatformBadge: ({ platform }: { platform: string }) => <span>{platform}</span>,
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: vi.fn(() => ROLE_STATE),
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

let brandsState = BRANDS_QUERY_SUCCESS;
let accountsState = ACCOUNTS_QUERY_EMPTY;

vi.mock('@/hooks/social/useSocialBrands', () => ({
  useSocialBrands: vi.fn(() => brandsState),
}));

vi.mock('@/hooks/social/useSocialAccounts', () => ({
  useSocialAccounts: vi.fn((brandId?: string) => (brandId ? accountsState : ACCOUNTS_QUERY_EMPTY)),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
  },
}));

function makeBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: mockInsert,
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
  };
  return builder;
}

beforeEach(() => {
  brandsState = BRANDS_QUERY_SUCCESS;
  accountsState = ACCOUNTS_QUERY_EMPTY;
  toastSuccess.mockReset();
  toastError.mockReset();
  toastWarning.mockReset();
  mockInvoke.mockReset();
  mockInsert.mockReset();
  mockFrom.mockReset();
  mockFrom.mockImplementation(() => makeBuilder());
  mockInsert.mockResolvedValue({ error: null });
  mockInvoke.mockResolvedValue({ data: { published: { a1: true, a2: true }, errors: {} }, error: null });
});

it('affiche le chargement puis le contenu avec les valeurs métier attendues', async () => {
  brandsState = BRANDS_QUERY_LOADING;
  const { rerender } = render(<SocialComposer />);

  expect(screen.getByText('Chargement…')).toBeInTheDocument();

  brandsState = BRANDS_QUERY_SUCCESS;
  rerender(<SocialComposer />);

  expect(await screen.findByText('Composer un post')).toBeInTheDocument();
  expect(screen.getByText('Publication immédiate ou planifiée multi-plateformes.')).toBeInTheDocument();
  expect(screen.getByText('Marque A')).toBeInTheDocument();
  expect(screen.getByText('Marque B')).toBeInTheDocument();
  expect(screen.getByText('0 / 2200')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Publier maintenant' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Planifier' })).toBeDisabled();
});

it('affiche une erreur quand la requête des marques échoue', async () => {
  brandsState = BRANDS_QUERY_ERROR;

  render(<SocialComposer />);

  expect(screen.getByText('x')).toBeInTheDocument();
});

it('publie maintenant, appelle la function supabase avec les bons paramètres et réinitialise le formulaire', async () => {
  accountsState = ACCOUNTS_QUERY_SUCCESS;
  const user = userEvent.setup();

  render(<SocialComposer />);

  await user.click(screen.getByText('Marque A'));

  await waitFor(() => {
    expect(screen.getByText('Page FB')).toBeInTheDocument();
    expect(screen.getByText('Compte IG')).toBeInTheDocument();
  });

  await user.click(screen.getAllByRole('checkbox')[0]);
  await user.click(screen.getAllByRole('checkbox')[1]);
  await user.type(screen.getByLabelText('Message'), 'Bonjour réseau');
  await user.type(screen.getByLabelText('URL média (image ou vidéo publique)'), 'https://img.test/a.png');

  await user.click(screen.getByRole('button', { name: 'Publier maintenant' }));

  await waitFor(() => {
    expect(mockInvoke).toHaveBeenCalledWith('social-publish', {
      body: {
        message: 'Bonjour réseau',
        media_url: 'https://img.test/a.png',
        account_ids: ['a1', 'a2'],
      },
    });
  });

  expect(toastSuccess).toHaveBeenCalledWith('Publié sur 2 compte(s)');
  expect(screen.getByLabelText('Message')).toHaveValue('');
  expect(screen.getByLabelText('URL média (image ou vidéo publique)')).toHaveValue('');
  expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked();
  expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked();
});

it('planifie un post, insère en base avec les bonnes valeurs et réinitialise la date', async () => {
  accountsState = ACCOUNTS_QUERY_SUCCESS;
  const user = userEvent.setup();

  render(<SocialComposer />);

  await user.click(screen.getByText('Marque A'));

  await waitFor(() => {
    expect(screen.getByText('Page FB')).toBeInTheDocument();
  });

  await user.click(screen.getAllByRole('checkbox')[0]);
  await user.type(screen.getByLabelText('Message'), 'Post à planifier');
  await user.type(screen.getByLabelText('URL média (image ou vidéo publique)'), 'https://img.test/b.png');
  await user.type(screen.getByLabelText('Planifier pour (optionnel)'), '2026-01-02T10:30');

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Planifier' })).toBeEnabled();
  });

  await user.click(screen.getByRole('button', { name: 'Planifier' }));

  await waitFor(() => {
    expect(mockFrom).toHaveBeenCalledWith('social_scheduled_posts');
    expect(mockInsert).toHaveBeenCalledWith({
      brand_id: 'b1',
      message: 'Post à planifier',
      media_paths: ['https://img.test/b.png'],
      target_account_ids: ['a1'],
      scheduled_at: new Date('2026-01-02T10:30').toISOString(),
      status: 'scheduled',
      created_by: 'u1',
    });
  });

  expect(toastSuccess).toHaveBeenCalledWith('Post planifié');
  expect(screen.getByLabelText('Message')).toHaveValue('');
  expect(screen.getByLabelText('URL média (image ou vidéo publique)')).toHaveValue('');
  expect(screen.getByLabelText('Planifier pour (optionnel)')).toHaveValue('');
});

it('affiche une erreur si la publication immédiate échoue', async () => {
  accountsState = ACCOUNTS_QUERY_SUCCESS;
  mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
  const user = userEvent.setup();

  render(<SocialComposer />);

  await user.click(screen.getByText('Marque A'));

  await waitFor(() => {
    expect(screen.getByText('Page FB')).toBeInTheDocument();
  });

  await user.click(screen.getAllByRole('checkbox')[0]);
  await user.type(screen.getByLabelText('Message'), 'Erreur publish');

  await user.click(screen.getByRole('button', { name: 'Publier maintenant' }));

  await waitFor(() => {
    expect(toastError).toHaveBeenCalledWith('x');
  });
});

it('affiche une erreur si la planification échoue', async () => {
  accountsState = ACCOUNTS_QUERY_SUCCESS;
  mockInsert.mockResolvedValueOnce({ error: { message: 'x' } });
  const user = userEvent.setup();

  render(<SocialComposer />);

  await user.click(screen.getByText('Marque A'));

  await waitFor(() => {
    expect(screen.getByText('Page FB')).toBeInTheDocument();
  });

  await user.click(screen.getAllByRole('checkbox')[0]);
  await user.type(screen.getByLabelText('Message'), 'Erreur schedule');
  await user.type(screen.getByLabelText('Planifier pour (optionnel)'), '2026-01-02T10:30');

  await user.click(screen.getByRole('button', { name: 'Planifier' }));

  await waitFor(() => {
    expect(toastError).toHaveBeenCalledWith('x');
  });
});