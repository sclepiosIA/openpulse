import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RgpdDemandesTab } from './RgpdDemandesTab';

const {
  DROIT_TYPE_LABELS,
  DEMANDE_STATUT_LABELS,
  DEMANDE_STATUT_COLORS,
  mockInvokeEdge,
  toastSuccess,
  toastError,
  mockCreateMutateAsync,
  mockUpdateMutate,
  stableNow,
} = vi.hoisted(() => {
  const DROIT_TYPE_LABELS = {
    acces: "Droit d'accès",
    rectification: 'Rectification',
    effacement: 'Effacement',
    opposition: 'Opposition',
    portabilite: 'Portabilité',
    limitation: 'Limitation',
  } as const;

  const DEMANDE_STATUT_LABELS = {
    nouvelle: 'Nouvelle',
    en_cours: 'En cours',
    completee: 'Complétée',
    rejetee: 'Rejetée',
  } as const;

  const DEMANDE_STATUT_COLORS = {
    nouvelle: 'bg-blue-100 text-blue-800',
    en_cours: 'bg-yellow-100 text-yellow-800',
    completee: 'bg-green-100 text-green-800',
    rejetee: 'bg-red-100 text-red-800',
  } as const;

  const mockInvokeEdge = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();

  const mockCreateMutateAsync = vi.fn().mockResolvedValue({ id: 'req1' });
  const mockUpdateMutate = vi.fn();

  const stableNow = new Date('2026-01-10T12:00:00.000Z');

  return {
    DROIT_TYPE_LABELS,
    DEMANDE_STATUT_LABELS,
    DEMANDE_STATUT_COLORS,
    mockInvokeEdge,
    toastSuccess,
    toastError,
    mockCreateMutateAsync,
    mockUpdateMutate,
    stableNow,
  };
});

vi.mock('@/types/rgpd', () => ({
  DROIT_TYPE_LABELS,
  DEMANDE_STATUT_LABELS,
  DEMANDE_STATUT_COLORS,
}));

