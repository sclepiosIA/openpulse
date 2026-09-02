import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { JarvisAppleMessage } from './JarvisAppleMessage';

const {
  mockToast,
  mockUseToast,
  mockVibrateSelection,
  mockVibrateSuccess,
  mockWriteText,
} = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockUseToast: vi.fn(),
  mockVibrateSelection: vi.fn(),
  mockVibrateSuccess: vi.fn(),
  mockWriteText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  },
}));

vi.mock('lucide-react', () => ({
  Check: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" {...props} />,
  Copy: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-copy" {...props} />,
  RefreshCw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-refresh" {...props} />,
  ThumbsUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-thumbs-up" {...props} />,
  ThumbsDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-thumbs-down" {...props} />,
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined | string[]>) =>
    classes.flat().filter(Boolean).join(' '),
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
    children?: React.ReactNode;
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

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => mockUseToast(),
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection: mockVibrateSelection,
  vibrateSuccess: mockVibrateSuccess,
}));

describe('JarvisAppleMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: mockToast });

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      configurable: true,
    });
  });

  it('render un message utilisateur sans actions et avec le bon alignement', () => {
    const timestamp = new Date('2024-01-01T09:05:00');
    const { container } = render(
      <JarvisAppleMessage role="user" content="Bonjour utilisateur" timestamp={timestamp} />
    );

    expect(screen.getByText('Bonjour utilisateur')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-copy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-thumbs-up')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-refresh')).not.toBeInTheDocument();
    expect(screen.getByText('09:05')).toBeInTheDocument();

    const root = container.firstElementChild;
    expect(root?.className).toContain('justify-end');
    expect(container.querySelector('.bg-primary')).toBeTruthy();
  });

  it('render un message assistant avec markdown, timestamp et actions disponibles', () => {
    const onFeedback = vi.fn();
    const onRegenerate = vi.fn();
    const timestamp = new Date('2024-01-01T14:27:00');
    const { container } = render(
      <JarvisAppleMessage
        role="assistant"
        content="**Réponse** assistant"
        timestamp={timestamp}
        onFeedback={onFeedback}
        onRegenerate={onRegenerate}
      />
    );

    expect(screen.getByText('**Réponse** assistant')).toBeInTheDocument();
    expect(screen.getByTestId('icon-copy')).toBeInTheDocument();
    expect(screen.getByTestId('icon-thumbs-up')).toBeInTheDocument();
    expect(screen.getByTestId('icon-thumbs-down')).toBeInTheDocument();
    expect(screen.getByTestId('icon-refresh')).toBeInTheDocument();
    expect(screen.getByText('14:27')).toBeInTheDocument();

    const root = container.firstElementChild;
    expect(root?.className).toContain('justify-start');
    expect(container.querySelector('.bg-muted\\/70')).toBeTruthy();
  });

  it('affiche le curseur de streaming et masque les actions et le timestamp pendant le streaming', () => {
    render(
      <JarvisAppleMessage
        role="assistant"
        content="Texte en cours"
        isStreaming
        timestamp={new Date('2024-01-01T14:27:00')}
        onFeedback={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText('Texte en cours')).toBeInTheDocument();
    expect(document.querySelector('.inline-block.w-0\\.5.h-4')).toBeTruthy();
    expect(screen.queryByTestId('icon-copy')).not.toBeInTheDocument();
    expect(screen.queryByText('14:27')).not.toBeInTheDocument();
  });

  it('copie le contenu, déclenche le toast et les vibrations puis réinitialise l’état copié', async () => {
    vi.useFakeTimers();

    const { container } = render(
      <JarvisAppleMessage role="assistant" content="Contenu à copier" />
    );

    const copyButton = container.querySelector('button');
    expect(copyButton).toBeTruthy();

    await act(async () => {
      if (copyButton) {
        fireEvent.click(copyButton);
        await Promise.resolve();
      }
    });

    expect(mockWriteText).toHaveBeenCalledTimes(1);
    expect(mockWriteText).toHaveBeenCalledWith('Contenu à copier');
    expect(mockVibrateSuccess).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith({ description: 'Copié dans le presse-papiers' });
    expect(screen.getByTestId('icon-check')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('icon-copy')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('envoie un feedback positif, vibre et désactive ensuite les boutons de feedback', () => {
    const onFeedback = vi.fn();
    const { container } = render(
      <JarvisAppleMessage role="assistant" content="Réponse utile" onFeedback={onFeedback} />
    );

    const buttons = Array.from(container.querySelectorAll('button'));
    const positiveButton = buttons[1];
    const negativeButton = buttons[2];

    fireEvent.click(positiveButton);

    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onFeedback).toHaveBeenCalledWith('positive');
    expect(positiveButton).toBeDisabled();
    expect(negativeButton).toBeDisabled();
    expect(positiveButton.className).toContain('text-emerald-500');
  });

  it('envoie un feedback négatif avec les mêmes garanties métier', () => {
    const onFeedback = vi.fn();
    const { container } = render(
      <JarvisAppleMessage role="assistant" content="Réponse insuffisante" onFeedback={onFeedback} />
    );

    const buttons = Array.from(container.querySelectorAll('button'));
    const negativeButton = buttons[2];
    const positiveButton = buttons[1];

    fireEvent.click(negativeButton);

    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onFeedback).toHaveBeenCalledWith('negative');
    expect(negativeButton).toBeDisabled();
    expect(positiveButton).toBeDisabled();
    expect(negativeButton.className).toContain('text-red-500');
  });

  it('déclenche la régénération avec vibration de sélection', () => {
    const onRegenerate = vi.fn();
    const { container } = render(
      <JarvisAppleMessage role="assistant" content="Réponse" onRegenerate={onRegenerate} />
    );

    const buttons = Array.from(container.querySelectorAll('button'));
    const regenerateButton = buttons[1];

    fireEvent.click(regenerateButton);

    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('n’affiche pas les boutons de feedback si aucun handler n’est fourni', () => {
    const { container } = render(
      <JarvisAppleMessage role="assistant" content="Sans feedback callback" />
    );

    expect(screen.queryByTestId('icon-thumbs-up')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-thumbs-down')).not.toBeInTheDocument();

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons).toHaveLength(1);
    expect(screen.getByTestId('icon-copy')).toBeInTheDocument();
  });
});