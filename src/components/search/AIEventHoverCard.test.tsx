// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AIEventHoverCard } from './AIEventHoverCard';

const {
  EVENT_VIDEO,
  EVENT_PAST,
  EVENT_ALL_DAY,
  TRIGGER_TEXT,
  mockFrom,
  mockEq,
  mockMaybeSingle,
} = vi.hoisted(() => {
  const EVENT_VIDEO = {
    id: 'evt-video',
    title: 'Réunion équipe',
    description: 'Point hebdomadaire projet',
    start_time: '2099-06-15T10:00:00.000Z',
    end_time: '2099-06-15T11:30:00.000Z',
    all_day: false,
    location: 'Salle 12',
    video_conference_url: 'https://meet.local/room',
    status: 'confirmed',
    etablissement: {
      id: 'eta-1',
      nom: 'Lycée Horizon',
    },
  };

  const EVENT_PAST = {
    id: 'evt-past',
    title: 'Entretien passé',
    description: 'Compte rendu',
    start_time: '2020-01-10T09:00:00.000Z',
    end_time: '2020-01-10T09:45:00.000Z',
    all_day: false,
    location: 'Bureau A',
    video_conference_url: null,
    status: 'done',
    etablissement: {
      id: 'eta-2',
      nom: 'Campus Centre',
    },
  };

  const EVENT_ALL_DAY = {
    id: 'evt-all-day',
    title: 'Journée pédagogique',
    description: null,
    start_time: '2099-09-20T00:00:00.000Z',
    end_time: null,
    all_day: true,
    location: 'Amphithéâtre',
    video_conference_url: null,
    status: 'confirmed',
    etablissement: null,
  };

  const TRIGGER_TEXT = 'Ouvrir la carte';

  const mockMaybeSingle = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();

  const builder = {
    select: mockSelect,
    eq: mockEq,
    maybeSingle: mockMaybeSingle,
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(mockMaybeSingle.mock.results.at(-1)?.value).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(mockMaybeSingle.mock.results.at(-1)?.value).catch(onRejected),
  };

  mockSelect.mockImplementation(() => builder);
  mockEq.mockImplementation(() => builder);
  mockFrom.mockImplementation(() => builder);

  return {
    EVENT_VIDEO,
    EVENT_PAST,
    EVENT_ALL_DAY,
    TRIGGER_TEXT,
    mockFrom,
    mockEq,
    mockMaybeSingle,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-card">{children}</div>,
  HoverCardTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-trigger">{children}</div>,
  HoverCardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-content">{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
  }) => (
    <button type="button" data-testid="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Calendar: () => <svg data-testid="icon-calendar" />,
  Clock: () => <svg data-testid="icon-clock" />,
  MapPin: () => <svg data-testid="icon-mappin" />,
  Video: () => <svg data-testid="icon-video" />,
  Building2: () => <svg data-testid="icon-building2" />,
  ExternalLink: () => <svg data-testid="icon-external-link" />,
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

describe('AIEventHoverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche seulement les enfants pendant le chargement puis rend les données métier d’une visioconférence', async () => {
    let resolveQuery: ((value: { data: typeof EVENT_VIDEO; error: null }) => void) | null = null;
    mockMaybeSingle.mockImplementationOnce(
      () =>
        new Promise<{ data: typeof EVENT_VIDEO; error: null }>((resolve) => {
          resolveQuery = resolve;
        }),
    );

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <AIEventHoverCard eventId="evt-video">
        <span>{TRIGGER_TEXT}</span>
      </AIEventHoverCard>,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText(TRIGGER_TEXT)).toBeInTheDocument();
    expect(screen.queryByText('Réunion équipe')).not.toBeInTheDocument();

    if (resolveQuery) {
      resolveQuery({ data: EVENT_VIDEO, error: null });
    }

    await waitFor(() => {
      expect(screen.getByText('Réunion équipe')).toBeInTheDocument();
    });

    expect(mockFrom).toHaveBeenCalledWith('calendar_events');
    expect(mockEq).toHaveBeenCalledWith('id', 'evt-video');
    expect(screen.getByText('Visioconférence')).toBeInTheDocument();
    expect(screen.getByText(format(new Date(EVENT_VIDEO.start_time), 'HH:mm', { locale: fr }))).toBeInTheDocument();
    expect(screen.getByText(`- ${format(new Date(EVENT_VIDEO.end_time), 'HH:mm', { locale: fr })}`)).toBeInTheDocument();
    expect(screen.getByText('1h30')).toBeInTheDocument();
    expect(screen.getByText('Établissement:')).toBeInTheDocument();
    expect(screen.getByText('Lycée Horizon')).toBeInTheDocument();
    expect(screen.getByText('Point hebdomadaire projet')).toBeInTheDocument();
    expect(screen.getByText('Rejoindre la visio')).toBeInTheDocument();
    expect(screen.queryByText('Salle 12')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Rejoindre la visio'));
    expect(openSpy).toHaveBeenCalledWith('https://meet.local/room', '_blank');

    openSpy.mockRestore();
  });

  it('affiche un événement passé en présentiel avec lieu et durée en minutes', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: EVENT_PAST, error: null });

    render(
      <AIEventHoverCard eventId="evt-past">
        <span>{TRIGGER_TEXT}</span>
      </AIEventHoverCard>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText('Entretien passé')).toBeInTheDocument();
    });

    expect(screen.getByText(format(new Date(EVENT_PAST.start_time), 'HH:mm', { locale: fr }))).toBeInTheDocument();
    expect(screen.getByText(`- ${format(new Date(EVENT_PAST.end_time), 'HH:mm', { locale: fr })}`)).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('Bureau A')).toBeInTheDocument();
    expect(screen.getByText('Campus Centre')).toBeInTheDocument();
    expect(screen.queryByText('Visioconférence')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejoindre la visio')).not.toBeInTheDocument();
  });

  it('affiche le libellé journée entière pour un événement all_day', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: EVENT_ALL_DAY, error: null });

    render(
      <AIEventHoverCard eventId="evt-all-day">
        <span>{TRIGGER_TEXT}</span>
      </AIEventHoverCard>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText('Journée pédagogique')).toBeInTheDocument();
    });

    expect(screen.getByText('Journée entière')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-clock')).not.toBeInTheDocument();
    expect(screen.getByText('Amphithéâtre')).toBeInTheDocument();
  });

  it('retombe sur les enfants seuls quand la requête renvoie data null', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

    render(
      <AIEventHoverCard eventId="evt-error">
        <span>{TRIGGER_TEXT}</span>
      </AIEventHoverCard>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('calendar_events');
    });

    expect(screen.getByText(TRIGGER_TEXT)).toBeInTheDocument();
    expect(screen.queryByTestId('hover-content')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejoindre la visio')).not.toBeInTheDocument();
  });
});