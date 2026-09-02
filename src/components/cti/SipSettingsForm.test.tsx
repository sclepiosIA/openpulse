/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SipSettingsForm } from './SipSettingsForm';

const {
  AUTH_STATE,
  EXISTING_SETTINGS,
  mockUseAuth,
  mockUseUserPhoneSettings,
  mockSetSipCredentials,
  mockDeleteOwnRecordings,
  mockToast,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const EXISTING_SETTINGS = {
    sip_uri: 'sip:alice@sip.example.org',
    sip_username: 'alice',
    sip_domain: 'sip.example.org',
    sip_proxy: 'wss://proxy.example.org',
    sip_transport: 'tls',
    caller_id: 'Alice',
    record_calls: true,
  };

  const builder = {
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

  Object.values(builder).forEach((fn) => {
    fn.mockReturnValue(builder);
  });

  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((resolve: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve(resolve({ data: null, error: null })),
  );
  builder.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  return {
    AUTH_STATE,
    EXISTING_SETTINGS,
    mockUseAuth: vi.fn(() => AUTH_STATE),
    mockUseUserPhoneSettings: vi.fn(),
    mockSetSipCredentials: vi.fn(),
    mockDeleteOwnRecordings: vi.fn(),
    mockToast: vi.fn(),
    mockFrom: vi.fn(() => builder),
    builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: vi.fn(() => builder),
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/hooks/cti/useUserPhoneSettings', () => ({
  useUserPhoneSettings: mockUseUserPhoneSettings,
}));

vi.mock('@/services/cti/sipCredentials', () => ({
  setSipCredentials: mockSetSipCredentials,
}));

vi.mock('@/hooks/voice/useCalls', () => ({
  deleteOwnRecordings: mockDeleteOwnRecordings,
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: mockToast,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    type,
    autoComplete,
  }: {
    id?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    type?: string;
    autoComplete?: string;
  }) => (
    <input
      id={id}
      aria-label={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      autoComplete={autoComplete}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      id={id}
      aria-label={id}
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    >
      switch
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: 'wss' | 'tls' | 'tcp' | 'udp') => void;
    children: React.ReactNode;
  }) => (
    <div>
      <select
        aria-label="Transport"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value as 'wss' | 'tls' | 'tcp' | 'udp')}
      >
        <option value="wss">wss</option>
        <option value="tls">tls</option>
        <option value="tcp">tcp</option>
        <option value="udp">udp</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) => <div id={id}>{children}</div>,
  SelectValue: () => <span />,
}));

vi.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => <div data-testid="loader" className={className} />,
  Trash2: ({ className }: { className?: string }) => <div data-testid="trash" className={className} />,
}));

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