vi.mock('@/hooks/auth/useRgpd', () => ({
  useCreateRgpdDemande: () => ({
    mutateAsync: mockCreateMutateAsync,
  }),
  useUpdateRgpdDemande: () => ({
    mutate: mockUpdateMutate,
  }),
}));

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: mockInvokeEdge,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" data-class={className || ''}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    size?: string;
    variant?: string;
  }) => (
    <button type={type || 'button'} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    type,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
  }) => (
    <input
      aria-label={type === 'email' ? 'email-input' : 'text-input'}
      type={type || 'text'}
      value={value || ''}
      onChange={onChange}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  }) => <textarea aria-label="textarea" value={value || ''} onChange={onChange} />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div data-testid="select">{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: () => <span data-testid="select-value" />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value?: string }) => (
    <div data-testid="select-item">{children}</div>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
  }) => (
    <div data-testid="dialog" data-open={open ? 'true' : 'false'}>
      {children}
    </div>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({
    children,
    colSpan,
    className,
  }: {
    children: React.ReactNode;
    colSpan?: number;
    className?: string;
  }) => (
    <td colSpan={colSpan} data-class={className || ''}>
      {children}
    </td>
  ),
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  ShieldX: () => <span data-testid="icon-shieldx" />,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('RgpdDemandesTab', () => {
  it('affiche le message vide quand aucune demande', () => {
    renderWithClient(<RgpdDemandesTab demandes={[]} />);
    expect(screen.getByText("Demandes d'exercice de droits")).toBeInTheDocument();
    expect(screen.getByText('Aucune demande enregistrée')).toBeInTheDocument();
  });

  it('affiche les données métier (numéro, type, demandeur, dates, statut) et déclenche la mutation "Traiter"', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(stableNow);

    const demandes = [
      {
        id: 'd1',
        numero: 'RGPD-0001',
        type_droit: 'acces',
        demandeur_email: 'person1@exemple.fr',
        demandeur_nom: 'Personne Un',
        description: '',
        date_demande: '2026-01-08T00:00:00.000Z',
        date_limite: '2026-01-20T00:00:00.000Z',
        statut: 'nouvelle',
      },
      {
        id: 'd2',
        numero: 'RGPD-0001',
        type_droit: 'acces',
        demandeur_email: 'person2@exemple.fr',
        demandeur_nom: 'Personne Deux',
        description: '',
        date_demande: '2026-01-07T00:00:00.000Z',
        date_limite: '2026-01-19T00:00:00.000Z',
        statut: 'nouvelle',
      },
    ];

    renderWithClient(<RgpdDemandesTab demandes={demandes} />);

    const row = screen.getByText('person1@exemple.fr').closest('tr');
    if (!row) throw new Error('Row not found');

    expect(within(row).getByText('RGPD-0001')).toBeInTheDocument();
    expect(within(row).getByText(DROIT_TYPE_LABELS.acces)).toBeInTheDocument();
    expect(within(row).getByText('Personne Un')).toBeInTheDocument();
    expect(within(row).getByText('08/01/2026')).toBeInTheDocument();
    expect(within(row).getByText('20/01/2026')).toBeInTheDocument();

    const badge = within(row).getByTestId('badge');
    expect(badge).toHaveTextContent(DEMANDE_STATUT_LABELS.nouvelle);
    expect(badge.getAttribute('data-class')).toBe(DEMANDE_STATUT_COLORS.nouvelle);

    const traiterBtn = within(row).getByRole('button', { name: 'Traiter' });
    await act(async () => {
      fireEvent.click(traiterBtn);
    });

    expect(mockUpdateMutate).toHaveBeenCalledTimes(1);
    expect(mockUpdateMutate).toHaveBeenCalledWith({ id: 'd1', statut: 'en_cours' });

    vi.useRealTimers();
  });

  it("anonymise une demande d'effacement: succès puis erreur", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(stableNow);

    const demandes = [
      {
        id: 'd-eff',
        numero: 'RGPD-0002',
        type_droit: 'effacement',
        demandeur_email: 'a@exemple.fr',
        demandeur_nom: 'Alpha',
        description: '',
        date_demande: '2026-01-01T00:00:00.000Z',
        date_limite: '2026-01-05T00:00:00.000Z',
        statut: 'en_cours',
      },
    ];

    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockReturnValue(true);

    mockInvokeEdge.mockResolvedValueOnce({ report: { total_records: 3 } });

    renderWithClient(<RgpdDemandesTab demandes={demandes} />);

    const row = screen.getByText('a@exemple.fr').closest('tr');
    if (!row) throw new Error('Row not found');

    const anonymiserBtn = within(row).getByRole('button', { name: 'Anonymiser' });
    await act(async () => {
      fireEvent.click(anonymiserBtn);
    });

    expect(mockInvokeEdge).toHaveBeenCalledTimes(1);
    expect(mockInvokeEdge).toHaveBeenCalledWith('rgpd-anonymize', {
      personEmail: 'a@exemple.fr',
      personName: 'Alpha',
      requestId: 'd-eff',
    });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(String(toastSuccess.mock.calls[0]?.[0] ?? '')).toContain('3');

    mockInvokeEdge.mockRejectedValueOnce({ message: 'x' });

    const anonymiserBtn2 = within(row).getByRole('button', { name: 'Anonymiser' });
    await act(async () => {
      fireEvent.click(anonymiserBtn2);
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith('x');

    confirmSpy.mockRestore();
    vi.useRealTimers();
  });

  it('crée une nouvelle demande via le formulaire et appelle mutateAsync avec les champs saisis', async () => {
    renderWithClient(<RgpdDemandesTab demandes={[]} />);

    const openBtn = screen.getByRole('button', { name: /Nouvelle demande/i });
    await act(async () => {
      fireEvent.click(openBtn);
    });

    const emailInput = screen.getByLabelText('email-input');
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'new@exemple.fr' } });
    });

    const textInputs = screen.getAllByLabelText('text-input');
    expect(textInputs.length).toBeGreaterThan(0);
    const nameInput = textInputs[0];

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Nouveau Nom' } });
    });

    const textarea = screen.getByLabelText('textarea');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Demande de test' } });
    });

    const createBtn = screen.getByRole('button', { name: 'Créer la demande' });
    expect(createBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(createBtn);
    });

    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({
      type_droit: 'acces',
      demandeur_email: 'new@exemple.fr',
      demandeur_nom: 'Nouveau Nom',
      description: 'Demande de test',
    });
  });
});