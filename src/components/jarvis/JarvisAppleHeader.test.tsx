/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { JarvisAppleHeader } from './JarvisAppleHeader';

const { vibrateSelectionMock } = vi.hoisted(() => ({
  vibrateSelectionMock: vi.fn(),
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection: vibrateSelectionMock,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/assets/jarvis-logo.png', () => ({
  default: '/mocked/jarvis-logo.png',
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    'aria-label': ariaLabel,
    title,
    type = 'button',
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    'aria-label'?: string;
    title?: string;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button type={type} onClick={onClick} className={className} aria-label={ariaLabel} title={title}>
      {children}
    </button>
  ),
}));

vi.mock('framer-motion', () => {
  const ReactModule = require('react') as typeof React;
  const createMotion = (tag: keyof JSX.IntrinsicElements) =>
    ReactModule.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<typeof tag>>(
      ({ children, ...props }, ref) => ReactModule.createElement(tag, { ...props, ref }, children)
    );

  return {
    motion: {
      header: createMotion('header'),
      div: createMotion('div'),
      span: createMotion('span'),
    },
  };
});

vi.mock('lucide-react', () => ({
  Plus: ({ className }: { className?: string }) => <svg data-testid="icon-plus" className={className} />,
  History: ({ className }: { className?: string }) => <svg data-testid="icon-history" className={className} />,
  X: ({ className }: { className?: string }) => <svg data-testid="icon-close" className={className} />,
  MoreHorizontal: ({ className }: { className?: string }) => <svg data-testid="icon-more" className={className} />,
}));

describe('JarvisAppleHeader', () => {
  beforeEach(() => {
    vibrateSelectionMock.mockClear();
  });

  it('affiche le logo, le titre et l’état par défaut sans indicateur de frappe', () => {
    const { container } = render(<JarvisAppleHeader />);

    expect(screen.getByText('Jarvis')).toBeInTheDocument();

    const logo = screen.getByAltText('Jarvis');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/mocked/jarvis-logo.png');

    expect(screen.queryByText('réfléchit...')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fermer')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ajouter')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Historique')).not.toBeInTheDocument();

    const header = container.querySelector('header');
    expect(header).toHaveClass('relative');
    expect(header).toHaveClass('flex');
    expect(header).toHaveClass('items-center');
    expect(header).toHaveClass('justify-between');
    expect(header).toHaveClass('bg-background/80');
  });

  it('affiche le texte de frappe quand isTyping est activé', () => {
    render(<JarvisAppleHeader isTyping />);

    expect(screen.getByText('Jarvis')).toBeInTheDocument();
    expect(screen.getByText('réfléchit...')).toBeInTheDocument();
  });

  it('rend les boutons d’action optionnels et déclenche vibration + callbacks', () => {
    const onClose = vi.fn();
    const onNewConversation = vi.fn();
    const onOpenHistory = vi.fn();

    render(
      <JarvisAppleHeader
        onClose={onClose}
        onNewConversation={onNewConversation}
        onOpenHistory={onOpenHistory}
      />
    );

    const closeButton = screen.getByLabelText('Fermer');
    const addButton = screen.getByLabelText('Ajouter');
    const historyButton = screen.getByLabelText('Historique');

    expect(closeButton).toBeInTheDocument();
    expect(addButton).toBeInTheDocument();
    expect(historyButton).toBeInTheDocument();
    expect(historyButton).toHaveAttribute('title', 'Historique');

    fireEvent.click(closeButton);
    expect(vibrateSelectionMock).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(addButton);
    expect(vibrateSelectionMock).toHaveBeenCalledTimes(2);
    expect(onNewConversation).toHaveBeenCalledTimes(1);

    fireEvent.click(historyButton);
    expect(vibrateSelectionMock).toHaveBeenCalledTimes(3);
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it('affiche le badge de pendingCount seulement si supérieur à 0', () => {
    const { rerender } = render(<JarvisAppleHeader onOpenHistory={() => undefined} pendingCount={0} />);

    expect(screen.getByLabelText('Historique')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();

    rerender(<JarvisAppleHeader onOpenHistory={() => undefined} pendingCount={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();

    rerender(<JarvisAppleHeader onOpenHistory={() => undefined} pendingCount={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('fusionne la className personnalisée avec les classes par défaut', () => {
    const { container } = render(<JarvisAppleHeader className="custom-header-class" />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('custom-header-class');
    expect(header).toHaveClass('border-b');
    expect(header).toHaveClass('px-4');
    expect(header).toHaveClass('py-3');
  });
});