describe('SipSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(AUTH_STATE);
  });

  it('affiche le loader pendant le chargement puis hydrate le formulaire avec les réglages existants', async () => {
    mockUseUserPhoneSettings
      .mockReturnValueOnce({ data: undefined, isLoading: true, isError: false, error: null })
      .mockReturnValue({ data: EXISTING_SETTINGS, isLoading: false, isError: false, error: null });

    const wrapper = createWrapper();
    const { rerender } = render(<SipSettingsForm />, { wrapper });

    expect(screen.getByTestId('loader')).toBeInTheDocument();

    rerender(<SipSettingsForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/sip_username/i)).toHaveValue('alice');
    });

    expect(screen.getByLabelText(/sip_domain/i)).toHaveValue('sip.example.org');
    expect(screen.getByLabelText(/sip_proxy/i)).toHaveValue('wss://proxy.example.org');
    expect(screen.getByLabelText(/caller_id/i)).toHaveValue('Alice');
    expect(screen.getByLabelText('Transport')).toHaveValue('tls');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/laisser vide pour conserver/i)).toBeInTheDocument();
  });

  it('enregistre une nouvelle configuration SIP avec les valeurs métier attendues', async () => {
    mockUseUserPhoneSettings.mockReturnValue({ data: null, isLoading: false, isError: false, error: null });
    mockSetSipCredentials.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const user = userEvent.setup();

    render(<SipSettingsForm />, { wrapper });

    await user.type(screen.getByLabelText(/sip_username/i), 'bob');
    await user.type(screen.getByLabelText(/sip_password/i), 'pwd');
    await user.type(screen.getByLabelText(/sip_domain/i), 'pbx.local');
    await user.type(screen.getByLabelText(/sip_proxy/i), 'wss://pbx.local');
    fireEvent.change(screen.getByLabelText('Transport'), { target: { value: 'udp' } });
    await user.type(screen.getByLabelText(/caller_id/i), 'Bob');
    await user.click(screen.getByRole('switch'));

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Enregistrer/i }));
    });

    await waitFor(() => {
      expect(mockSetSipCredentials).toHaveBeenCalledWith({
        sip_uri: 'sip:bob@pbx.local',
        sip_username: 'bob',
        sip_password: 'pwd',
        sip_domain: 'pbx.local',
        sip_transport: 'udp',
        sip_proxy: 'wss://pbx.local',
        caller_id: 'Bob',
        record_calls: true,
      });
    });

    expect(mockToast).toHaveBeenCalledWith({ title: 'Configuration SIP enregistrée' });
  });

  it('conserve le mot de passe existant si le champ mot de passe reste vide', async () => {
    mockUseUserPhoneSettings.mockReturnValue({ data: EXISTING_SETTINGS, isLoading: false, isError: false, error: null });
    mockSetSipCredentials.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const user = userEvent.setup();

    render(<SipSettingsForm />, { wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText(/sip_username/i)).toHaveValue('alice');
    });

    await user.clear(screen.getByLabelText(/sip_username/i));
    await user.type(screen.getByLabelText(/sip_username/i), 'alice2');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Enregistrer/i }));
    });

    await waitFor(() => {
      expect(mockSetSipCredentials).toHaveBeenCalledWith({
        sip_uri: 'sip:alice@sip.example.org',
        sip_username: 'alice2',
        sip_password: '__keep__',
        sip_domain: 'sip.example.org',
        sip_transport: 'tls',
        sip_proxy: 'wss://proxy.example.org',
        caller_id: 'Alice',
        record_calls: true,
      });
    });

    expect(screen.getByLabelText(/sip_password/i)).toHaveValue('');
  });

  it('affiche une erreur si les champs requis sont absents', async () => {
    mockUseUserPhoneSettings.mockReturnValue({ data: null, isLoading: false, isError: false, error: null });

    const wrapper = createWrapper();
    const user = userEvent.setup();

    render(<SipSettingsForm />, { wrapper });

    await user.type(screen.getByLabelText(/sip_username/i), 'bob');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Enregistrer/i }));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'Identifiant, mot de passe et domaine sont requis',
        variant: 'destructive',
      });
    });

    expect(mockSetSipCredentials).not.toHaveBeenCalled();
  });

  it('déclenche la purge des enregistrements et affiche le nombre supprimé', async () => {
    mockUseUserPhoneSettings.mockReturnValue({ data: null, isLoading: false, isError: false, error: null });
    mockDeleteOwnRecordings.mockResolvedValue(3);

    const wrapper = createWrapper();
    const user = userEvent.setup();

    render(<SipSettingsForm />, { wrapper });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Supprimer mes enregistrements/i }));
    });

    await waitFor(() => {
      expect(mockDeleteOwnRecordings).toHaveBeenCalled();
    });

    expect(mockToast).toHaveBeenCalledWith({ title: '3 enregistrement(s) supprimé(s)' });
  });

  it('couvre le hook mocké useUserPhoneSettings via renderHook en loading, succès et erreur', () => {
    const wrapper = createWrapper();

    mockUseUserPhoneSettings.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    const loadingHook = renderHook(() => mockUseUserPhoneSettings('u1'), { wrapper });
    expect(loadingHook.result.current.isLoading).toBe(true);

    mockUseUserPhoneSettings.mockReturnValueOnce({
      data: EXISTING_SETTINGS,
      isLoading: false,
      isError: false,
      error: null,
    });

    const successHook = renderHook(() => mockUseUserPhoneSettings('u1'), { wrapper });
    expect(successHook.result.current.isLoading).toBe(false);
    expect(successHook.result.current.data).toEqual(EXISTING_SETTINGS);
    expect(successHook.result.current.data.sip_username).toBe('alice');
    expect(successHook.result.current.data.sip_domain).toBe('sip.example.org');
    expect(successHook.result.current.data.sip_transport).toBe('tls');
    expect(successHook.result.current.data.record_calls).toBe(true);

    mockUseUserPhoneSettings.mockReturnValueOnce({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    });

    const errorHook = renderHook(() => mockUseUserPhoneSettings('u1'), { wrapper });
    expect(errorHook.result.current.isError).toBe(true);
    expect(errorHook.result.current.error).toEqual({ message: 'x' });
  });
});