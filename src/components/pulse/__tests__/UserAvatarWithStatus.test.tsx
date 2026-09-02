import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserAvatarWithStatus } from '../UserAvatarWithStatus';

const user = { id: 'u1', nom: 'Dupont', prenom: 'Jean', avatar_url: null };

describe('UserAvatarWithStatus', () => {
  it('renders initials', () => {
    render(<UserAvatarWithStatus user={user} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders ? for unknown user', () => {
    render(<UserAvatarWithStatus user={{ id: 'u2' }} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('renders status badge by default', () => {
    const { container } = render(<UserAvatarWithStatus user={user} status="active" />);
    expect(container.querySelector('.rounded-full')).toBeInTheDocument();
  });

  it('hides status when showStatus=false', () => {
    const { container } = render(<UserAvatarWithStatus user={user} showStatus={false} />);
    // Only the avatar container, no badge
    const spans = container.querySelectorAll('span.absolute');
    expect(spans.length).toBe(0);
  });

  it('supports different sizes', () => {
    const { container } = render(<UserAvatarWithStatus user={user} size="lg" />);
    expect(container.querySelector('.h-12')).toBeInTheDocument();
  });

  it('supports xs size', () => {
    const { container } = render(<UserAvatarWithStatus user={user} size="xs" />);
    expect(container.querySelector('.h-6')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<UserAvatarWithStatus user={user} className="my-cls" />);
    expect(container.querySelector('.my-cls')).toBeInTheDocument();
  });

  it('renders offline status with gray badge', () => {
    const { container } = render(<UserAvatarWithStatus user={user} status="offline" />);
    expect(container.querySelector('.bg-gray-400')).toBeInTheDocument();
  });
});
