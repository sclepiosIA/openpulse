import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { JarvisGlassHeader } from './JarvisGlassHeader';

vi.mock('framer-motion', () => {
  const MockComponent = ({ children, ...rest }: any) => (
    <div {...rest}>{children}</div>
  );
  const MockAnimatePresence = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  );

  return {
    motion: {
      header: MockComponent,
      div: MockComponent,
      span: MockComponent,
    },
    AnimatePresence: MockAnimatePresence,
  };
});

const { mockVibrateSelection, mockButton, mockDropdownMenu, jarvisLogoPath } =
  vi.hoisted(() => {
    return {
      mockVibrateSelection: vi.fn(),
      jarvisLogoPath: 'jarvis-logo-mock-path',
      mockButton: ({
        children,
        ...rest
      }: {
        children: React.ReactNode;
        onClick?: () => void;
        'aria-label'?: string;
        className?: string;
        title?: string;
      }) => (
        <button type="button" {...rest}>
          {children}
        </button>
      ),
      mockDropdownMenu: {
        Root: ({
          children,
          open,
          onOpenChange,
        }: {
          children: React.ReactNode;
          open?: boolean;
          onOpenChange?: (open: boolean) => void;
        }) => (
          <div
            data-testid="dropdown-root"
            data-open={open ? 'true' : 'false'}
            onClick={() => onOpenChange && onOpenChange(!open)}
          >
            {children}
          </div>
        ),
        Trigger: ({ children }: { children: React.ReactNode }) => (
          <div data-testid="dropdown-trigger">{children}</div>
        ),
        Content: ({
          children,
          className,
        }: {
          children: React.ReactNode;
          className?: string;
          align?: string;
        }) => (
          <div data-testid="dropdown-content" className={className}>
            {children}
          </div>
        ),
        Item: ({
          children,
          onClick,
        }: {
          children: React.ReactNode;
          onClick?: () => void;
        }) => (
          <div role="menuitem" onClick={onClick}>
            {children}
          </div>
        ),
        Separator: () => <div role="separator" />,
      },
    };
  });

vi.mock('@/components/ui/button', () => ({
  Button: mockButton,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children, open, onOpenChange }: any) =>
    mockDropdownMenu.Root({ children, open, onOpenChange }),
  DropdownMenuTrigger: ({ children }: any) =>
    mockDropdownMenu.Trigger({ children }),
  DropdownMenuContent: ({ children, className, align }: any) =>
    mockDropdownMenu.Content({ children, className, align }),
  DropdownMenuItem: ({ children, onClick }: any) =>
    mockDropdownMenu.Item({ children, onClick }),
  DropdownMenuSeparator: () => mockDropdownMenu.Separator(),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection: () => mockVibrateSelection(),
}));

vi.mock('@/assets/jarvis-logo.png', () => ({
  default: jarvisLogoPath,
}));

vi.mock('lucide-react', () => {
  const Icon = ({
    'data-name': dataName,
    ...rest
  }: {
    'data-name'?: string;
  }) => <svg data-icon={dataName || 'icon'} {...rest} />;

  return {
    Plus: (props: any) => <Icon {...props} data-name="Plus" />,
    History: (props: any) => <Icon {...props} data-name="History" />,
    X: (props: any) => <Icon {...props} data-name="X" />,
    MoreHorizontal: (props: any) => (
      <Icon {...props} data-name="MoreHorizontal" />
    ),
    Settings: (props: any) => <Icon {...props} data-name="Settings" />,
    Mic: (props: any) => <Icon {...props} data-name="Mic" />,
    MicOff: (props: any) => <Icon {...props} data-name="MicOff" />,
    Sparkles: (props: any) => <Icon {...props} data-name="Sparkles" />,
    Brain: (props: any) => <Icon {...props} data-name="Brain" />,
  };
});

