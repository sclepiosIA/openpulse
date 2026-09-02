import React from 'react';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockUseBehavioralScore, mockAck, mockToast, mockNavigate, mockGetScoreTier } = vi.hoisted(() => {
  return {
    mockUseBehavioralScore: vi.fn(),
    mockAck: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
    mockToast: vi.fn(),
    mockNavigate: vi.fn(),
    mockGetScoreTier: vi.fn((score: number) => ({ label: `tier-${score}` })),
  };
});

vi.mock('@/hooks/crm/useBehavioralScore', () => {
  return {
    useBehavioralScore: (...args: unknown[]) => {
      return mockUseBehavioralScore(...args);
    },
    useAcknowledgeProspect: () => {
      return mockAck;
    },
  };
});

vi.mock('@/hooks/shared/use-toast', () => {
  return {
    useToast: () => ({ toast: mockToast }),
  };
});

vi.mock('react-router-dom', () => {
  return {
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/types/scoring', () => {
  return {
    getScoreTier: (...args: unknown[]) => {
      // delegate to hoisted stable mock
      // @ts-expect-error - dynamic forwarding
      return mockGetScoreTier(...args);
    },
  };
});

vi.mock('@/components/ui/sheet', () => {
  const Sheet = ({ children, open, onOpenChange, ...rest }: any) => (
    <div data-testid="sheet" data-open={String(open)} {...rest}>
      {children}
    </div>
  );
  const SheetContent = ({ children, ...rest }: any) => <div data-testid="sheet-content" {...rest}>{children}</div>;
  const SheetHeader = ({ children, ...rest }: any) => <header {...rest}>{children}</header>;
  const SheetTitle = ({ children, ...rest }: any) => <h2 {...rest}>{children}</h2>;
  const SheetDescription = ({ children, ...rest }: any) => <p {...rest}>{children}</p>;
  return { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription };
});

vi.mock('@/components/ui/button', () => {
  return {
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  };
});

vi.mock('@/components/ui/badge', () => {
  return {
    Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
  };
});

vi.mock('@/components/ui/card', () => {
  return {
    Card: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
  };
});

vi.mock('@/components/ui/input', () => {
  return {
    Input: (props: any) => {
      const { value, onChange, ...rest } = props;
      return <input {...rest} value={value} onChange={onChange} />;
    },
  };
});

vi.mock('@/components/ui/textarea', () => {
  return {
    Textarea: (props: any) => {
      const { value, onChange, ...rest } = props;
      return <textarea {...rest} value={value} onChange={onChange} />;
    },
  };
});

vi.mock('@/components/ui/label', () => {
  return {
    Label: (props: any) => <label {...props}>{props.children}</label>,
  };
});

vi.mock('./BehavioralEventsTimeline', () => {
  return {
    BehavioralEventsTimeline: ({ etablissementId, limit }: any) => (
      <div data-testid="behavioral-timeline">timeline-{String(etablissementId)}-{String(limit)}</div>
    ),
  };
});

vi.mock('./AttributionFunnel', () => {
  return {
    AttributionFunnel: ({ etablissementId }: any) => <div data-testid="attribution-funnel">funnel-{String(etablissementId)}</div>,
  };
});

vi.mock('./ProspectSparkline', () => {
  return {
    ProspectSparkline: ({ etablissementId, days, height }: any) => (
      <div data-testid="prospect-sparkline">sparkline-{String(etablissementId)}-{String(days)}-{String(height)}</div>
    ),
  };
});

vi.mock('lucide-react', () => {
  const Svg = (props: any) => <svg {...props} />;
  return {
    ExternalLink: Svg,
    ListPlus: Svg,
    BellOff: Svg,
    Activity: Svg,
  };
});

describe('ProspectScoringSheet', () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = createQueryClient();
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBehavioralScore.mockReturnValue({ data: undefined, isLoading: false, error: null, isError: false });
    mockAck.mutateAsync = vi.fn().mockResolvedValue({});
    mockAck.isPending = false;
    mockToast.mockClear();
    mockNavigate.mockClear();
    mockGetScoreTier.mockImplementation((score: number) => ({ label: `tier-${score}` }));
    // run required trivial renderHook inside QueryClientProvider
    renderHook(() => ({}), { wrapper: Wrapper });
  });

  it('affiche un état de chargement (badge "…") lorsque le hook est en isLoading', async () => {
    mockUseBehavioralScore.mockReturnValue({ data: undefined, isLoading: true, error: null, isError: false });

    const { ProspectScoringSheet } = await import('./ProspectScoringSheet');

    render(
      <Wrapper>
        <ProspectScoringSheet etablissementId="e1" etablissementNom="Mon établissement" open={true} onOpenChange={vi.fn()} />
      </Wrapper>
    );

    expect(screen.getByText('Mon établissement')).toBeTruthy();
    expect(screen.getByText('…')).toBeTruthy();
    expect(screen.getByText(/Vélocité \(7j\)/)).toBeTruthy();
    expect(screen.getByTestId('prospect-sparkline')).toBeTruthy();
    expect(screen.getByTestId('behavioral-timeline')).toBeTruthy();
    expect(screen.getByTestId('attribution-funnel')).toBeTruthy();
  });

  it('affiche les valeurs métier correctes quand le hook renvoie des données', async () => {
    mockUseBehavioralScore.mockReturnValue({
      data: { behavioral_score: 7, engagement_velocity: 3 },
      isLoading: false,
      error: null,
      isError: false,
    });

    mockGetScoreTier.mockImplementation((score: number) => ({ label: `tier-${score}` }));

    const { ProspectScoringSheet } = await import('./ProspectScoringSheet');

    const onOpenChange = vi.fn();

    render(
      <Wrapper>
        <ProspectScoringSheet etablissementId="e1" etablissementNom="Test Nom" open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    expect(screen.getByText('7/50')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('tier-14')).toBeTruthy();

    const ficheBtn = screen.getByText('Fiche complète');
    const tacheBtn = screen.getByText('Créer une tâche');

    fireEvent.click(ficheBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/etablissements/e1');

    fireEvent.click(tacheBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/taches/new?etablissement_id=e1');
  });

  it("gère un résultat d'erreur du hook (data=null, error present) en affichant 0 et un tier neutral", async () => {
    mockUseBehavioralScore.mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: 'boom' },
      isError: true,
    });

    mockGetScoreTier.mockImplementation((score: number) => ({ label: `tier-${score}` }));

    const { ProspectScoringSheet } = await import('./ProspectScoringSheet');

    render(
      <Wrapper>
        <ProspectScoringSheet etablissementId="e2" etablissementNom="Err Nom" open={true} onOpenChange={vi.fn()} />
      </Wrapper>
    );

    expect(screen.getByText('0/50')).toBeTruthy();
    expect(screen.getByText('tier-0')).toBeTruthy();
    // one of the displayed zeros corresponds to engagement_velocity
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
  });

  it('effectue la mutation de snooze et appelle toast + onOpenChange à la confirmation', async () => {
    mockUseBehavioralScore.mockReturnValue({
      data: { behavioral_score: 5, engagement_velocity: 1 },
      isLoading: false,
      error: null,
      isError: false,
    });

    mockAck.mutateAsync = vi.fn().mockResolvedValue({});
    mockAck.isPending = false;

    const { ProspectScoringSheet } = await import('./ProspectScoringSheet');

    const onOpenChange = vi.fn();

    render(
      <Wrapper>
        <ProspectScoringSheet etablissementId="e1" etablissementNom="Nom Snooze" open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    const snoozeToggle = screen.getByText('Snooze');
    fireEvent.click(snoozeToggle);

    const dateInput = screen.getByLabelText("Jusqu'au") as HTMLInputElement;
    const noteTextarea = screen.getByLabelText('Note') as HTMLTextAreaElement;

    await act(async () => {
      fireEvent.change(dateInput, { target: { value: '2026-01-01' } });
      fireEvent.change(noteTextarea, { target: { value: 'motif de pause' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Confirmer le snooze'));
      await waitFor(() => expect(mockAck.mutateAsync).toHaveBeenCalled());
    });

    expect(mockAck.mutateAsync).toHaveBeenCalledWith({ id: 'e1', until: '2026-01-01', note: 'motif de pause' });

    expect(mockToast).toHaveBeenCalled();
    const toastArg = mockToast.mock.calls[0]?.[0];
    expect(typeof toastArg).toBe('object');
    expect(String(toastArg?.title)).toBe('Prospect mis en pause');
    expect(String(toastArg?.description)).toContain('2026-01-01');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});