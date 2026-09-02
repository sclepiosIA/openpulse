// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { JarvisVoiceWave, JarvisVoiceOverlay } from './JarvisVoiceWave';

const { vibrateSelectionMock, vibrateSuccessMock } = vi.hoisted(() => ({
  vibrateSelectionMock: vi.fn(),
  vibrateSuccessMock: vi.fn(),
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection: vibrateSelectionMock,
  vibrateSuccess: vibrateSuccessMock,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | string[] | undefined | false | null>) =>
    classes
      .flatMap((c) => (Array.isArray(c) ? c : [c]))
      .filter(Boolean)
      .join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        ({
          children,
          ...props
        }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
          React.createElement(tag, props, children),
    }
  ),
}));

vi.mock('lucide-react', () => ({
  Mic: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-mic" {...props} />,
  Square: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-square" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

describe('JarvisVoiceWave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    let rafId = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        rafId += 1;
        return rafId;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('affiche le micro au repos et déclenche onStart avec vibration de sélection', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();

    render(
      <JarvisVoiceWave
        isActive={false}
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
      />
    );

    expect(screen.getByTestId('icon-mic')).toBeTruthy();
    expect(screen.queryByTestId('icon-square')).toBeNull();
    expect(screen.queryByText('Parlez maintenant...')).toBeNull();

    act(() => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(vibrateSelectionMock).toHaveBeenCalledTimes(1);
    expect(vibrateSuccessMock).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
  });

  it('affiche le statut actif, le bouton stop et déclenche onStop avec vibration de succès', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();

    render(
      <JarvisVoiceWave
        isActive
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
      />
    );

    expect(screen.getByTestId('icon-square')).toBeTruthy();
    expect(screen.queryByTestId('icon-mic')).toBeNull();
    expect(screen.getByText('Parlez maintenant...')).toBeTruthy();

    act(() => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(vibrateSelectionMock).toHaveBeenCalledTimes(1);
    expect(vibrateSuccessMock).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('désactive le bouton et affiche le loader pendant le traitement', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();

    render(
      <JarvisVoiceWave
        isActive
        isProcessing
        onStart={onStart}
        onStop={onStop}
      />
    );

    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    expect(screen.getByTestId('icon-loader')).toBeTruthy();
    expect(screen.getByText('Traitement...')).toBeTruthy();

    act(() => {
      fireEvent.click(button);
    });

    expect(vibrateSelectionMock).not.toHaveBeenCalled();
    expect(vibrateSuccessMock).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });

  it('programme une animation quand actif et annule l’animation lors du passage à inactif', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();

    const { rerender } = render(
      <JarvisVoiceWave
        isActive
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
      />
    );

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(requestAnimationFrame).toHaveBeenCalled();

    act(() => {
      rerender(
        <JarvisVoiceWave
          isActive={false}
          isProcessing={false}
          onStart={onStart}
          onStop={onStop}
        />
      );
    });

    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(screen.queryByText('Parlez maintenant...')).toBeNull();
    expect(screen.getByTestId('icon-mic')).toBeTruthy();
    expect(screen.queryByTestId('icon-square')).toBeNull();
  });
});

describe('JarvisVoiceOverlay', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('ne rend rien quand fermé', () => {
    render(
      <JarvisVoiceOverlay
        isOpen={false}
        isProcessing={false}
        transcript=""
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.queryByText('Annuler')).toBeNull();
    expect(screen.queryByText('Posez votre question...')).toBeNull();
  });

  it('affiche le placeholder et ferme au clic sur l’overlay ou sur Annuler', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    const { container } = render(
      <JarvisVoiceOverlay
        isOpen
        isProcessing={false}
        transcript=""
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('Posez votre question...')).toBeTruthy();
    expect(screen.getByTestId('icon-mic')).toBeTruthy();
    expect(screen.queryByText('Envoyer')).toBeNull();

    const overlay = container.querySelector('.fixed.inset-0.z-50');
    expect(overlay).toBeTruthy();

    act(() => {
      fireEvent.click(overlay as Element);
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(screen.getByText('Annuler'));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('affiche le transcript et envoie le texte réel', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const transcript = 'Bonjour Jarvis';

    render(
      <JarvisVoiceOverlay
        isOpen
        isProcessing={false}
        transcript={transcript}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText(`"${transcript}"`)).toBeTruthy();
    expect(screen.getByText('Envoyer')).toBeTruthy();

    act(() => {
      fireEvent.click(screen.getByText('Envoyer'));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(transcript);
  });

  it('affiche le loader et désactive l’envoi pendant le traitement', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const transcript = 'Texte en cours';

    render(
      <JarvisVoiceOverlay
        isOpen
        isProcessing
        transcript={transcript}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByTestId('icon-loader')).toBeTruthy();
    expect(screen.getByText(`"${transcript}"`)).toBeTruthy();

    const sendButton = screen.getByText('Envoyer').closest('button');
    expect(sendButton).toBeTruthy();
    expect(sendButton).toBeDisabled();

    act(() => {
      fireEvent.click(sendButton as HTMLButtonElement);
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('empêche la fermeture quand on clique dans le contenu interne', () => {
    const onClose = vi.fn();

    render(
      <JarvisVoiceOverlay
        isOpen
        isProcessing={false}
        transcript=""
        onClose={onClose}
        onSubmit={vi.fn()}
      />
    );

    act(() => {
      fireEvent.click(screen.getByText('Posez votre question...'));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('affiche le texte de traitement sans transcript', () => {
    render(
      <JarvisVoiceOverlay
        isOpen
        isProcessing
        transcript=""
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Traitement en cours...')).toBeTruthy();
    expect(screen.getByTestId('icon-loader')).toBeTruthy();
    expect(screen.queryByText('Envoyer')).toBeNull();
  });
});