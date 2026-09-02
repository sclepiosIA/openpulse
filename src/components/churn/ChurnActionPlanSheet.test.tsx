/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChurnActionPlanSheet } from './ChurnActionPlanSheet';

const {
  navigateMock,
  ackMutateAsync,
  genEmailMutateAsync,
  toastSuccess,
  prediction,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  ackMutateAsync: vi.fn(),
  genEmailMutateAsync: vi.fn(),
  toastSuccess: vi.fn(),
  prediction: {
    etablissement_id: 'etab-1',
    score: 78.4,
    factors: { activity_drop: 0.7, unpaid_invoice: 0.3 },
    recommendations: ['Appeler le client', 'Proposer une formation'],
    etablissement: { nom: 'Boulangerie du Centre' },
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/hooks/csm/useChurnPredictions', () => ({
  useAcknowledgeChurn: () => ({
    mutateAsync: ackMutateAsync,
    isPending: false,
    isError: false,
  }),
  useGenerateRetentionEmail: () => ({
    mutateAsync: genEmailMutateAsync,
    isPending: false,
    isError: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: vi.fn(),
  },
}));

vi.mock('./ChurnFactorBars', () => ({
  ChurnFactorBars: () => <div data-testid="churn-factor-bars" />,
}));

vi.mock('./ChurnSparkline', () => ({
  ChurnSparkline: () => <div data-testid="churn-sparkline" />,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div data-testid="sheet-root">{children}</div> : null),
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
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
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    id,
    type,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    id?: string;
    type?: string;
  }) => <input id={id} type={type} value={value} onChange={onChange} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    id,
    rows,
    placeholder,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    id?: string;
    rows?: number;
    placeholder?: string;
  }) => <textarea id={id} value={value} onChange={onChange} rows={rows} placeholder={placeholder} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('lucide-react', () => {
  const Icon = () => <span aria-hidden="true" />;
  return {
    Wand2: Icon,
    ListPlus: Icon,
    BellOff: Icon,
    ExternalLink: Icon,
    Mail: Icon,
    Copy: Icon,
    Loader2: Icon,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderComponent(overrideProps?: Partial<React.ComponentProps<typeof ChurnActionPlanSheet>>) {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <ChurnActionPlanSheet
        prediction={prediction}
        open={true}
        onOpenChange={vi.fn()}
        {...overrideProps}
      />
    </Wrapper>
  );
}

describe('ChurnActionPlanSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    genEmailMutateAsync.mockResolvedValue({ subject: 'Offre spéciale', body: 'Nous pouvons vous aider à relancer l’usage.' });
    ackMutateAsync.mockResolvedValue({ data: { ok: true }, error: null });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it('ne rend rien si prediction est null', () => {
    const Wrapper = createWrapper();
    const { container } = render(
      <Wrapper>
        <ChurnActionPlanSheet prediction={null} open={true} onOpenChange={vi.fn()} />
      </Wrapper>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('affiche les informations métier principales et les composants internes', () => {
    renderComponent();

    expect(screen.getByText("Plan d'action")).toBeInTheDocument();
    expect(screen.getByText('Boulangerie du Centre · Score 78/100')).toBeInTheDocument();
    expect(screen.getByText('Évolution 90 jours')).toBeInTheDocument();
    expect(screen.getByText('Facteurs déclencheurs')).toBeInTheDocument();
    expect(screen.getByText('Recommandations IA')).toBeInTheDocument();
    expect(screen.getByText('Appeler le client')).toBeInTheDocument();
    expect(screen.getByText('Proposer une formation')).toBeInTheDocument();
    expect(screen.getByTestId('churn-sparkline')).toBeInTheDocument();
    expect(screen.getByTestId('churn-factor-bars')).toBeInTheDocument();
  });

  it('navigue vers la création de tâche depuis une recommandation', () => {
    renderComponent();

    const taskButtons = screen.getAllByRole('button', { name: /tâche/i });
    fireEvent.click(taskButtons[0]);

    expect(navigateMock).toHaveBeenCalledWith('/taches/new?etablissement_id=etab-1&titre=Appeler%20le%20client');
  });

  it('génère, affiche puis copie un email de rétention', async () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /générer un email de rétention/i }));

    await waitFor(() => {
      expect(genEmailMutateAsync).toHaveBeenCalledWith('etab-1');
    });

    expect(await screen.findByDisplayValue('Offre spéciale')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nous pouvons vous aider à relancer l’usage.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copier/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Objet : Offre spéciale\n\nNous pouvons vous aider à relancer l’usage.'
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith('Email copié');
  });

  it('ouvre le formulaire marquer traité et confirme la mutation avec les valeurs saisies', async () => {
    const onOpenChange = vi.fn();
    renderComponent({ onOpenChange });

    fireEvent.click(screen.getByRole('button', { name: /marquer traité/i }));

    const dateInput = screen.getByLabelText(/suivi jusqu'au/i);
    const noteInput = screen.getByLabelText(/note/i);

    fireEvent.change(dateInput, { target: { value: '2026-01-15' } });
    fireEvent.change(noteInput, { target: { value: 'Client rappelé, démo planifiée' } });

    fireEvent.click(screen.getByRole('button', { name: /confirmer/i }));

    await waitFor(() => {
      expect(ackMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(ackMutateAsync).toHaveBeenCalledWith({
      etabId: 'etab-1',
      until: new Date('2026-01-15').toISOString(),
      note: 'Client rappelé, démo planifiée',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('navigue vers la fiche complète et la création de tâche globale', () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /fiche complète/i }));
    fireEvent.click(screen.getByRole('button', { name: /^créer une tâche$/i }));

    expect(navigateMock).toHaveBeenNthCalledWith(1, '/etablissements/etab-1');
    expect(navigateMock).toHaveBeenNthCalledWith(2, '/taches/new?etablissement_id=etab-1');
  });

  it('propage une erreur de génération d’email sans afficher les champs d’édition', async () => {
    genEmailMutateAsync.mockRejectedValueOnce(new Error('x'));
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /générer un email de rétention/i }));

    await waitFor(() => {
      expect(genEmailMutateAsync).toHaveBeenCalledWith('etab-1');
    });

    expect(screen.queryByLabelText(/objet/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/corps/i)).not.toBeInTheDocument();
  });
});