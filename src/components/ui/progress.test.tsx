import React from 'react';
import { render } from '@testing-library/react';
import { Progress } from './progress';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { cn } = vi.hoisted(() => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' ')
}));

vi.mock('@radix-ui/react-progress', () => {
  const React = require('react');
  const Root = React.forwardRef((props: any, ref: any) => {
    const { className, style, children, ...rest } = props;
    return React.createElement('div', { 'data-testid': 'progress-root', className, style, ref, ...rest }, children);
  });
  Root.displayName = 'ProgressRoot';
  const Indicator = React.forwardRef((props: any, ref: any) => {
    const { className, style, ...rest } = props;
    return React.createElement('div', { 'data-testid': 'progress-indicator', className, style, ref, ...rest });
  });
  Indicator.displayName = 'ProgressIndicator';
  return { Root, Indicator };
});

vi.mock('@/lib/utils', () => ({
  cn
}));

describe('Progress component', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: 0, gcTime: 0 },
            mutations: { retry: 0 }
          }
        })
      }
    >
      {children}
    </QueryClientProvider>
  );

  it('renders with value and updates indicator transform accordingly', () => {
    const { container } = render(<Progress value={20} />, { wrapper });

    const root = container.querySelector('[data-testid="progress-root"]') as HTMLElement;
    const indicator = container.querySelector('[data-testid="progress-indicator"]') as HTMLElement;

    expect(root).toBeTruthy();
    expect(indicator).toBeTruthy();
    expect(indicator.style.transform).toBe('translateX(-80%)');
  });

  it('renders with no value prop and indicator is at -100%', () => {
    const { container } = render(<Progress />, { wrapper });

    const indicator = container.querySelector('[data-testid="progress-indicator"]') as HTMLElement;

    expect(indicator).toBeTruthy();
    expect(indicator.style.transform).toBe('translateX(-100%)');
  });

  it('applies className to the root element', () => {
    const { container } = render(<Progress value={40} className="my-progress" />, { wrapper });

    const root = container.querySelector('[data-testid="progress-root"]') as HTMLElement;

    expect(root).toBeTruthy();
    expect(root.className).toContain('my-progress');
  });
});