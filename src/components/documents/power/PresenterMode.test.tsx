// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { PresenterMode } from './PresenterMode';

const { SLIDES, EMPTY_SLIDES, sanitizeMock, requestFullscreenMock, exitFullscreenMock } = vi.hoisted(() => ({
  SLIDES: [
    {
      id: 's1',
      html: '<div><h1>Bienvenue</h1><img src="x" onerror="bad()" /><script>bad()</script></div>',
      notes: 'Note de la slide 1',
    },
    {
      id: 's2',
      html: '<section><p>Deuxième slide</p></section>',
      notes: 'Note de la slide 2',
    },
    {
      id: 's3',
      html: '<article><p>Troisième slide</p></article>',
    },
  ],
  EMPTY_SLIDES: [],
  sanitizeMock: vi.fn((html: string) =>
    html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, ''),
  ),
  requestFullscreenMock: vi.fn().mockResolvedValue(undefined),
  exitFullscreenMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('dompurify', () => ({
  default: {
    sanitize: sanitizeMock,
  },
}));

vi.mock('lucide-react', () => {
  const Icon = () => React.createElement('svg', { 'data-testid': 'icon' });
  return {
    X: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Timer: Icon,
    Clock: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement(
      'button',
      {
        type: 'button',
        onClick,
        disabled,
        ...props,
      },
      children,
    ),
}));

describe('PresenterMode', () => {
  beforeEach(() => {
    cleanup();
    sanitizeMock.mockClear();
    requestFullscreenMock.mockClear();
    exitFullscreenMock.mockClear();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreenMock,
    });

    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreenMock,
    });

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    });

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 16)),
    );

    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => {
        clearTimeout(id);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rend la slide courante, les notes, la suivante et sanitize le HTML', () => {
    const onClose = vi.fn();
    const { container } = render(<PresenterMode slides={SLIDES} onClose={onClose} />);

    expect(screen.getByText('Slide 1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Note de la slide 1')).toBeInTheDocument();
    expect(screen.getByText('Slide suivante')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Bienvenue')).toBeInTheDocument();
    expect(screen.getByText('Deuxième slide')).toBeInTheDocument();

    expect(sanitizeMock).toHaveBeenCalledTimes(2);
    expect(sanitizeMock).toHaveBeenNthCalledWith(
      1,
      SLIDES[0].html,
      expect.objectContaining({
        FORBID_TAGS: expect.arrayContaining(['script', 'iframe', 'button']),
        FORBID_ATTR: expect.arrayContaining(['onerror', 'onclick']),
      }),
    );
    expect(sanitizeMock).toHaveBeenNthCalledWith(2, SLIDES[1].html, expect.any(Object));

    expect(container.innerHTML).toContain('<h1>Bienvenue</h1>');
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).not.toContain('onerror=');
    expect(requestFullscreenMock).toHaveBeenCalledTimes(1);
  });

  it('navigue via boutons et clavier, remet le chrono de slide à zéro et ferme avec Escape', () => {
    const onClose = vi.fn();
    const { container } = render(<PresenterMode slides={SLIDES} onClose={onClose} />);

    expect(screen.getByText('Slide 1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Note de la slide 1')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    const closeButton = buttons[0];
    const prevButton = buttons[1];
    const nextButton = buttons[2];

    expect(closeButton).toBeInTheDocument();
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    const controlBar = container.querySelector('.col-start-1');
    expect(controlBar).toBeTruthy();
    if (controlBar) {
      expect(within(controlBar as HTMLElement).getByText('00:30')).toBeInTheDocument();
      expect(within(controlBar as HTMLElement).getByText(/Slide 00:30/)).toBeInTheDocument();
    }

    fireEvent.click(nextButton);

    expect(screen.getByText('Slide 2 / 3')).toBeInTheDocument();
    expect(screen.getByText('Note de la slide 2')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(prevButton).not.toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    if (controlBar) {
      expect(within(controlBar as HTMLElement).getByText('00:30')).toBeInTheDocument();
      expect(within(controlBar as HTMLElement).getByText(/Slide 00:00/)).toBeInTheDocument();
    }

    fireEvent.keyDown(window, { key: 'End' });
    expect(screen.getByText('Slide 3 / 3')).toBeInTheDocument();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByText('Fin de présentation')).toBeInTheDocument();
    expect(screen.getByText('Aucune note')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Home' });
    expect(screen.getByText('Slide 1 / 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Slide 2 / 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'PageUp' });
    expect(screen.getByText('Slide 1 / 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByText('Slide 2 / 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Slide 1 / 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('affiche le fallback sans slide et ferme via le bouton puis quitte le plein écran au démontage', () => {
    const onClose = vi.fn();

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => document.documentElement,
    });

    const { unmount } = render(<PresenterMode slides={EMPTY_SLIDES} onClose={onClose} />);

    expect(screen.getByText('Aucune slide')).toBeInTheDocument();
    expect(screen.getByText('Slide 1 / 0')).toBeInTheDocument();
    expect(screen.getByText('Aucune note')).toBeInTheDocument();
    expect(screen.getByText('Fin de présentation')).toBeInTheDocument();
    expect(screen.getByText('1 / 0')).toBeInTheDocument();

    const closeButton = screen.getAllByRole('button')[0];
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(exitFullscreenMock).toHaveBeenCalledTimes(1);
  });
});