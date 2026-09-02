import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/ui/avatar', () => {
  function Avatar(props: React.ComponentProps<'div'>) {
    return <div data-testid="avatar" {...props} />;
  }
  function AvatarFallback(props: React.ComponentProps<'div'>) {
    return <div data-testid="avatar-fallback" {...props} />;
  }
  function AvatarImage(props: React.ComponentProps<'img'>) {
    return <img data-testid="avatar-image" {...props} />;
  }
  return { Avatar, AvatarFallback, AvatarImage };
});

vi.mock('@/components/ui/tooltip', () => {
  function TooltipProvider({ children }: { children: React.ReactNode; delayDuration?: number }) {
    return <div data-testid="tooltip-provider">{children}</div>;
  }
  function Tooltip({ children }: { children: React.ReactNode }) {
    return <div data-testid="tooltip">{children}</div>;
  }
  function TooltipTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
    return <div data-testid="tooltip-trigger" data-aschild={asChild ? 'true' : 'false'}>{children}</div>;
  }
  function TooltipContent({
    children,
    side,
    className,
  }: {
    children: React.ReactNode;
    side?: string;
    className?: string;
  }) {
    return (
      <div data-testid="tooltip-content" data-side={side ?? ''} className={className}>
        {children}
      </div>
    );
  }
  return { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
});

vi.mock('lucide-react', () => {
  function Users(props: React.ComponentProps<'svg'>) {
    return <svg data-testid="users-icon" {...props} />;
  }
  return { Users };
});

import { CollaborativeCursors } from './CollaborativeCursors';

describe('CollaborativeCursors', () => {
  it('retourne null quand déconnecté et aucun utilisateur', () => {
    const { container } = render(<CollaborativeCursors connectedUsers={[]} isConnected={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('affiche l’état connecté et les avatars avec initiales/alt + compteur + tooltip noms supplémentaires', () => {
    const connectedUsers = [
      { user_id: 'u1', user_name: 'Ada Lovelace', user_color: '#111111', user_avatar: 'https://example.com/a.png' },
      { user_id: 'u2', user_name: 'Grace Hopper', user_color: '#222222' },
      { user_id: 'u3', user_name: 'Alan Turing', user_color: '#333333' },
      { user_id: 'u4', user_name: 'Linus Torvalds', user_color: '#444444' },
      { user_id: 'u5', user_name: 'Margaret Hamilton', user_color: '#555555' },
      { user_id: 'u6', user_name: 'Donald Knuth', user_color: '#666666' },
    ];

    const { container } = render(
      <CollaborativeCursors connectedUsers={connectedUsers} isConnected={true} />,
    );

    expect(screen.getByText('Connecté')).toBeInTheDocument();

    const indicator = container.querySelector('div.w-2.h-2.rounded-full');
    expect(indicator).not.toBeNull();
    expect(indicator?.className).toContain('bg-emerald-500');

    const avatars = screen.getAllByTestId('avatar');
    expect(avatars).toHaveLength(4);

    const img = screen.getByTestId('avatar-image') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/a.png');
    expect(img.getAttribute('alt')).toBe('Ada Lovelace');

    expect(screen.getByText('GH')).toBeInTheDocument();
    expect(screen.getByText('AT')).toBeInTheDocument();
    expect(screen.getByText('LT')).toBeInTheDocument();

    expect(screen.getByTestId('users-icon')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();

    const tooltipContents = screen.getAllByTestId('tooltip-content');
    expect(tooltipContents.some((n) => n.textContent === 'Ada Lovelace')).toBe(true);
    expect(tooltipContents.some((n) => n.textContent === 'Grace Hopper')).toBe(true);
    expect(tooltipContents.some((n) => n.textContent === 'Alan Turing')).toBe(true);
    expect(tooltipContents.some((n) => n.textContent === 'Linus Torvalds')).toBe(true);
    expect(tooltipContents.some((n) => n.textContent === 'Margaret Hamilton, Donald Knuth')).toBe(true);
  });

  it('affiche l’état déconnecté même si des utilisateurs sont présents', () => {
    const connectedUsers = [{ user_id: 'u1', user_name: 'Marie Curie', user_color: '#abcdef' }];

    const { container } = render(
      <CollaborativeCursors connectedUsers={connectedUsers} isConnected={false} />,
    );

    expect(screen.getByText('Déconnecté')).toBeInTheDocument();

    const indicator = container.querySelector('div.w-2.h-2.rounded-full');
    expect(indicator).not.toBeNull();
    expect(indicator?.className).toContain('bg-destructive');

    expect(screen.getAllByTestId('avatar')).toHaveLength(1);
    expect(screen.getByText('MC')).toBeInTheDocument();
    expect(screen.getAllByTestId('tooltip-content').some((n) => n.textContent === 'Marie Curie')).toBe(true);
  });
});