describe('JarvisGlassHeader', () => {
  beforeEach(() => {
    mockVibrateSelection.mockClear();
  });

  it('affiche le titre, le logo et le statut par défaut', () => {
    render(<JarvisGlassHeader />);

    expect(screen.getByText('Jarvis')).toBeInTheDocument();
    const img = screen.getByAltText('Jarvis') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain(jarvisLogoPath);

    expect(screen.getByText('En ligne')).toBeInTheDocument();
  });

  it("affiche le statut 'Connexion...' quand connectionStatus est connecting", () => {
    render(<JarvisGlassHeader connectionStatus="connecting" />);

    expect(screen.getByText('Connexion...')).toBeInTheDocument();
  });

  it("affiche le statut 'Hors ligne' quand connectionStatus est disconnected", () => {
    render(<JarvisGlassHeader connectionStatus="disconnected" />);

    expect(screen.getByText('Hors ligne')).toBeInTheDocument();
  });

  it("priorise le statut 'Réflexion...' et l'icône Brain quand isTyping est true", () => {
    render(
      <JarvisGlassHeader connectionStatus="disconnected" isTyping={true} />
    );

    expect(screen.getByText('Réflexion...')).toBeInTheDocument();
    const brainIcon = screen.getByRole('img', { hidden: true }) || screen.getByText((_, el) => {
      return el?.tagName.toLowerCase() === 'svg' && el.getAttribute('data-icon') === 'Brain';
    });
    expect(brainIcon).toBeTruthy();
  });

  it('affiche le bouton nouvelle conversation et déclenche onNewConversation avec vibration', () => {
    const onNewConversation = vi.fn();

    render(<JarvisGlassHeader onNewConversation={onNewConversation} />);

    const newButton = screen.getByLabelText('Ajouter');
    expect(newButton).toBeInTheDocument();

    fireEvent.click(newButton);
    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it('affiche le bouton de fermeture et déclenche onClose avec vibration', () => {
    const onClose = vi.fn();

    render(<JarvisGlassHeader onClose={onClose} />);

    const closeButton = screen.getByLabelText('Fermer');
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("affiche le compteur d'éléments en attente sur le bouton plus", () => {
    render(<JarvisGlassHeader pendingCount={5} />);

    const badge = screen.getByText('5');
    expect(badge).toBeInTheDocument();
  });

  it("ouvre le menu et déclenche onOpenHistory avec vibration", () => {
    const onOpenHistory = vi.fn();

    render(
      <JarvisGlassHeader pendingCount={2} onOpenHistory={onOpenHistory} />
    );

    const moreButton = screen.getByLabelText("Plus d'options");
    fireEvent.click(moreButton);

    const historyItem = screen.getByText('Historique');
    expect(historyItem).toBeInTheDocument();

    const pendingTag = screen
      .getAllByText('2')
      .find((el) => el.tagName.toLowerCase() === 'span');
    expect(pendingTag).toBeTruthy();

    fireEvent.click(historyItem);
    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it('gère le toggle voix avec bon label et vibration', () => {
    const onToggleVoice = vi.fn();

    const { rerender } = render(
      <JarvisGlassHeader onToggleVoice={onToggleVoice} isVoiceActive={false} />
    );

    const moreButton = screen.getByLabelText("Plus d'options");
    fireEvent.click(moreButton);

    let voiceItem = screen.getByText('Activer voix');
    expect(voiceItem).toBeInTheDocument();
    fireEvent.click(voiceItem);
    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onToggleVoice).toHaveBeenCalledTimes(1);

    rerender(
      <JarvisGlassHeader onToggleVoice={onToggleVoice} isVoiceActive={true} />
    );

    fireEvent.click(screen.getByLabelText("Plus d'options"));
    voiceItem = screen.getByText('Désactiver voix');
    expect(voiceItem).toBeInTheDocument();
  });

  it('ouvre les paramètres avec vibration', () => {
    const onOpenSettings = vi.fn();

    render(<JarvisGlassHeader onOpenSettings={onOpenSettings} />);

    const moreButton = screen.getByLabelText("Plus d'options");
    fireEvent.click(moreButton);

    const settingsItem = screen.getByText('Paramètres');
    expect(settingsItem).toBeInTheDocument();

    fireEvent.click(settingsItem);
    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("affiche toujours l'entrée de version dans le menu", () => {
    render(<JarvisGlassHeader />);

    const moreButton = screen.getByLabelText("Plus d'options");
    fireEvent.click(moreButton);

    expect(screen.getByText('Version 15.1')).toBeInTheDocument();
  });
});