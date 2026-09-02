// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptionLiveView } from './TranscriptionLiveView';

const {
  SEGMENTS_EMPTY,
  SEGMENTS_FILLED,
  PARTICIPANTS,
  FIXED_NOW,
  SESSION_STARTED_AT,
  SESSION_ID,
  createObjectURLMock,
  revokeObjectURLMock,
  anchorClickMock,
  onExportMock,
} = vi.hoisted(() => ({
  SEGMENTS_EMPTY: [] as Array<{
    id: string;
    speaker_name: string;
    text: string;
    start_time_ms?: number;
  }>,
  SEGMENTS_FILLED: [
    { id: 's1', speaker_name: 'Alice Martin', text: 'Bonjour à tous', start_time_ms: 5000 },
    { id: 's2', speaker_name: 'Alice Martin', text: 'Nous commençons la réunion', start_time_ms: 9000 },
    { id: 's3', speaker_name: 'Bob Lee', text: 'Merci Alice', start_time_ms: 65000 },
  ] as Array<{
    id: string;
    speaker_name: string;
    text: string;
    start_time_ms?: number;
  }>,
  PARTICIPANTS: [
    { id: 'p1', display_name: 'Alice Martin', is_transcribing: true, left_at: null },
    { id: 'p2', display_name: 'Bob Lee', is_transcribing: false, left_at: null },
    { id: 'p3', display_name: 'Charlie Removed', is_transcribing: false, left_at: '2024-01-01T10:01:00.000Z' },
  ] as Array<{
    id: string;
    display_name: string;
    is_transcribing: boolean;
    left_at: string | null;
  }>,
  FIXED_NOW: new Date('2024-01-01T10:01:30.000Z').getTime(),
  SESSION_STARTED_AT: '2024-01-01T10:00:00.000Z',
  SESSION_ID: 'session-1234-abcd',
  createObjectURLMock: vi.fn(() => 'blob:mock-url'),
  revokeObjectURLMock: vi.fn(),
  anchorClickMock: vi.fn(),
  onExportMock: vi.fn(),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg aria-hidden="true" {...props} />;
  return {
    Mic: Icon,
    MicOff: Icon,
    Users: Icon,
    Clock: Icon,
    Download: Icon,
    FileText: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div data-testid="scroll-area" ref={ref} {...props}>
        {children}
      </div>
    )
  ),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

describe('TranscriptionLiveView', () => {
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    originalCreateElement = document.createElement.bind(document);

    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        const anchor = originalCreateElement('a');
        Object.defineProperty(anchor, 'click', {
          value: anchorClickMock,
          configurable: true,
          writable: true,
        });
        return anchor;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche l’état vide avec la durée de session formatée et sans bouton PDF', () => {
    render(
      <TranscriptionLiveView
        sessionId={SESSION_ID}
        segments={SEGMENTS_EMPTY}
        participants={PARTICIPANTS}
        sessionStartedAt={SESSION_STARTED_AT}
      />
    );

    expect(screen.getByText('Transcription en direct')).toBeInTheDocument();
    expect(screen.getByText('En attente de transcription...')).toBeInTheDocument();
    expect(screen.getByText('Activez votre micro pour commencer')).toBeInTheDocument();
    expect(screen.getByText('01:30')).toBeInTheDocument();
    expect(screen.getByText('Participants')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /txt/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pdf/i })).not.toBeInTheDocument();
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('Bob Lee')).toBeInTheDocument();
    expect(screen.queryByText('Charlie Removed')).not.toBeInTheDocument();
    expect(screen.getAllByText('AM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BL').length).toBeGreaterThan(0);
  });

  it('groupe les segments consécutifs par intervenant et affiche les horodatages métier', () => {
    render(
      <TranscriptionLiveView
        sessionId={SESSION_ID}
        segments={SEGMENTS_FILLED}
        participants={PARTICIPANTS}
        sessionStartedAt={SESSION_STARTED_AT}
        onExport={onExportMock}
      />
    );

    expect(screen.getByRole('button', { name: /pdf/i })).toBeInTheDocument();
    expect(screen.getByText('Bonjour à tous')).toBeInTheDocument();
    expect(screen.getByText('Nous commençons la réunion')).toBeInTheDocument();
    expect(screen.getByText('Merci Alice')).toBeInTheDocument();
    expect(screen.getByText('00:05')).toBeInTheDocument();
    expect(screen.getByText('01:05')).toBeInTheDocument();

    const aliceNameNodes = screen.getAllByText('Alice Martin');
    expect(aliceNameNodes).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /pdf/i }));
    expect(onExportMock).toHaveBeenCalledTimes(1);
  });

  it('exporte un fichier txt avec le nom basé sur sessionId et déclenche le téléchargement', () => {
    render(
      <TranscriptionLiveView
        sessionId={SESSION_ID}
        segments={SEGMENTS_FILLED}
        participants={PARTICIPANTS}
        sessionStartedAt={SESSION_STARTED_AT}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /txt/i }));

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURLMock.mock.calls[0]?.[0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(anchorClickMock).toHaveBeenCalledTimes(1);

    const createdAnchor = document.createElement.mock.results.find(
      (result) => result.type === 'return' && result.value instanceof HTMLAnchorElement
    )?.value as HTMLAnchorElement | undefined;

    expect(createdAnchor?.download).toBe('transcription-session-.txt');
    expect(createdAnchor?.href).toBe('blob:mock-url');
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
  });

  it('affiche l’indicateur de défilement quand l’utilisateur remonte puis le masque au clic', () => {
    render(
      <TranscriptionLiveView
        sessionId={SESSION_ID}
        segments={SEGMENTS_FILLED}
        participants={PARTICIPANTS}
        sessionStartedAt={SESSION_STARTED_AT}
      />
    );

    const transcriptScroll = screen.getAllByTestId('scroll-area')[1] as HTMLDivElement;

    Object.defineProperty(transcriptScroll, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(transcriptScroll, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(transcriptScroll, 'scrollTop', { value: 100, writable: true, configurable: true });

    fireEvent.scroll(transcriptScroll);

    expect(screen.getByRole('button', { name: /défiler vers le bas/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /défiler vers le bas/i }));

    expect(screen.queryByRole('button', { name: /défiler vers le bas/i })).not.toBeInTheDocument();
    expect(transcriptScroll.scrollTop).toBe(1000);
  });
});