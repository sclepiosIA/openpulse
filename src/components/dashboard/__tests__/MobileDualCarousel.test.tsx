import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileDualCarousel } from '../MobileDualCarousel';
import { TrendingUp, MessageCircle } from 'lucide-react';

vi.mock('../MobileWidgetCarousel', () => ({
  MobileWidgetCarousel: ({ widgets }: any) => (
    <div data-testid="carousel">{widgets.map((w: any) => <div key={w.id}>{w.label}</div>)}</div>
  ),
}));

const sections = [
  {
    id: 's1',
    title: 'Activité',
    icon: TrendingUp,
    widgets: [{ id: 'w1', label: 'Widget 1', content: <div>Content 1</div> }],
    currentIndex: 0,
    onIndexChange: vi.fn(),
  },
  {
    id: 's2',
    title: 'Messages',
    icon: MessageCircle,
    widgets: [{ id: 'w2', label: 'Widget 2', content: <div>Content 2</div> }],
    currentIndex: 0,
    onIndexChange: vi.fn(),
  },
];

describe('MobileDualCarousel', () => {
  it('renders section titles', () => {
    render(<MobileDualCarousel sections={sections} />);
    expect(screen.getByText('Activité')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
  });

  it('renders carousels for each section', () => {
    render(<MobileDualCarousel sections={sections} />);
    expect(screen.getAllByTestId('carousel')).toHaveLength(2);
  });

  it('renders nothing when sections empty', () => {
    const { container } = render(<MobileDualCarousel sections={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(<MobileDualCarousel sections={sections} className="my-cls" />);
    expect(container.querySelector('.my-cls')).toBeInTheDocument();
  });

  it('renders widget labels through carousel', () => {
    render(<MobileDualCarousel sections={sections} />);
    expect(screen.getByText('Widget 1')).toBeInTheDocument();
    expect(screen.getByText('Widget 2')).toBeInTheDocument();
  });
});
