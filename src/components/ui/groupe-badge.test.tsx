import React, { type HTMLAttributes } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { GroupeBadge } from './groupe-badge';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
};

const { MockBadge, MockBuilding2, MockUsers } = vi.hoisted(() => {
  const MockBadge = (props: BadgeProps) => {
    const { variant, className, children, ...rest } = props;
    return React.createElement(
      'span',
      { ...rest, 'data-testid': 'badge', 'data-variant': variant ?? '', className: className ?? '' },
      children
    );
  };
  const MockBuilding2 = (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { ...props, 'data-testid': 'icon-building2' });
  const MockUsers = (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { ...props, 'data-testid': 'icon-users' });
  return { MockBadge, MockBuilding2, MockUsers };
});

vi.mock('@/components/ui/badge', () => ({ Badge: MockBadge }));
vi.mock('lucide-react', () => ({ Building2: MockBuilding2, Users: MockUsers }));

afterEach(() => {
  cleanup();
});

describe('GroupeBadge', () => {
  it('renders GHT with Building2 icon, default variant and expected classes', () => {
    render(<GroupeBadge type="GHT" />);

    const badge = screen.getByTestId('badge');
    const icon = screen.getByTestId('icon-building2');

    expect(badge).toBeTruthy();
    expect(badge.getAttribute('data-variant')).toBe('default');
    const cls = badge.getAttribute('class') || '';
    expect(cls.includes('bg-blue-100')).toBe(true);
    expect(cls.includes('hover:bg-blue-200')).toBe(true);
    expect(cls.includes('text-blue-800')).toBe(true);
    expect(cls.includes('border-blue-300')).toBe(true);

    expect(icon).toBeTruthy();
    expect(icon.getAttribute('class')).toBe('h-3 w-3 mr-1');

    expect(badge.textContent?.includes('GHT')).toBe(true);
  });

  it('overrides label with nom and hides icon for "Groupe Cliniques", keeps default variant and appends custom class', () => {
    render(<GroupeBadge type="Groupe Cliniques" nom="Mon Groupe" showIcon={false} className="extra-class" />);

    const badge = screen.getByTestId('badge');
    expect(badge.getAttribute('data-variant')).toBe('default');

    const cls = badge.getAttribute('class') || '';
    expect(cls.includes('bg-purple-100')).toBe(true);
    expect(cls.includes('hover:bg-purple-200')).toBe(true);
    expect(cls.includes('text-purple-800')).toBe(true);
    expect(cls.includes('border-purple-300')).toBe(true);
    expect(cls.includes('extra-class')).toBe(true);

    expect(screen.queryByTestId('icon-users')).toBeNull();
    expect(badge.textContent).toBe('Mon Groupe');
  });

  it('renders Consortium with Building2 icon and correct label', () => {
    render(<GroupeBadge type="Consortium" />);

    const badge = screen.getByTestId('badge');
    expect(badge.getAttribute('data-variant')).toBe('default');
    expect(badge.textContent?.includes('Consortium')).toBe(true);

    const icon = screen.getByTestId('icon-building2');
    expect(icon).toBeTruthy();
    expect(icon.getAttribute('class')).toBe('h-3 w-3 mr-1');
  });

  it('renders Autre with secondary variant, Users icon and generic label', () => {
    render(<GroupeBadge type="Autre" />);

    const badge = screen.getByTestId('badge');
    expect(badge.getAttribute('data-variant')).toBe('secondary');
    expect(badge.textContent?.includes('Groupe')).toBe(true);

    const cls = badge.getAttribute('class') || '';
    expect(cls.includes('bg-')).toBe(false);
    expect(cls.includes('text-')).toBe(false);
    expect(cls.includes('border-')).toBe(false);

    const icon = screen.getByTestId('icon-users');
    expect(icon).toBeTruthy();
    expect(icon.getAttribute('class')).toBe('h-3 w-3 mr-1');
  });

  it('appends provided className to type-specific classes for GHT', () => {
    render(<GroupeBadge type="GHT" className="custom-flag-xyz" />);

    const badge = screen.getByTestId('badge');
    const cls = badge.getAttribute('class') || '';
    expect(cls.includes('bg-blue-100')).toBe(true);
    expect(cls.includes('custom-flag-xyz')).toBe(true);
  });
});