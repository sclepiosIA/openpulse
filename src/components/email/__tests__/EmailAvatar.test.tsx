import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailAvatar } from '../EmailAvatar';

vi.mock('@/hooks/email/useEmailSenderLogo', () => ({
  useEmailSenderLogo: () => ({ data: null }),
}));

vi.mock('@/hooks/profile/useProfileAvatarByEmail', () => ({
  useProfileAvatarByEmail: () => ({ data: null }),
}));

vi.mock('@/lib/internalEmailConfig', () => ({
  isMarqueEmail: (email?: string) => email?.includes('marque'),
  normalizeEmail: (email?: string) => email?.toLowerCase() || null,
}));

vi.mock('@/assets/marque/logo.png', () => ({ default: '/logo.png' }));

describe('EmailAvatar', () => {
  it('renders initials from full name', () => {
    render(<EmailAvatar name="Jean Dupont" email="jean@example.com" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders initials from single name', () => {
    render(<EmailAvatar name="Admin" />);
    expect(screen.getByText('AD')).toBeInTheDocument();
  });

  it('renders initials from email when no name', () => {
    render(<EmailAvatar email="contact@test.com" />);
    expect(screen.getByText('CO')).toBeInTheDocument();
  });

  it('renders ?? when no name or email', () => {
    render(<EmailAvatar />);
    expect(screen.getByText('??')).toBeInTheDocument();
  });

  it('applies size classes', () => {
    const { container } = render(<EmailAvatar name="A B" size="lg" />);
    expect(container.querySelector('.h-12')).toBeInTheDocument();
  });

  it('applies unread ring', () => {
    const { container } = render(<EmailAvatar name="A B" isUnread />);
    expect(container.querySelector('.ring-2')).toBeInTheDocument();
  });
});
