import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TranscriptionWidget } from './TranscriptionWidget';

const {
  hookState,
  startRecording,
  stopRecording,
} = vi.hoisted(() => ({
  hookState: {
    isRecording: false,
    isConnecting: false,
    segments: [] as Array<{
      id: string;
      speaker_name: string;
      start_time_ms?: number;
      text: string;
    }>,
    participants: [] as Array<{
      id: string;
      display_name: string;
      left_at: string | null;
      is_transcribing: boolean;
    }>,
    currentText: '',
    error: '',
  },
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
}));

vi.mock('@/hooks/ai/useAzureTranscription', () => ({
  useAzureTranscription: vi.fn(() => ({
    ...hookState,
    startRecording,
    stopRecording,
  })),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Mic: Icon,
    MicOff: Icon,
    Square: Icon,
    Loader2: Icon,
    Users: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

function renderWidget(props?: Partial<React.ComponentProps<typeof TranscriptionWidget>>) {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <TranscriptionWidget
        sessionId="session-1"
        userId="user-1"
        displayName="Alice"
        {...props}
      />
    </Wrapper>
  );
}

describe('TranscriptionWidget', () => {
  beforeEach(() => {
    hookState.isRecording = false;
    hookState.isConnecting = false;
    hookState.segments = [];
    hookState.participants = [];
    hookState.currentText = '';
    hookState.error = '';
    startRecording.mockReset();
    stopRecording.mockReset();
  });

  it('affiche l’état vide et le compteur à 0', () => {
    renderWidget();

    expect(screen.getByText('Transcription')).toBeInTheDocument();
    expect(screen.getByText('Cliquez sur le micro pour démarrer la transcription')).toBeInTheDocument();
    expect(screen.getByText('0 segments transcrits')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transcrire/i })).toBeInTheDocument();
  });

  it('affiche les participants actifs, les participants en transcription, le texte courant et les 5 derniers segments formatés', () => {
    hookState.isRecording = true;
    hookState.currentText = 'texte en direct';
    hookState.participants = [
      { id: 'p1', display_name: 'Alice', left_at: null, is_transcribing: true },
      { id: 'p2', display_name: 'Bob', left_at: null, is_transcribing: false },
      { id: 'p3', display_name: 'Chloé', left_at: '2024-01-01', is_transcribing: true },
    ];
    hookState.segments = [
      { id: 's1', speaker_name: 'A', start_time_ms: 1000, text: 'un' },
      { id: 's2', speaker_name: 'B', start_time_ms: 2000, text: 'deux' },
      { id: 's3', speaker_name: 'C', start_time_ms: 65000, text: 'trois' },
      { id: 's4', speaker_name: 'D', start_time_ms: 120000, text: 'quatre' },
      { id: 's5', speaker_name: 'E', start_time_ms: 0, text: 'cinq' },
      { id: 's6', speaker_name: 'F', start_time_ms: 125000, text: 'six' },
    ];

    renderWidget();

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('texte en direct')).toBeInTheDocument();

    expect(screen.queryByText('un')).not.toBeInTheDocument();
    expect(screen.getByText('deux')).toBeInTheDocument();
    expect(screen.getByText('trois')).toBeInTheDocument();
    expect(screen.getByText('quatre')).toBeInTheDocument();
    expect(screen.getByText('cinq')).toBeInTheDocument();
    expect(screen.getByText('six')).toBeInTheDocument();

    expect(screen.getByText('00:02')).toBeInTheDocument();
    expect(screen.getByText('01:05')).toBeInTheDocument();
    expect(screen.getByText('02:00')).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByText('02:05')).toBeInTheDocument();

    expect(screen.getByText('6 segments transcrits')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arrêter/i })).toBeInTheDocument();
  });

  it('affiche l’erreur et l’état de connexion désactivé', () => {
    hookState.isConnecting = true;
    hookState.error = 'connexion impossible';

    renderWidget();

    expect(screen.getByText('connexion impossible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connexion.../i })).toBeDisabled();
  });

  it('déclenche startRecording quand on clique sur Transcrire', () => {
    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: /Transcrire/i }));

    expect(startRecording).toHaveBeenCalledTimes(1);
    expect(stopRecording).not.toHaveBeenCalled();
  });

  it('déclenche stopRecording et onEnd quand les boutons sont cliqués', () => {
    hookState.isRecording = true;
    const onEnd = vi.fn();

    renderWidget({ onEnd });

    const stopButton = screen.getByRole('button', { name: /Arrêter/i });
    const buttons = screen.getAllByRole('button');

    fireEvent.click(stopButton);
    fireEvent.click(buttons[buttons.length - 1]);

    expect(stopRecording).toHaveBeenCalledTimes(1);
    expect(startRecording).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('gère le singulier pour le compteur de segments', () => {
    hookState.segments = [{ id: 's1', speaker_name: 'Alice', start_time_ms: 3000, text: 'bonjour' }];

    renderWidget();

    expect(screen.getByText('1 segment transcrit')).toBeInTheDocument();
  });
});