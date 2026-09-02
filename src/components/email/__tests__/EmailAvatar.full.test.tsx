import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock all hooks used by EmailAvatar
vi.mock('@/hooks/email/useEmailSenderLogo', () => ({
  useEmailSenderLogo: () => ({ data: null }),
}));
vi.mock('@/hooks/profile/useProfileAvatarByEmail', () => ({
  useProfileAvatarByEmail: () => ({ data: null }),
}));
vi.mock('@/lib/internalEmailConfig', () => ({
  isMarqueEmail: () => false,
  normalizeEmail: (e: string) => e?.toLowerCase(),
}));
vi.mock('@/assets/marque/logo.png', () => ({ default: '/logo.png' }));

import { EmailAvatar } from '../EmailAvatar';

describe('EmailAvatar', () => {
  it('renders initials from full name', () => {
    render(<EmailAvatar name="Jean Dupont" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders 2 chars from single name', () => {
    render(<EmailAvatar name="Marie" />);
    expect(screen.getByText('MA')).toBeInTheDocument();
  });

  it('renders initials from email when no name', () => {
    render(<EmailAvatar email="jean@test.com" />);
    expect(screen.getByText('JE')).toBeInTheDocument();
  });

  it('renders ?? when no name or email', () => {
    render(<EmailAvatar />);
    expect(screen.getByText('??')).toBeInTheDocument();
  });

  it('applies sm size class', () => {
    const { container } = render(<EmailAvatar name="Test" size="sm" />);
    expect(container.querySelector('.h-8')).toBeTruthy();
  });

  it('applies lg size class', () => {
    const { container } = render(<EmailAvatar name="Test" size="lg" />);
    expect(container.querySelector('.h-12')).toBeTruthy();
  });

  it('shows unread ring when isUnread', () => {
    const { container } = render(<EmailAvatar name="Test" isUnread />);
    expect(container.querySelector('.ring-2')).toBeTruthy();
  });
});
