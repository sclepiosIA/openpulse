import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BehavioralEventsTimeline } from './BehavioralEventsTimeline';

const {
  EVENTS,
  EMPTY_EVENTS,
  ERROR_MESSAGE,
  mockUseBehavioralEvents,
  mockFormatDistanceToNow,
} = vi.hoisted(() => ({
  EVENTS: [
    {
      id: 'ev-1',
      event_type: 'email_opened',
      weight: 5,
      occurred_at: '2024-01-10T12:00:00.000Z',
    },
    {
      id: 'ev-2',
      event_type: 'meeting_no_show',
      weight: -3,
      occurred_at: '2024-01-09T08:30:00.000Z',
    },
    {
      id: 'ev-3',
      event_type: 'unknown_event',
      weight: 0,
      occurred_at: '2024-01-08T09:15:00.000Z',
    },
  ],
  EMPTY_EVENTS: [],
  ERROR_MESSAGE: 'x',
  mockUseBehavioralEvents: vi.fn(),
  mockFormatDistanceToNow: vi.fn(),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/hooks/crm/useBehavioralScore', () => ({
  useBehavioralEvents: (...args: unknown[]) => mockUseBehavioralEvents(...args),
}));

vi.mock('@/types/scoring', () => ({
  BEHAVIORAL_EVENT_LABELS: {
    email_opened: 'Email ouvert',
    email_clicked: 'Email cliqué',
    email_replied: 'Email répondu',
    meeting_attended: 'Rendez-vous honoré',
    meeting_no_show: 'Absence au rendez-vous',
    task_completed: 'Tâche terminée',
    document_viewed: 'Document consulté',
    quick_response: 'Réponse rapide',
  },
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Mail: Icon,
    MousePointerClick: Icon,
    Reply: Icon,
    CalendarCheck: Icon,
    CalendarX: Icon,
    CheckSquare: Icon,
    FileText: Icon,
    Zap: Icon,
    Activity: Icon,
  };
});

vi.mock('date-fns', () => ({
  formatDistanceToNow: (...args: unknown[]) => mockFormatDistanceToNow(...args),
}));

vi.mock('date-fns/locale', () => ({
  fr: { code: 'fr' },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

describe('BehavioralEventsTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormatDistanceToNow.mockImplementation((date: Date) => {
      const iso = date.toISOString();
      if (iso === '2024-01-10T12:00:00.000Z') return 'il y a 1 jour';
      if (iso === '2024-01-09T08:30:00.000Z') return 'il y a 2 jours';
      return 'il y a 3 jours';
    });
  });

  it('affiche l’état de chargement', () => {
    mockUseBehavioralEvents.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<BehavioralEventsTimeline etablissementId="eta-1" />, { wrapper: Wrapper });

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.getByText('Événements récents')).toBeInTheDocument();
    expect(mockUseBehavioralEvents).toHaveBeenCalledWith('eta-1', 20);
  });

  it('affiche un message vide quand aucun événement n’est présent', () => {
    mockUseBehavioralEvents.mockReturnValue({
      data: EMPTY_EVENTS,
      isLoading: false,
    });

    render(<BehavioralEventsTimeline etablissementId="eta-empty" limit={7} />, { wrapper: Wrapper });

    expect(screen.getByText('Aucun événement comportemental enregistré.')).toBeInTheDocument();
    expect(mockUseBehavioralEvents).toHaveBeenCalledWith('eta-empty', 7);
  });

  it('affiche les événements avec libellés métier, poids et dates formatées', () => {
    mockUseBehavioralEvents.mockReturnValue({
      data: EVENTS,
      isLoading: false,
    });

    render(<BehavioralEventsTimeline etablissementId="eta-2" limit={3} />, { wrapper: Wrapper });

    expect(screen.getByTestId('scroll-area')).toBeInTheDocument();

    expect(screen.getByText('Email ouvert')).toBeInTheDocument();
    expect(screen.getByText('Absence au rendez-vous')).toBeInTheDocument();

    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('-3')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();

    expect(screen.getByText('il y a 1 jour')).toBeInTheDocument();
    expect(screen.getByText('il y a 2 jours')).toBeInTheDocument();
    expect(screen.getByText('il y a 3 jours')).toBeInTheDocument();

    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(3);
    expect(badges[0].className).toContain('text-emerald-600');
    expect(badges[1].className).toContain('text-red-500');
    expect(badges[2].className).toContain('text-emerald-600');

    expect(mockFormatDistanceToNow).toHaveBeenCalledTimes(3);
  });

  it('utilise l’icône de secours pour un type d’événement inconnu', () => {
    mockUseBehavioralEvents.mockReturnValue({
      data: [EVENTS[2]],
      isLoading: false,
    });

    render(<BehavioralEventsTimeline etablissementId="eta-3" />, { wrapper: Wrapper });

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getAllByTestId('icon')).toHaveLength(2);
  });

  it('peut être utilisé avec React Query et remonter une erreur côté hook', async () => {
    function TestErrorState({ etablissementId, limit }: { etablissementId: string; limit: number }) {
      const { isLoading, isError, error } = useQuery({
        queryKey: ['behavioral-events', etablissementId, limit],
        queryFn: async () => {
          const result = mockUseBehavioralEvents(etablissementId, limit) as {
            data: null;
            error: { message: string };
          };
          if (result.error) {
            throw new Error(result.error.message);
          }
          return result.data;
        },
      });

      return (
        <div>
          <span>{isLoading ? 'loading' : 'done'}</span>
          <span>{isError ? 'error' : 'ok'}</span>
          <span>{error instanceof Error ? error.message : ''}</span>
        </div>
      );
    }

    mockUseBehavioralEvents.mockReturnValue({
      data: null,
      error: { message: ERROR_MESSAGE },
    });

    render(<TestErrorState etablissementId="eta-error" limit={9} />, { wrapper: Wrapper });

    expect(await screen.findByText('done')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText(ERROR_MESSAGE)).toBeInTheDocument();
    expect(mockUseBehavioralEvents).toHaveBeenCalledWith('eta-error', 9);
  });
});