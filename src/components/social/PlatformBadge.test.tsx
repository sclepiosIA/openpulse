/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlatformBadge } from './PlatformBadge';

const { badgeSpy, cnSpy } = vi.hoisted(() => ({
  badgeSpy: vi.fn(),
  cnSpy: vi.fn((...classes: Array<string | undefined>) => classes.filter(Boolean).join(' ')),
}));

vi.mock('lucide-react', () => {
  const makeIcon = (testId: string) => {
    const Icon = ({ className, 'aria-hidden': ariaHidden }: { className?: string; 'aria-hidden'?: boolean }) =>
      React.createElement('svg', { 'data-testid': testId, className, 'aria-hidden': ariaHidden });
    return Icon;
  };

  return {
    Facebook: makeIcon('icon-facebook'),
    Instagram: makeIcon('icon-instagram'),
    Linkedin: makeIcon('icon-linkedin'),
    Music2: makeIcon('icon-tiktok'),
  };
});

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: 'default' | 'outline' | 'secondary';
    className?: string;
  }) => {
    badgeSpy({ variant, className });
    return React.createElement('div', { 'data-testid': 'badge', 'data-variant': variant, className }, children);
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined>) => cnSpy(...classes),
}));

vi.mock('@/types/social', () => ({
  PLATFORM_LABELS: {
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
  },
}));

describe('PlatformBadge', () => {
  beforeEach(() => {
    badgeSpy.mockClear();
    cnSpy.mockClear();
  });

  it('renders facebook badge with default secondary variant and label', () => {
    render(<PlatformBadge platform="facebook" />);

    const badge = screen.getByTestId('badge');
    expect(badge).toHaveAttribute('data-variant', 'secondary');
    expect(badge).toHaveClass('gap-1.5');

    const icon = screen.getByTestId('icon-facebook');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('h-3.5', 'w-3.5');
    expect(icon).toHaveAttribute('aria-hidden', 'true');

    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(cnSpy).toHaveBeenCalledWith('gap-1.5', undefined);
    expect(badgeSpy).toHaveBeenCalledWith({ variant: 'secondary', className: 'gap-1.5' });
  });

  it('renders the correct icon and label for each platform', () => {
    const { rerender } = render(<PlatformBadge platform="instagram" />);

    expect(screen.getByTestId('icon-instagram')).toBeInTheDocument();
    expect(screen.getByText('Instagram')).toBeInTheDocument();

    rerender(<PlatformBadge platform="linkedin" />);
    expect(screen.getByTestId('icon-linkedin')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();

    rerender(<PlatformBadge platform="tiktok" />);
    expect(screen.getByTestId('icon-tiktok')).toBeInTheDocument();
    expect(screen.getByText('TikTok')).toBeInTheDocument();
  });

  it('hides the label when showLabel is false', () => {
    render(<PlatformBadge platform="instagram" showLabel={false} />);

    expect(screen.getByTestId('icon-instagram')).toBeInTheDocument();
    expect(screen.queryByText('Instagram')).not.toBeInTheDocument();
  });

  it('passes custom variant and merged className to Badge', () => {
    render(<PlatformBadge platform="linkedin" variant="outline" className="custom-class" />);

    const badge = screen.getByTestId('badge');
    expect(badge).toHaveAttribute('data-variant', 'outline');
    expect(badge).toHaveClass('gap-1.5', 'custom-class');

    expect(cnSpy).toHaveBeenCalledWith('gap-1.5', 'custom-class');
    expect(badgeSpy).toHaveBeenCalledWith({ variant: 'outline', className: 'gap-1.5 custom-class' });
  });

  it('supports the default variant explicitly', () => {
    render(<PlatformBadge platform="facebook" variant="default" />);

    expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', 'default');
    expect(screen.getByText('Facebook')).toBeInTheDocument();
  });
});