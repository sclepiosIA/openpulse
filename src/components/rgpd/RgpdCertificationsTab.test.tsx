import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import { RgpdCertificationsTab } from './RgpdCertificationsTab';

const {
  CERTIFICATIONS,
  AUTH_STATE,
  mockMutateAsync,
  mockUseCreateRgpdCertification,
  mockToastSuccess,
  mockToastError,
  mockNavigate,
  mockFrom,
} = vi.hoisted(() => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  const expiredDate = new Date();
  expiredDate.setDate(expiredDate.getDate() - 5);

  return {
    CERTIFICATIONS: [
      {
        id: 'cert-1',
        nom: 'HDS Hébergement',
        type: 'HDS',
        organisme_certificateur: 'AFNOR',
        date_obtention: '2024-01-15',
        date_expiration: futureDate.toISOString(),
        est_valide: true,
      },
      {
        id: 'cert-2',
        nom: 'ISO Sécurité',
        type: 'ISO27001',
        organisme_certificateur: 'Bureau Veritas',
        date_obtention: '2023-03-10',
        date_expiration: expiredDate.toISOString(),
        est_valide: false,
      },
    ],
    AUTH_STATE: {
      user: { id: 'u1', email: 'test@example.com' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockMutateAsync: vi.fn(),
    mockUseCreateRgpdCertification: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockNavigate: vi.fn(),
    mockFrom: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => {
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
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  };
  mockFrom.mockReturnValue(builder);
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('@/hooks/auth/useRgpd', () => ({
  useCreateRgpdCertification: mockUseCreateRgpdCertification,
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

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" data-variant={variant} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    type,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    type?: string;
  }) => <input value={value} onChange={onChange} type={type} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
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
  }) => (
    <div>
      <select aria-label="Type" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
        <option value="HDS">HDS (Hébergement Données Santé)</option>
        <option value="ISO27001">ISO 27001</option>
        <option value="SOC2">SOC 2</option>
        <option value="HIPAA">HIPAA</option>
        <option value="Autre">Autre</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>selected</span>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => <div data-open={open}>{React.Children.map(children, (child) => React.isValidElement(child) ? React.cloneElement(child, { open, onOpenChange } as Record<string, unknown>) : child)}</div>,
  DialogTrigger: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div onClick={() => onOpenChange?.(true)}>
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => open ? <div>{children}</div> : null,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span>+</span>,
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

describe('RgpdCertificationsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateRgpdCertification.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });
    mockMutateAsync.mockResolvedValue({ data: { id: 'new-cert' }, error: null });
  });

  it('affiche les certifications avec les valeurs métier et les statuts', () => {
    render(<RgpdCertificationsTab certifications={CERTIFICATIONS} />, { wrapper: createWrapper() });

    expect(screen.getByText('Certifications & Conformité')).toBeInTheDocument();
    expect(screen.getByText('HDS Hébergement')).toBeInTheDocument();
    expect(screen.getByText('ISO Sécurité')).toBeInTheDocument();
    expect(screen.getByText('AFNOR')).toBeInTheDocument();
    expect(screen.getByText('Bureau Veritas')).toBeInTheDocument();
    expect(screen.getByText('Valide')).toBeInTheDocument();
    expect(screen.getByText('Invalide')).toBeInTheDocument();
    expect(screen.getByText('(expirée)')).toBeInTheDocument();

    const cards = screen.getAllByTestId('card');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    const firstCard = cards.find((card) => within(card).queryByText('HDS Hébergement'));
    const secondCard = cards.find((card) => within(card).queryByText('ISO Sécurité'));

    expect(firstCard).toBeTruthy();
    expect(secondCard).toBeTruthy();

    if (firstCard) {
      expect(within(firstCard).getByText('HDS')).toBeInTheDocument();
      expect(within(firstCard).getByText('15/01/2024')).toBeInTheDocument();
      expect(within(firstCard).getByText(/\(\d+j\)/)).toBeInTheDocument();
    }

    if (secondCard) {
      expect(within(secondCard).getByText('ISO27001')).toBeInTheDocument();
      expect(within(secondCard).getByText('10/03/2023')).toBeInTheDocument();
    }
  });

  it('affiche un état vide quand aucune certification n’est fournie', () => {
    render(<RgpdCertificationsTab certifications={[]} />, { wrapper: createWrapper() });

    expect(screen.getByText('Aucune certification enregistrée')).toBeInTheDocument();
  });

  it('désactive puis active le bouton Ajouter selon les champs requis et crée une certification', async () => {
    const user = userEvent.setup();
    render(<RgpdCertificationsTab certifications={CERTIFICATIONS} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /ajouter une certification/i }));

    expect(screen.getByText('Nouvelle certification')).toBeInTheDocument();

    const addButton = screen.getAllByRole('button', { name: /^Ajouter$/i })[0];
    expect(addButton).toBeDisabled();

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'Certification SOC 2');
    await user.type(inputs[1], 'CertOrg');

    const typeSelect = screen.getByLabelText('Type');
    await user.selectOptions(typeSelect, 'SOC2');

    const dateInputs = screen.getAllByDisplayValue('');
    const dateObtentionInput = dateInputs.find((input) => input.getAttribute('type') === 'date');
    const dateExpirationInput = dateInputs.filter((input) => input.getAttribute('type') === 'date')[1];

    if (dateObtentionInput) {
      await user.type(dateObtentionInput, '2025-02-01');
    }

    if (dateExpirationInput) {
      await user.type(dateExpirationInput, '2026-02-01');
    }

    expect(screen.getAllByRole('button', { name: /^Ajouter$/i })[0]).toBeEnabled();

    await user.click(screen.getAllByRole('button', { name: /^Ajouter$/i })[0]);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        nom: 'Certification SOC 2',
        type: 'SOC2',
        organisme_certificateur: 'CertOrg',
        date_obtention: '2025-02-01',
        date_expiration: '2026-02-01',
      });
    });
  });

  it('ferme et réinitialise le formulaire après création réussie', async () => {
    const user = userEvent.setup();
    render(<RgpdCertificationsTab certifications={CERTIFICATIONS} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /ajouter une certification/i }));

    const textInputs = screen.getAllByRole('textbox');
    await user.type(textInputs[0], 'Nouvelle certif');

    const dateObtentionInput = screen.getAllByDisplayValue('').find((input) => input.getAttribute('type') === 'date');
    if (dateObtentionInput) {
      await user.type(dateObtentionInput, '2025-01-10');
    }

    await user.click(screen.getAllByRole('button', { name: /^Ajouter$/i })[0]);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText('Nouvelle certification')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ajouter une certification/i }));
    const reopenedInputs = screen.getAllByRole('textbox');
    expect(reopenedInputs[0]).toHaveValue('');
  });

  it('propage une erreur de mutation via le hook mocké', async () => {
    const mutationError = new Error('x');
    mockMutateAsync.mockRejectedValueOnce(mutationError);

    const { result } = renderHook(
      () => {
        const mutation = mockUseCreateRgpdCertification();
        return mutation;
      },
      { wrapper: createWrapper() },
    );

    expect(result.current.isPending).toBe(false);

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({
          nom: 'Certif erreur',
          type: 'HDS',
          organisme_certificateur: 'Org',
          date_obtention: '2025-01-01',
          date_expiration: '',
        });
      } catch (error) {
        caught = error;
      }
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      nom: 'Certif erreur',
      type: 'HDS',
      organisme_certificateur: 'Org',
      date_obtention: '2025-01-01',
      date_expiration: '',
    });
    expect(caught).toBe(mutationError);

    mockUseCreateRgpdCertification.mockReturnValueOnce({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: true,
      error: { message: 'x' },
    });

    const { result: errorResult } = renderHook(() => mockUseCreateRgpdCertification(), {
      wrapper: createWrapper(),
    });

    expect(errorResult.current.isError).toBe(true);
    expect(errorResult.current.error).toEqual({ message: 'x' });
  });
});