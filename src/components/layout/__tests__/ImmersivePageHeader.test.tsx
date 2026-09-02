import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Briefcase } from 'lucide-react';

vi.mock('@/hooks/ui/useShouldAnimate', () => ({
  useShouldAnimate: () => false,
}));

vi.mock('@/components/ui/icon-circle', () => ({
  IconCircle: ({ icon: Icon, ...props }: any) => <div data-testid="icon-circle" />,
}));

import { ImmersivePageHeader } from '../ImmersivePageHeader';

describe('ImmersivePageHeader', () => {
  it('renders title', () => {
    render(<ImmersivePageHeader title="Prospects" icon={Briefcase} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Prospects');
  });

  it('renders actions', () => {
    render(<ImmersivePageHeader title="T" icon={Briefcase} actions={<button>New</button>} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders search button when onSearchClick provided', () => {
    const onClick = vi.fn();
    render(<ImmersivePageHeader title="T" icon={Briefcase} onSearchClick={onClick} searchPlaceholder="Chercher..." />);
    const btn = screen.getByText('Chercher...');
    fireEvent.click(btn.closest('button')!);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders stats', () => {
    render(<ImmersivePageHeader title="T" icon={Briefcase} stats={[{ label: 'total', value: 42 }]} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('total')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<ImmersivePageHeader title="T" icon={Briefcase}><span>Filters</span></ImmersivePageHeader>);
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });
});
