import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileWidgetCarousel } from '../MobileWidgetCarousel';

beforeAll(() => {
  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      root = null;
      rootMargin = '';
      thresholds = [];
      takeRecords() { return []; }
    } as any;
  }
});

const widgets = [
  { id: 'w1', label: 'Widget A', content: <div>Content A</div> },
  { id: 'w2', label: 'Widget B', content: <div>Content B</div> },
  { id: 'w3', label: 'Widget C', content: <div>Content C</div> },
];

describe('MobileWidgetCarousel', () => {
  it('renders widget contents', () => {
    render(<MobileWidgetCarousel widgets={widgets} />);
    expect(screen.getByText('Content A')).toBeInTheDocument();
    expect(screen.getByText('Content B')).toBeInTheDocument();
    expect(screen.getByText('Content C')).toBeInTheDocument();
  });

  it('renders dot indicators', () => {
    const { container } = render(<MobileWidgetCarousel widgets={widgets} />);
    const dots = container.querySelectorAll('button.rounded-full');
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });

  it('applies custom className', () => {
    const { container } = render(<MobileWidgetCarousel widgets={widgets} className="my-cls" />);
    expect(container.querySelector('.my-cls')).toBeInTheDocument();
  });

  it('renders labels in tab bar', () => {
    render(<MobileWidgetCarousel widgets={widgets} />);
    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('Widget B')).toBeInTheDocument();
  });

  it('supports compact mode', () => {
    const { container } = render(<MobileWidgetCarousel widgets={widgets} compact />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
