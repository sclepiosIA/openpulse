// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ReactionBar } from './ReactionBar';

const { REACTION_EMOJIS, onToggle, reactions } = vi.hoisted(() => ({
  REACTION_EMOJIS: ['👍', '❤️', '😂'],
  onToggle: vi.fn(),
  reactions: [
    { emoji: '👍', count: 3, reactedByMe: true },
    { emoji: '🎉', count: 1, reactedByMe: false },
  ],
}));

vi.mock('@/types/activity', () => ({
  REACTION_EMOJIS,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    'aria-label': ariaLabel,
    variant,
    size,
    type,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
    'aria-label'?: string;
    variant?: string;
    size?: string;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      className={className}
      aria-label={ariaLabel}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-root">{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  PopoverContent: ({
    children,
    className,
    onClick,
    align,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    align?: string;
  }) => (
    <div data-testid="popover-content" className={className} onClick={onClick} data-align={align}>
      {children}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  SmilePlus: ({ className }: { className?: string }) => <svg data-testid="smile-plus-icon" className={className} />,
}));

describe('ReactionBar', () => {
  beforeEach(() => {
    onToggle.mockClear();
  });

  it('affiche les réactions agrégées avec leurs compteurs et styles métier', () => {
    render(<ReactionBar activityKey="activity-1" reactions={reactions} onToggle={onToggle} />);

    const reactedButton = screen.getByRole('button', { name: /👍\s*3/i });
    const notReactedButton = screen.getByRole('button', { name: /🎉\s*1/i });

    expect(reactedButton).toBeInTheDocument();
    expect(notReactedButton).toBeInTheDocument();
    expect(reactedButton).toHaveTextContent('👍');
    expect(reactedButton).toHaveTextContent('3');
    expect(notReactedButton).toHaveTextContent('🎉');
    expect(notReactedButton).toHaveTextContent('1');

    expect(reactedButton.className).toContain('bg-primary/10');
    expect(reactedButton.className).toContain('border-primary/40');
    expect(reactedButton.className).toContain('text-primary');
    expect(notReactedButton.className).toContain('bg-muted/50');
    expect(notReactedButton.className).toContain('border-transparent');
    expect(notReactedButton.className).toContain('hover:bg-muted');
  });

  it('déclenche onToggle avec le bon emoji et le bon état courant depuis une réaction existante', () => {
    render(<ReactionBar activityKey="activity-2" reactions={reactions} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: /👍\s*3/i }));
    fireEvent.click(screen.getByRole('button', { name: /🎉\s*1/i }));

    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenNthCalledWith(1, '👍', true);
    expect(onToggle).toHaveBeenNthCalledWith(2, '🎉', false);
  });

  it('affiche le bouton d’ajout et toutes les options emoji du popover', () => {
    render(<ReactionBar activityKey="activity-3" reactions={reactions} onToggle={onToggle} />);

    expect(screen.getByRole('button', { name: 'Ajouter une réaction' })).toBeInTheDocument();
    expect(screen.getByTestId('smile-plus-icon')).toBeInTheDocument();

    const popoverContent = screen.getByTestId('popover-content');
    expect(popoverContent).toBeInTheDocument();

    for (const emoji of REACTION_EMOJIS) {
      expect(within(popoverContent).getByRole('button', { name: emoji })).toBeInTheDocument();
    }
  });

  it('déclenche onToggle depuis le popover avec reactedByMe=true si l’emoji existe déjà pour moi', () => {
    render(<ReactionBar activityKey="activity-4" reactions={reactions} onToggle={onToggle} />);

    const popoverContent = screen.getByTestId('popover-content');
    fireEvent.click(within(popoverContent).getByRole('button', { name: '👍' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('👍', true);
  });

  it('déclenche onToggle depuis le popover avec reactedByMe=false pour un emoji absent des réactions', () => {
    render(<ReactionBar activityKey="activity-5" reactions={reactions} onToggle={onToggle} />);

    const popoverContent = screen.getByTestId('popover-content');
    fireEvent.click(within(popoverContent).getByRole('button', { name: '❤️' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('❤️', false);
  });

  it('met en évidence dans le popover les emojis déjà ajoutés par moi', () => {
    render(<ReactionBar activityKey="activity-6" reactions={reactions} onToggle={onToggle} />);

    const popoverContent = screen.getByTestId('popover-content');
    const emojiAlreadyReacted = within(popoverContent).getByRole('button', { name: '👍' });
    const emojiNotReacted = within(popoverContent).getByRole('button', { name: '❤️' });
    const emojiNotPresentInReactions = within(popoverContent).getByRole('button', { name: '😂' });

    expect(emojiAlreadyReacted.className).toContain('bg-primary/10');
    expect(emojiNotReacted.className).not.toContain('bg-primary/10');
    expect(emojiNotPresentInReactions.className).not.toContain('bg-primary/10');
  });

  it('gère correctement une liste vide de réactions', () => {
    render(<ReactionBar activityKey="activity-7" reactions={[]} onToggle={onToggle} />);

    expect(screen.getByRole('button', { name: 'Ajouter une réaction' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /🎉\s*1/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /👍\s*3/i })).not.toBeInTheDocument();

    const popoverContent = screen.getByTestId('popover-content');
    fireEvent.click(within(popoverContent).getByRole('button', { name: '😂' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('😂', false);
  });
});